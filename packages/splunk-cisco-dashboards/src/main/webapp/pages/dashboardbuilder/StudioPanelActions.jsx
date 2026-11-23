import React, { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ActionButton } from '@splunk/dashboard-action-buttons';
import InformationCircle from '@splunk/react-icons/InformationCircle';
import LayoutStacked from '@splunk/react-icons/LayoutStacked';
import Button from '@splunk/react-ui/Button';
import Message from '@splunk/react-ui/Message';
import Modal from '@splunk/react-ui/Modal';
import styled from 'styled-components';
import { variables } from '@splunk/themes';
import { canvasIntegration, inspectorUrl, isCanvasSource, panelSearchId } from './aiCanvasIntegration';
import { AiCanvasDialog, useAiCanvasEligibility } from '../../common/components/AiCanvasDialog';

const PanelModal = styled(Modal)`
    width: ${({ $width }) => $width}px;
    max-width: calc(100vw - ${variables.spacingLarge} - ${variables.spacingLarge});
`;
const panelPropTypes = {
    itemDefinition: PropTypes.shape({
        title: PropTypes.string,
        dataSources: PropTypes.shape({ primary: PropTypes.string }),
    }).isRequired,
    dataSources: PropTypes.objectOf(PropTypes.object).isRequired,
    dashboardApi: PropTypes.object.isRequired,
};

export function InspectPanelAction({ itemDefinition, dataSources, dashboardApi }) {
    const trigger = useRef(null);
    const [error, setError] = useState('');
    if (!isCanvasSource(dataSources?.[itemDefinition?.dataSources?.primary])) {return null;}
    const inspect = async () => {
        const popup = window.open('', '_blank', 'left=100,top=200,width=760,height=600');
        if (popup) {popup.opener = null;}
        try {
            const sid = await panelSearchId(dashboardApi, itemDefinition);
            if (!popup) {throw new Error('Allow pop-ups to open the search job inspector.');}
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

InspectPanelAction.propTypes = panelPropTypes;

export function AddToCanvasPanelAction(props) {
    const [open, setOpen] = useState(false);
    const trigger = useRef(null);
    const supported = isCanvasSource(props.dataSources?.[props.itemDefinition?.dataSources?.primary]);
    const eligible = useAiCanvasEligibility(supported);
    if (!eligible) {return null;}
    return <>
        <ActionButton title="Add to AI Canvas" aria-label="Add to AI Canvas" data-test="add-to-ai-canvas-button"
            icon={<LayoutStacked width={18} height={18} />} elementRef={trigger} onClick={() => setOpen(true)} />
        <AiCanvasDialog
            draft={open ? {
                cardTitle: props.itemDefinition.title,
                preparePanel: (signal) => canvasIntegration.preparePanel(props.dashboardApi, props.itemDefinition, props.dataSources, signal),
            } : null}
            returnFocus={trigger}
            onClose={() => setOpen(false)}
        />
    </>;
}

AddToCanvasPanelAction.propTypes = panelPropTypes;
