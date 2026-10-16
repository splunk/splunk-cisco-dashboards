import React, { useEffect, useRef, useState } from 'react';
import { ActionButton } from '@splunk/dashboard-action-buttons';
import InformationCircle from '@splunk/react-icons/InformationCircle';
import LayoutStacked from '@splunk/react-icons/LayoutStacked';
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
import { canvasIntegration, inspectorUrl, isCanvasSource, panelSearchId } from './aiCanvasIntegration';

const PanelModal = styled(Modal)`
    width: ${({ $width }) => $width}px;
    max-width: calc(100vw - ${variables.spacingLarge} - ${variables.spacingLarge});
`;
const DestinationSelector = styled(RadioBar)`
    width: 100%;
    margin-bottom: ${variables.spacingLarge};
`;

export function InspectPanelAction({ itemDefinition, dataSources, dashboardApi }) {
    const trigger = useRef(null);
    const [error, setError] = useState('');
    if (!isCanvasSource(dataSources?.[itemDefinition?.dataSources?.primary])) return null;
    const inspect = async () => {
        const popup = window.open('', '_blank', 'left=100,top=200,width=760,height=600');
        if (popup) popup.opener = null;
        try {
            const sid = await panelSearchId(dashboardApi, itemDefinition);
            if (!popup) throw new Error('Allow pop-ups to open the search job inspector.');
            popup.location.href = inspectorUrl(sid);
        } catch (failure) {
            popup?.close();
            setError(failure.message || 'The job inspector could not find a valid search ID.');
        }
    };
    return <>
        <ActionButton role="link" title="Inspect" aria-label="Inspect - Open Externally"
            data-test="inspect-button" icon={<InformationCircle width={18} height={18} />}
            elementRef={trigger} onClick={inspect} />
        <PanelModal open={Boolean(error)} returnFocus={trigger} onRequestClose={() => setError('')} $width={480}>
            <Modal.Header title="Inspect search job" />
            <Modal.Body><Message type="error" role="alert">{error}</Message></Modal.Body>
            <Modal.Footer><Button label="Close" onClick={() => setError('')} /></Modal.Footer>
        </PanelModal>
    </>;
}

