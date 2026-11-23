import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Button from '@splunk/react-ui/Button';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Message from '@splunk/react-ui/Message';
import Modal from '@splunk/react-ui/Modal';
import RadioBar from '@splunk/react-ui/RadioBar';
import Select from '@splunk/react-ui/Select';
import Text from '@splunk/react-ui/Text';
import TextArea from '@splunk/react-ui/TextArea';
import styled from 'styled-components';
import { variables } from '@splunk/themes';
import { canvasIntegration } from '../../pages/dashboardbuilder/aiCanvasIntegration';

const PanelModal = styled(Modal)`
    width: ${({ $width }) => $width}px;
    max-width: calc(100vw - ${variables.spacingLarge} - ${variables.spacingLarge});
`;
const DestinationSelector = styled(RadioBar)`
    width: 100%;
    margin-bottom: ${variables.spacingLarge};
`;

export function useAiCanvasEligibility(supported) {
    const [eligible, setEligible] = useState(false);
    useEffect(() => {
        if (!supported) {return undefined;}
        let active = true;
        canvasIntegration.isEligible().then((result) => { if (active) {setEligible(result);} });
        return () => { active = false; };
    }, [supported]);
    return supported && eligible;
}

export function AiCanvasDialog({ draft, onClose, returnFocus, transferNotice = '' }) {
    return <PanelModal open={Boolean(draft)} returnFocus={returnFocus} onRequestClose={onClose} closeOnClickAway={false}
        data-test="add-to-ai-canvas-dialog" $width={600}>
        {draft && <AiCanvasForm {...draft} onClose={onClose} transferNotice={transferNotice} />}
    </PanelModal>;
}

AiCanvasDialog.propTypes = {
    draft: PropTypes.shape({
        cardTitle: PropTypes.string,
        preparePanel: PropTypes.func.isRequired,
    }),
    onClose: PropTypes.func.isRequired,
    returnFocus: PropTypes.shape({ current: PropTypes.object }).isRequired,
    transferNotice: PropTypes.string,
};

