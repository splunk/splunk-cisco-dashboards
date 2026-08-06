import React from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, PanelRightOpen, X } from 'lucide-react';

import { cn } from '@/common/lib/utils';

export type WorkspaceModalVariant = 'metric' | 'chart' | 'detail';

interface WorkspaceModalShellProps {
    isOpen?: boolean;
    variant: WorkspaceModalVariant;
    title: string;
    subtitle?: string;
    titleId?: string;
    onClose: () => void;
    onOpenInSearch?: () => void;
    openInSearchHref?: string;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    headerMeta?: React.ReactNode;
    wide?: boolean;
    contentClassName?: string;
    children: React.ReactNode;
}

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

const VARIANT_CLASS: Record<WorkspaceModalVariant, string> = {
    metric: 'h-[min(72vh,660px)] max-w-[880px]',
    chart: 'h-[min(78vh,720px)] max-w-[960px]',
    detail: 'max-h-[75vh] max-w-[840px]',
};

const ACTION_CLASS =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border border-[#35506b] bg-[#132238] px-3 text-xs font-bold text-[#d8e5f0] transition-colors hover:border-sky-500 hover:bg-[#18304a] hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400';

/**
 * Shared dark-mode shell for Insights Workspace focus and drill-down dialogs.
 *
 * The content determines the semantic size variant, while the shell owns the
 * common backdrop, header, action order, keyboard handling, focus trapping,
 * and focus restoration. This keeps chart expansion deliberate and makes
 * detail views feel like task-focused layers instead of separate pages.
 */
export const WorkspaceModalShell: React.FC<WorkspaceModalShellProps> = ({
    isOpen = true,
    variant,
    title,
    subtitle,
    titleId: providedTitleId,
    onClose,
    onOpenInSearch,
    openInSearchHref,
    onOpenDetailTable,
    detailTableTitle,
    headerMeta,
    wide = false,
    contentClassName,
    children,
}) => {
    const generatedTitleId = React.useId();
    const generatedSubtitleId = React.useId();
    const titleId = providedTitleId ?? generatedTitleId;
    const dialogRef = React.useRef<HTMLDivElement>(null);
    const onCloseRef = React.useRef(onClose);

    onCloseRef.current = onClose;

    const portalTarget =
        typeof document !== 'undefined'
            ? document.getElementById('scan-root') ?? document.body
            : null;

    React.useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const previouslyFocused = document.activeElement as HTMLElement | null;
        const frame = window.requestAnimationFrame(() => {
            dialogRef.current?.focus({ preventScroll: true });
        });

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                onCloseRef.current();
                return;
            }

            if (event.key !== 'Tab' || !dialogRef.current) {
                return;
            }

            const focusable = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
            ).filter((element) => element.offsetParent !== null);

            if (focusable.length === 0) {
                event.preventDefault();
                dialogRef.current.focus({ preventScroll: true });
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && (active === first || active === dialogRef.current)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKeyDown, true);
        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener('keydown', onKeyDown, true);
            if (previouslyFocused?.isConnected) {
                previouslyFocused.focus({ preventScroll: true });
            }
        };
    }, [isOpen]);

    if (!isOpen || !portalTarget) {
        return null;
    }

    let searchAction: React.ReactNode = null;
    if (openInSearchHref) {
        searchAction = (
            <a
                href={openInSearchHref}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${title} in Search`}
                aria-label={`Open ${title} in Search`}
                className={ACTION_CLASS}
            >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Search
            </a>
        );
    } else if (onOpenInSearch) {
        searchAction = (
            <button
                type="button"
                onClick={onOpenInSearch}
                title="Open in Search"
                aria-label={`Open ${title} in Search`}
                className={ACTION_CLASS}
            >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Search
            </button>
        );
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[1900] flex items-center justify-center bg-slate-950/[0.56] p-4 backdrop-blur-[2px] max-[719px]:items-end max-[719px]:p-0 max-[719px]:pt-4"
            style={{ zIndex: 1900 }}
        >
            <button
                type="button"
                tabIndex={-1}
                aria-label={`Close ${title}`}
                className="absolute inset-0 cursor-default border-0 bg-transparent p-0"
                onClick={() => onCloseRef.current()}
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={subtitle ? generatedSubtitleId : undefined}
                tabIndex={-1}
                className={cn(
                    'relative z-10 flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-[#294761] bg-[#0b1220] text-slate-100 shadow-[0_18px_36px_rgba(0,0,0,0.42)] outline-none',
                    VARIANT_CLASS[variant],
                    variant === 'detail' && wide && 'max-w-[1000px]',
                    'max-[719px]:h-[calc(100vh-1rem)] max-[719px]:max-h-[calc(100vh-1rem)] max-[719px]:w-full max-[719px]:max-w-none max-[719px]:rounded-b-none max-[719px]:rounded-t-2xl'
                )}
            >
                <div className="flex min-h-16 flex-shrink-0 items-center justify-between gap-4 border-b border-[#1e3449] bg-[#0b1220] py-2.5 pl-5 pr-4">
                    <div className="min-w-0">
                        <h2
                            id={titleId}
                            className="truncate text-[15px] font-bold leading-[19px] text-[#f3f7fb]"
                        >
                            {title}
                        </h2>
                        {subtitle && (
                            <p
                                id={generatedSubtitleId}
                                className="mt-[3px] truncate text-[11px] font-normal leading-[15px] text-[#8ea3b8]"
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                        {headerMeta && <div className="hidden items-center gap-2 lg:flex">{headerMeta}</div>}
                        {searchAction}
                        {onOpenDetailTable && (
                            <button
                                type="button"
                                onClick={onOpenDetailTable}
                                title={
                                    detailTableTitle
                                        ? `Drill down: ${detailTableTitle}`
                                        : 'Drill down to details'
                                }
                                aria-label={`Drill down from ${title} to details`}
                                className={ACTION_CLASS}
                            >
                                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
                                Details
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => onCloseRef.current()}
                            title="Close"
                            aria-label={`Close ${title}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[#91a6ba] transition-colors hover:bg-[#18304a] hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                </div>
                <div
                    className={cn(
                        'min-h-0',
                        variant === 'detail' ? 'overflow-auto' : 'flex-1',
                        contentClassName
                    )}
                >
                    {children}
                </div>
            </div>
        </div>,
        portalTarget
    );
};
