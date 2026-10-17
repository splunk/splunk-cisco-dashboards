const PANEL_SELECTOR = '[data-test="viz-item"]';
const BUTTON_SELECTOR = '[data-test="fullscreen-button"]';

// Keep the framework's native fullscreen action. Restore focus after its exit
// render, when the action is enabled again and the browser has left fullscreen.
export function bindPanelFullscreenFocus(root) {
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    let origin = null;
    let frame = null;

    const cancelPendingFocus = () => {
        if (frame !== null) {
            view.cancelAnimationFrame(frame);
            frame = null;
        }
    };

    const onFullscreenChange = () => {
        if (doc.fullscreenElement) {
            cancelPendingFocus();
            const panel = doc.fullscreenElement.closest(PANEL_SELECTOR);
            origin = panel && root.contains(panel) ? panel : null;
            return;
        }

        const panel = origin;
        origin = null;
        if (!panel) {
            return;
        }
        cancelPendingFocus();
        frame = view.requestAnimationFrame(() => {
            frame = null;
            if (!doc.fullscreenElement && panel.isConnected && root.contains(panel)) {
                // The framework can remount the action menu while exiting.
                panel.querySelector(BUTTON_SELECTOR)?.focus({ preventScroll: true });
            }
        });
    };

    doc.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
        doc.removeEventListener('fullscreenchange', onFullscreenChange);
        cancelPendingFocus();
        origin = null;
    };
}
