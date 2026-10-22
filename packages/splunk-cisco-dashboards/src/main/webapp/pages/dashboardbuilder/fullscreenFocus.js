const PANEL_SELECTOR = '[data-test="viz-item"]';
const BUTTON_SELECTOR = '[data-test="fullscreen-button"]';
const PANEL_FOCUS_SELECTOR = '[data-test="select-outline"]';

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
                const button = panel.querySelector(BUTTON_SELECTOR);
                button?.focus({ preventScroll: true });
                if (!button || doc.activeElement !== button) {
                    // Mouse entry can leave the native toolbar hidden. Focusing
                    // its panel reveals it through the framework's focus state.
                    const outline = panel.querySelector(PANEL_FOCUS_SELECTOR);
                    outline?.focus({ preventScroll: true });
                    frame = view.requestAnimationFrame(() => {
                        frame = null;
                        if (!doc.fullscreenElement && panel.isConnected && root.contains(panel)
                            && outline && doc.activeElement === outline) {
                            panel.querySelector(BUTTON_SELECTOR)?.focus({ preventScroll: true });
                        }
                    });
                }
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
