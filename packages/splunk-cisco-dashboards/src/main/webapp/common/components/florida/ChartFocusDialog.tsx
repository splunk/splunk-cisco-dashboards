import React from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, PanelRightOpen, X } from 'lucide-react';

interface ChartFocusDialogProps {
    isOpen: boolean;
    label: string;
    subLabel?: string;
    onClose: () => void;
    onOpenInSearch?: () => void;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    children: React.ReactNode;
}

/**
 * Explicit, accessible focus view for compact categorical charts.
 *
 * This deliberately mirrors MetricItem's established expand interaction:
 * charts enlarge only after the user activates the Maximize button, never on
 * pointer hover. Keeping the interaction deliberate prevents a chart from
 * unexpectedly covering neighbouring tiles while an operator is scanning a
 * dense workspace.
 */
export const ChartFocusDialog: React.FC<ChartFocusDialogProps> = ({
    isOpen,
    label,
    subLabel,
    onClose,
    onOpenInSearch,
    onOpenDetailTable,
    detailTableTitle,
    children,
}) => {
    const titleId = React.useId();
    const portalTarget =
        typeof document !== 'undefined'
            ? document.getElementById('scan-root') ?? document.body
            : null;

    React.useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !portalTarget) {
        return null;
    }

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-[1800] flex items-center justify-center p-4"
            style={{ zIndex: 1800 }}
        >
            <button
                type="button"
                aria-label={`Close ${label}`}
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
                onClick={onClose}
            />
            <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
                    <div className="min-w-0">
                        <h2
                            id={titleId}
                            className="truncate text-base font-black tracking-tight text-slate-900 dark:text-slate-100"
                        >
                            {label}
                        </h2>
                        {subLabel && (
                            <p className="mt-1 truncate text-sm font-medium text-slate-500 dark:text-slate-400">
                                {subLabel}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {onOpenInSearch && (
                            <button
                                type="button"
                                onClick={onOpenInSearch}
                                title="Open in Search"
                                aria-label={`Open ${label} in Search`}
                                className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Search
                            </button>
                        )}
                        {onOpenDetailTable && (
                            <button
                                type="button"
                                onClick={onOpenDetailTable}
                                title={
                                    detailTableTitle
                                        ? `Drill down: ${detailTableTitle}`
                                        : 'Drill down to details'
                                }
                                aria-label={`Drill down from ${label} to details`}
                                className="inline-flex items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-sky-600 dark:hover:bg-sky-950/40 dark:hover:text-sky-200"
                            >
                                <PanelRightOpen className="h-4 w-4" />
                                Details
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            title="Close"
                            aria-label={`Close ${label}`}
                            className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="max-h-[calc(90vh-73px)] overflow-y-auto px-5 py-5">
                    {children}
                </div>
            </div>
        </div>,
        portalTarget
    );
};