function AiCanvasForm({ onClose, cardTitle: initialTitle, preparePanel, transferNotice }) {
    const [mode, setMode] = useState('new');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [cardTitle, setCardTitle] = useState(initialTitle || '');
    const [selectedBoard, setSelectedBoard] = useState('');
    const [boards, setBoards] = useState([]);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [complete, setComplete] = useState(null);
    const session = useRef(null);
    const createdBoard = useRef(null);
    const operation = useRef(null);
    const busy = useRef(false);

    useEffect(() => {
        const controller = new AbortController();
        operation.current = controller;
        canvasIntegration.openSession(controller.signal).then(async (client) => {
            const page = await client.list(0, controller.signal);
            if (controller.signal.aborted) {return;}
            session.current = client;
            setBoards(page.boards);
            setOffset(page.boards.length);
            setTotal(page.total);
        }).catch((failure) => {
            if (!controller.signal.aborted) {setError(failure.message);}
        }).finally(() => {
            if (!controller.signal.aborted) {setLoading(false);}
        });
        return () => { controller.abort(); operation.current?.abort(); };
    }, []);

    const loadMore = async () => {
        if (busy.current) {return;}
        busy.current = true;
        setLoading(true);
        setError('');
        try {
            const controller = new AbortController();
            operation.current = controller;
            const client = session.current || await canvasIntegration.openSession(controller.signal);
            const page = await client.list(offset, controller.signal);
            if (controller.signal.aborted) {return;}
            session.current = client;
            setBoards((previous) => [...new Map([...previous, ...page.boards].map((board) => [board.boardId, board])).values()]);
            setOffset((previous) => previous + page.boards.length);
            // An empty page must not advertise an endless load-more loop.
            setTotal(page.boards.length ? page.total : offset);
        } catch (failure) {
            if (!operation.current?.signal.aborted) {setError(failure.message);}
        } finally { busy.current = false; if (!operation.current?.signal.aborted) {setLoading(false);} }
    };

    const add = async () => {
        if (busy.current || complete) {return;}
        setSubmitted(true);
        if (!cardTitle.trim() || (mode === 'new' && (!title.trim() || !description.trim())) || (mode === 'existing' && !selectedBoard)) {return;}
        busy.current = true;
        setAdding(true);
        setError('');
        const controller = new AbortController();
        operation.current = controller;
        // Reserve a window during the user gesture, before asynchronous requests.
        const popup = window.open('', '_blank');
        if (popup) {popup.opener = null;}
        try {
            const panel = await preparePanel(controller.signal);
            const client = session.current || await canvasIntegration.openSession(controller.signal);
            session.current = client;
            let boardId = mode === 'existing' ? selectedBoard : createdBoard.current?.id;
            if (!boardId) {
                boardId = await client.create(title.trim(), description.trim(), controller.signal);
                createdBoard.current = { id: boardId };
            }
            if (controller.signal.aborted) {popup?.close(); return;}
            const cardIds = await client.add(boardId, panel, cardTitle.trim(), controller.signal);
            // Once the card exists, a cross-launch failure must never cause a
            // retry to create a duplicate card. Keep a separate Open action.
            setComplete({ boardId, cardIds });
            const url = await canvasIntegration.launchUrl(boardId, cardIds, controller.signal);
            if (controller.signal.aborted) {popup?.close(); return;}
            if (popup) { popup.location.href = url; onClose(); }
            else {setComplete({ boardId, cardIds, url });}
        } catch (failure) {
            popup?.close();
            if (!controller.signal.aborted) {setError(failure.message || 'Failed to add card to AI Canvas. Try again.');}
        } finally {
            busy.current = false;
            if (!controller.signal.aborted) {setAdding(false);}
        }
    };

    const openCreated = async () => {
        if (busy.current) {return;}
        busy.current = true;
        const controller = new AbortController();
        operation.current = controller;
        const popup = window.open('', '_blank');
        if (popup) {popup.opener = null;}
        try {
            if (!popup) {throw new Error('Allow pop-ups to open AI Canvas. Your card has already been added.');}
            const url = complete.url || await canvasIntegration.launchUrl(complete.boardId, complete.cardIds, controller.signal);
            if (controller.signal.aborted) {popup.close(); return;}
            popup.location.href = url;
            onClose();
        } catch (failure) {
            popup?.close();
            if (!controller.signal.aborted) {setError(failure.message);}
        } finally { busy.current = false; }
    };

    const missing = (value) => submitted && !value.trim();
    let submitLabel = 'Add to AI Canvas';
    if (complete) {
        submitLabel = 'Open AI Canvas';
    } else if (adding) {
        submitLabel = 'Adding to AI Canvas…';
    }
    return <>
        <Modal.Header title="Add to AI Canvas" subtitle={transferNotice || undefined} />
        <Modal.Body>
            {error && <Message type="error" appearance="fill" role="alert">{error}</Message>}
            {complete ? <Message type="success" appearance="fill" role="status">Your card was added to AI Canvas. Open Canvas to view it.</Message> : <>
                <DestinationSelector value={mode} onChange={(_, { value }) => { setMode(value); setSubmitted(false); }} disabled={adding}
                    aria-label="AI Canvas destination">
                    <RadioBar.Option value="new" label="New canvas" />
                    <RadioBar.Option value="existing" label="Existing canvas" />
                </DestinationSelector>
                {mode === 'new' ? <>
                    <ControlGroup label="New AI Canvas title" required error={missing(title) ? 'Enter a canvas title.' : false}>
                        <Text value={title} onChange={(_, { value }) => setTitle(value)} error={missing(title)} disabled={adding || Boolean(createdBoard.current)} />
                    </ControlGroup>
                    <ControlGroup label="AI Canvas description" required error={missing(description) ? 'Enter a canvas description.' : false}>
                        <TextArea value={description} onChange={(_, { value }) => setDescription(value)} error={missing(description)} disabled={adding || Boolean(createdBoard.current)} />
                    </ControlGroup>
                </> : <ControlGroup label="AI Canvas" required error={submitted && !selectedBoard ? 'Choose a canvas.' : false}>
                    <Select value={selectedBoard} onChange={(_, { value }) => setSelectedBoard(value)} filter inline={false}
                        isLoadingOptions={loading} disabled={adding} error={submitted && !selectedBoard}>
                        {boards.map((board) => <Select.Option key={board.boardId} value={board.boardId} label={board.name || board.boardId} />)}
                    </Select>
                </ControlGroup>}
                {mode === 'existing' && !loading && !boards.length && !error && <Message type="info" role="status">No existing canvases are available.</Message>}
                {mode === 'existing' && offset < total && <Button label="Load more canvases" onClick={loadMore} disabled={loading || adding} />}
                {!session.current && error && <Button label="Retry loading canvases" onClick={loadMore} disabled={loading || adding} />}
                <ControlGroup label="Card title" required error={missing(cardTitle) ? 'Enter a card title.' : false}>
                    <Text value={cardTitle} onChange={(_, { value }) => setCardTitle(value)} error={missing(cardTitle)} disabled={adding} />
                </ControlGroup>
            </>}
        </Modal.Body>
        <Modal.Footer>
            <Button appearance="subtle" label={complete ? 'Close' : 'Cancel'} onClick={onClose} />
            <Button appearance="primary" label={submitLabel}
                onClick={complete ? openCreated : add} disabled={adding || loading} />
        </Modal.Footer>
    </>;
}

AiCanvasForm.propTypes = {
    cardTitle: PropTypes.string,
    onClose: PropTypes.func.isRequired,
    preparePanel: PropTypes.func.isRequired,
    transferNotice: PropTypes.string,
};