function CanvasDialog({ onClose, returnFocus, itemDefinition, dataSources, dashboardApi }) {
    const [mode, setMode] = useState('new');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [cardTitle, setCardTitle] = useState(itemDefinition.title || '');
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
            if (controller.signal.aborted) return;
            session.current = client;
            setBoards(page.boards);
            setOffset(page.boards.length);
            setTotal(page.total);
        }).catch((failure) => {
            if (!controller.signal.aborted) setError(failure.message);
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => { controller.abort(); operation.current?.abort(); };
    }, []);

    const loadMore = async () => {
        if (busy.current) return;
        busy.current = true;
        setLoading(true);
        setError('');
        try {
            const controller = new AbortController();
            operation.current = controller;
            const client = session.current || await canvasIntegration.openSession(controller.signal);
            const page = await client.list(offset, controller.signal);
            if (controller.signal.aborted) return;
            session.current = client;
            setBoards((previous) => [...new Map([...previous, ...page.boards].map((board) => [board.boardId, board])).values()]);
            setOffset((previous) => previous + page.boards.length);
            // An empty page must not advertise an endless load-more loop.
            setTotal(page.boards.length ? page.total : offset);
        } catch (failure) {
            if (!operation.current?.signal.aborted) setError(failure.message);
        } finally { busy.current = false; if (!operation.current?.signal.aborted) setLoading(false); }
    };

    const add = async () => {
        if (busy.current || complete) return;
        setSubmitted(true);
        if (!cardTitle.trim() || (mode === 'new' && (!title.trim() || !description.trim())) || (mode === 'existing' && !selectedBoard)) return;
        busy.current = true;
        setAdding(true);
        setError('');
        const controller = new AbortController();
        operation.current = controller;
        // Reserve a window during the user gesture, before asynchronous requests.
        const popup = window.open('', '_blank');
        if (popup) popup.opener = null;
        try {
            const panel = await canvasIntegration.preparePanel(dashboardApi, itemDefinition, dataSources, controller.signal);
            const client = session.current || await canvasIntegration.openSession(controller.signal);
            session.current = client;
            let boardId = mode === 'existing' ? selectedBoard : createdBoard.current?.id;
            if (!boardId) {
                boardId = await client.create(title.trim(), description.trim(), controller.signal);
                createdBoard.current = { id: boardId };
            }
            if (controller.signal.aborted) return;
            const cardIds = await client.add(boardId, panel, cardTitle.trim(), controller.signal);
            // Once the card exists, a cross-launch failure must never cause a
            // retry to create a duplicate card. Keep a separate Open action.
            setComplete({ boardId, cardIds });
            const url = await canvasIntegration.launchUrl(boardId, cardIds, controller.signal);
            if (controller.signal.aborted) return;
            if (popup) { popup.location.href = url; onClose(); }
            else setComplete({ boardId, cardIds, url });
        } catch (failure) {
            popup?.close();
            if (!controller.signal.aborted) setError(failure.message || 'Failed to add card to AI Canvas. Try again.');
        } finally {
            busy.current = false;
            if (!controller.signal.aborted) setAdding(false);
        }
    };

    const openCreated = async () => {
        if (busy.current) return;
        busy.current = true;
        const popup = window.open('', '_blank');
        if (popup) popup.opener = null;
        try {
            if (!popup) throw new Error('Allow pop-ups to open AI Canvas. Your card has already been added.');
            popup.location.href = complete.url || await canvasIntegration.launchUrl(complete.boardId, complete.cardIds);
            onClose();
        } catch (failure) { popup?.close(); setError(failure.message); }
        finally { busy.current = false; }
    };

    const missing = (value) => submitted && !value.trim();
    return <PanelModal open returnFocus={returnFocus} onRequestClose={onClose} closeOnClickAway={false}
        data-test="add-to-ai-canvas-dialog" $width={600}>
        <Modal.Header title="Add to AI Canvas" />
        <Modal.Body>
            {error && <Message type="error" appearance="fill" role="alert">{error}</Message>}
            {complete ? <Message type="success" appearance="fill" role="status">Your card was added to AI Canvas. Open Canvas to view it.</Message> : <>
                <DestinationSelector value={mode} onChange={(_, { value }) => { setMode(value); setSubmitted(false); }} disabled={adding}
                    aria-label="AI Canvas destination">
                    <RadioBar.Option value="new" label="Add to new AI Canvas" />
                    <RadioBar.Option value="existing" label="Add to existing AI Canvas" />
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
            <Button appearance="primary" label={complete ? 'Open AI Canvas' : adding ? 'Adding to AI Canvas…' : 'Add to AI Canvas'}
                onClick={complete ? openCreated : add} disabled={adding || loading} />
        </Modal.Footer>
    </PanelModal>;
}

export function AddToCanvasPanelAction(props) {
    const [eligible, setEligible] = useState(false);
    const [open, setOpen] = useState(false);
    const trigger = useRef(null);
    const supported = isCanvasSource(props.dataSources?.[props.itemDefinition?.dataSources?.primary]);
    useEffect(() => {
        if (!supported) return undefined;
        let active = true;
        canvasIntegration.isEligible().then((result) => { if (active) setEligible(result); });
        return () => { active = false; };
    }, [supported]);
    if (!supported || !eligible) return null;
    return <>
        <ActionButton title="Add to AI Canvas" aria-label="Add to AI Canvas" data-test="add-to-ai-canvas-button"
            icon={<LayoutStacked width={18} height={18} />} elementRef={trigger} onClick={() => setOpen(true)} />
        {open && <CanvasDialog {...props} returnFocus={trigger} onClose={() => setOpen(false)} />}
    </>;
}
