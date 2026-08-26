import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

interface UseModalFocusTrapOptions {
    isOpen: boolean;
    dialogRef: RefObject<HTMLElement | null>;
    onClose: () => void;
    initialFocusRef?: RefObject<HTMLElement | null>;
}

const isVisibleFocusable = (element: HTMLElement): boolean => {
    if (element.getAttribute('aria-hidden') === 'true') {
        return false;
    }

    const style = window.getComputedStyle(element);
    return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        element.getClientRects().length > 0
    );
};

/**
 * Gives portal-based dialogs the same keyboard boundary as WorkspaceModalShell:
 * an initial focus target, Escape handling, Tab containment, and focus restore.
 */
export const useModalFocusTrap = ({
    isOpen,
    dialogRef,
    onClose,
    initialFocusRef,
}: UseModalFocusTrapOptions): void => {
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') {
            return undefined;
        }

        const dialog = dialogRef.current;
        if (!dialog) {
            return undefined;
        }

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const frame = window.requestAnimationFrame(() => {
            const initialFocus = initialFocusRef?.current;
            if (initialFocus && isVisibleFocusable(initialFocus)) {
                initialFocus.focus({ preventScroll: true });
                return;
            }
            dialog.focus({ preventScroll: true });
        });

        const onKeyDown = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onCloseRef.current();
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusable = Array.from(
                dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            ).filter(isVisibleFocusable);

            if (focusable.length === 0) {
                event.preventDefault();
                dialog.focus({ preventScroll: true });
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && (active === first || active === dialog)) {
                event.preventDefault();
                last.focus({ preventScroll: true });
            } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
                event.preventDefault();
                first.focus({ preventScroll: true });
            }
        };

        dialog.addEventListener('keydown', onKeyDown);
        return () => {
            window.cancelAnimationFrame(frame);
            dialog.removeEventListener('keydown', onKeyDown);
            if (previouslyFocused?.isConnected) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
    }, [dialogRef, initialFocusRef, isOpen]);
};
