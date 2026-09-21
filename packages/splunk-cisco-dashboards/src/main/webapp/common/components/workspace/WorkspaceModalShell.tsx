import React from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, PanelRightOpen, X } from '@/common/icons/SuiIcon';
import {
    readUserScopedStorageItem,
    userScopedStorageKey,
} from '@/common/config/insightsWorkspaces';

import { cn } from '@/common/lib/utils';
import { useAppThemeControls } from '@/common/theme/AppThemeProvider';

export type WorkspaceModalVariant = 'metric' | 'chart' | 'detail' | 'form';

interface WorkspaceModalShellProps {
    isOpen?: boolean;
    variant: WorkspaceModalVariant;
    title: string;
    subtitle?: string;
    titleId?: string;
    onClose: () => void;
    onOpenInSearch?: () => void;
    openInSearchHref?: string;
    openInSearchbaseHref?: string;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    headerMeta?: React.ReactNode;
    wide?: boolean;
    renderInDocumentBody?: boolean;
    contentClassName?: string;
    dialogClassName?: string;
    closeOnBackdrop?: boolean;
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
    detail: 'h-[min(78vh,800px)] max-w-[1120px]',
    form: 'max-h-[min(86vh,760px)] max-w-[760px]',
};

type ResizeAxis = 'width' | 'height' | 'both';

interface DialogSize {
    width: number;
    height: number;
}

const DESKTOP_DIALOG_BREAKPOINT = 720;
const DIALOG_VIEWPORT_GUTTER = 32;
const MIN_RESIZABLE_WIDTH = 640;
const MIN_RESIZABLE_HEIGHT = 360;
const BACKGROUND_VISIBILITY_STORAGE_KEY =
    'splunk-cisco-dashboards.workspaceModal.backgroundVisibility';
const LEGACY_BACKDROP_OPACITY_STORAGE_KEY =
    'splunk-cisco-dashboards.workspaceModal.backdropOpacity';
const DEFAULT_BACKGROUND_VISIBILITY = 84;
const MIN_BACKGROUND_VISIBILITY = 0;
const MAX_BACKGROUND_VISIBILITY = 100;

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, Math.min(min, max)), max);

const normalizeBackgroundVisibility = (value: number): number =>
    Math.round(clamp(value, MIN_BACKGROUND_VISIBILITY, MAX_BACKGROUND_VISIBILITY));

const readBackgroundVisibility = (): number => {
    if (typeof window === 'undefined') return DEFAULT_BACKGROUND_VISIBILITY;
    try {
        const stored = readUserScopedStorageItem(
            userScopedStorageKey(BACKGROUND_VISIBILITY_STORAGE_KEY),
        );
        if (stored !== null) {
            const parsed = Number(stored);
            return Number.isFinite(parsed)
                ? normalizeBackgroundVisibility(parsed)
                : DEFAULT_BACKGROUND_VISIBILITY;
        }

        const legacyOpacity = readUserScopedStorageItem(
            userScopedStorageKey(LEGACY_BACKDROP_OPACITY_STORAGE_KEY),
        );
        const parsedLegacyOpacity = Number(legacyOpacity);
        return legacyOpacity !== null && Number.isFinite(parsedLegacyOpacity)
            ? 100 - normalizeBackgroundVisibility(parsedLegacyOpacity)
            : DEFAULT_BACKGROUND_VISIBILITY;
    } catch {
        return DEFAULT_BACKGROUND_VISIBILITY;
    }
};

const writeBackgroundVisibility = (value: number): void => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(
            userScopedStorageKey(BACKGROUND_VISIBILITY_STORAGE_KEY),
            String(value),
        );
    } catch {
        // Storage may be unavailable in hardened browser contexts.
    }
};

const getDialogBounds = (): DialogSize => ({
    width: Math.max(320, window.innerWidth - DIALOG_VIEWPORT_GUTTER),
    height: Math.max(320, window.innerHeight - DIALOG_VIEWPORT_GUTTER),
});

const getAutoDetailSize = (wide: boolean): DialogSize | null => {
    if (typeof window === 'undefined' || window.innerWidth < DESKTOP_DIALOG_BREAKPOINT) {
        return null;
    }
    const bounds = getDialogBounds();
    const preferredWidth = wide
        ? Math.max(1120, window.innerWidth * 0.86)
        : Math.max(920, window.innerWidth * 0.74);
    const preferredHeight = Math.max(520, window.innerHeight * 0.78);
    return {
        width: clamp(preferredWidth, MIN_RESIZABLE_WIDTH, bounds.width),
        height: clamp(preferredHeight, MIN_RESIZABLE_HEIGHT, bounds.height),
    };
};

const ACTION_CLASS =
    'inline-flex h-8 items-center justify-center gap-1.5 rounded-[6px] border sui-border-default sui-bg-section px-3 text-xs font-bold sui-color-default transition-colors sui-hover-border-info sui-hover-bg-section sui-hover-color-active focus:outline-none focus:ring-2 sui-focus-ring';

/**
 * Shared themed shell for Insights Workspace focus and drill-down dialogs.
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
    openInSearchbaseHref,
    onOpenDetailTable,
    detailTableTitle,
    headerMeta,
    wide = false,
    renderInDocumentBody = false,
    contentClassName,
    dialogClassName,
    closeOnBackdrop = true,
    children,
}) => {
    const { colorScheme } = useAppThemeControls();
    const generatedTitleId = React.useId();
    const generatedSubtitleId = React.useId();
    const generatedBackgroundVisibilityId = React.useId();
    const titleId = providedTitleId ?? generatedTitleId;
    const dialogRef = React.useRef<HTMLDivElement>(null);
    const onCloseRef = React.useRef(onClose);
    const userResizedRef = React.useRef(false);
    const resizeCleanupRef = React.useRef<(() => void) | null>(null);
    const isResizable = variant === 'detail';
    const [dialogSize, setDialogSize] = React.useState<DialogSize | null>(() =>
        isResizable ? getAutoDetailSize(wide) : null
    );
    const [backgroundVisibility, setBackgroundVisibility] =
        React.useState(readBackgroundVisibility);

    onCloseRef.current = onClose;

    const resetAutoSize = React.useCallback(() => {
        userResizedRef.current = false;
        setDialogSize(isResizable ? getAutoDetailSize(wide) : null);
    }, [isResizable, wide]);

    const updateDialogSize = React.useCallback(
        (next: DialogSize) => {
            if (typeof window === 'undefined') return;
            const bounds = getDialogBounds();
            setDialogSize({
                width: clamp(next.width, MIN_RESIZABLE_WIDTH, bounds.width),
                height: clamp(next.height, MIN_RESIZABLE_HEIGHT, bounds.height),
            });
        },
        []
    );

    const beginResize = React.useCallback(
        (axis: ResizeAxis) => (event: React.PointerEvent<HTMLButtonElement>) => {
            if (
                !isResizable ||
                typeof window === 'undefined' ||
                window.innerWidth < DESKTOP_DIALOG_BREAKPOINT ||
                event.button !== 0
            ) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            resizeCleanupRef.current?.();

            const initial = dialogSize ?? getAutoDetailSize(wide);
            if (!initial) return;
            const startX = event.clientX;
            const startY = event.clientY;
            const previousUserSelect = document.body.style.userSelect;
            const previousCursor = document.body.style.cursor;
            document.body.style.userSelect = 'none';
            document.body.style.cursor =
                axis === 'width' ? 'ew-resize' : axis === 'height' ? 'ns-resize' : 'nwse-resize';
            userResizedRef.current = true;

            const onPointerMove = (pointerEvent: PointerEvent) => {
                updateDialogSize({
                    width:
                        axis === 'height'
                            ? initial.width
                            : initial.width + (pointerEvent.clientX - startX) * 2,
                    height:
                        axis === 'width'
                            ? initial.height
                            : initial.height + (pointerEvent.clientY - startY) * 2,
                });
            };
            const cleanup = () => {
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', cleanup);
                window.removeEventListener('pointercancel', cleanup);
                document.body.style.userSelect = previousUserSelect;
                document.body.style.cursor = previousCursor;
                resizeCleanupRef.current = null;
            };
            resizeCleanupRef.current = cleanup;
            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', cleanup);
            window.addEventListener('pointercancel', cleanup);
        },
        [dialogSize, isResizable, updateDialogSize, wide]
    );

    const resizeWithKeyboard = React.useCallback(
        (axis: ResizeAxis) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
            if (!isResizable || !dialogSize) return;
            const step = event.shiftKey ? 48 : 16;
            let widthDelta = 0;
            let heightDelta = 0;
            if (axis !== 'height' && event.key === 'ArrowLeft') widthDelta = -step;
            if (axis !== 'height' && event.key === 'ArrowRight') widthDelta = step;
            if (axis !== 'width' && event.key === 'ArrowUp') heightDelta = -step;
            if (axis !== 'width' && event.key === 'ArrowDown') heightDelta = step;
            if (widthDelta === 0 && heightDelta === 0) return;
            event.preventDefault();
            userResizedRef.current = true;
            updateDialogSize({
                width: dialogSize.width + widthDelta,
                height: dialogSize.height + heightDelta,
            });
        },
        [dialogSize, isResizable, updateDialogSize]
    );

    const portalTarget =
        typeof document !== 'undefined'
            ? renderInDocumentBody
                ? document.body
                : document.getElementById('scan-root') ?? document.body
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

    React.useEffect(() => {
        if (!isOpen) return undefined;
        resetAutoSize();
        const onWindowResize = () => {
            if (!userResizedRef.current) {
                setDialogSize(isResizable ? getAutoDetailSize(wide) : null);
                return;
            }
            setDialogSize((current) => {
                if (!current || window.innerWidth < DESKTOP_DIALOG_BREAKPOINT) return null;
                const bounds = getDialogBounds();
                return {
                    width: clamp(current.width, MIN_RESIZABLE_WIDTH, bounds.width),
                    height: clamp(current.height, MIN_RESIZABLE_HEIGHT, bounds.height),
                };
            });
        };
        window.addEventListener('resize', onWindowResize);
        return () => {
            window.removeEventListener('resize', onWindowResize);
            resizeCleanupRef.current?.();
        };
    }, [isOpen, isResizable, resetAutoSize, wide]);

    React.useEffect(() => {
        if (typeof window === 'undefined') return undefined;
        const onStorage = (event: StorageEvent) => {
            if (
                event.key !== userScopedStorageKey(BACKGROUND_VISIBILITY_STORAGE_KEY) &&
                event.key !== userScopedStorageKey(LEGACY_BACKDROP_OPACITY_STORAGE_KEY)
            ) {
                return;
            }
            setBackgroundVisibility(readBackgroundVisibility());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const updateBackgroundVisibility = React.useCallback(
        (event: React.FormEvent<HTMLInputElement>) => {
            const next = normalizeBackgroundVisibility(Number(event.currentTarget.value));
            setBackgroundVisibility(next);
            writeBackgroundVisibility(next);
        },
        []
    );

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

    const searchbaseAction = openInSearchbaseHref ? (
        <a
            href={openInSearchbaseHref}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${title} in Searchbase`}
            aria-label={`Open ${title} in Searchbase`}
            className={ACTION_CLASS}
        >
            Searchbase
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
    ) : null;

    const modalLayer = (
        <div
            className="fixed inset-0 z-[1900] flex items-center justify-center p-4 max-[719px]:items-end max-[719px]:p-0 max-[719px]:pt-4"
            data-workspace-modal-backdrop="true"
            data-background-visibility={backgroundVisibility}
            data-app-color-scheme={colorScheme}
            style={{
                zIndex: 1900,
                backgroundColor: `rgba(2, 6, 23, ${(100 - backgroundVisibility) / 100})`,
                backdropFilter: `blur(${((100 - backgroundVisibility) / 100) * 2}px)`,
                WebkitBackdropFilter: `blur(${((100 - backgroundVisibility) / 100) * 2}px)`,
            }}
        >
            <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="absolute inset-0 cursor-default border-0 sui-bg-transparent p-0"
                onClick={() => {
                    if (closeOnBackdrop) onCloseRef.current();
                }}
            />
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={subtitle ? generatedSubtitleId : undefined}
                tabIndex={-1}
                style={
                    isResizable && dialogSize
                        ? {
                              width: `${dialogSize.width}px`,
                              height: `${dialogSize.height}px`,
                              maxWidth: 'calc(100vw - 2rem)',
                              maxHeight: 'calc(100vh - 2rem)',
                          }
                        : undefined
                }
                className={cn(
                    'scd-workspace-modal-surface relative z-10 flex w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[4px] border sui-border-weak sui-color-active sui-shadow-overlay backdrop-blur-[75px] outline-none',
                    VARIANT_CLASS[variant],
                    variant === 'detail' && wide && 'max-w-[1320px]',
                    dialogClassName,
                    'max-[719px]:h-[calc(100vh-1rem)] max-[719px]:max-h-[calc(100vh-1rem)] max-[719px]:w-full max-[719px]:max-w-none max-[719px]:rounded-b-none max-[719px]:rounded-t-2xl'
                )}
            >
                <div className="scd-workspace-modal-header flex min-h-16 flex-shrink-0 items-center justify-between gap-4 border-b sui-border-weak py-2.5 pl-5 pr-4 backdrop-blur-xl">
                    <div className="min-w-0">
                        <h2
                            id={titleId}
                            className="truncate  font-bold leading-[19px] sui-color-default"
                        >
                            {title}
                        </h2>
                        {subtitle && (
                            <p
                                id={generatedSubtitleId}
                                className="mt-[3px] truncate text-xs font-normal leading-[15px] sui-color-default"
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                        {headerMeta && <div className="hidden items-center gap-2 lg:flex">{headerMeta}</div>}
                        <label
                            htmlFor={generatedBackgroundVisibilityId}
                            title="Choose how much of the dashboard remains visible behind this window"
                            className="hidden h-8 items-center gap-2 rounded-[6px] border sui-border-weak sui-bg-page px-2  font-semibold sui-color-default min-[720px]:flex"
                        >
                            <span>Background</span>
                            <input
                                id={generatedBackgroundVisibilityId}
                                type="range"
                                min={MIN_BACKGROUND_VISIBILITY}
                                max={MAX_BACKGROUND_VISIBILITY}
                                step={1}
                                value={backgroundVisibility}
                                onInput={updateBackgroundVisibility}
                                aria-label="Background visibility"
                                aria-valuetext={`${backgroundVisibility}% of background visible`}
                                className="h-1.5 w-20 cursor-pointer accent-sky-400"
                            />
                            <output
                                htmlFor={generatedBackgroundVisibilityId}
                                className="w-8 text-right font-mono  sui-color-default"
                            >
                                {backgroundVisibility}%
                            </output>
                        </label>
                        {searchAction}
                        {searchbaseAction}
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
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] sui-color-default transition-colors sui-hover-bg-section sui-hover-color-active focus:outline-none focus:ring-2 sui-focus-ring"
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
                {isResizable && (
                    <>
                        <button
                            type="button"
                            aria-label="Resize dialog width"
                            title="Drag to resize width · Arrow keys resize · Double-click resets"
                            onPointerDown={beginResize('width')}
                            onKeyDown={resizeWithKeyboard('width')}
                            onDoubleClick={resetAutoSize}
                            className="group absolute bottom-7 right-0 top-16 z-30 hidden w-2 cursor-ew-resize border-0 sui-bg-transparent p-0 focus:outline-none min-[720px]:block"
                        >
                            <span className="absolute bottom-1/3 right-0 h-16 w-1 rounded-l-full  transition-colors sui-group-hover-bg-info sui-bg-info" />
                        </button>
                        <button
                            type="button"
                            aria-label="Resize dialog height"
                            title="Drag to resize height · Arrow keys resize · Double-click resets"
                            onPointerDown={beginResize('height')}
                            onKeyDown={resizeWithKeyboard('height')}
                            onDoubleClick={resetAutoSize}
                            className="group absolute bottom-0 left-7 right-7 z-30 hidden h-2 cursor-ns-resize border-0 sui-bg-transparent p-0 focus:outline-none min-[720px]:block"
                        >
                            <span className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-t-full  transition-colors sui-group-hover-bg-info sui-bg-info" />
                        </button>
                        <button
                            type="button"
                            aria-label="Resize dialog width and height"
                            title="Drag to resize both directions · Arrow keys resize · Double-click resets"
                            onPointerDown={beginResize('both')}
                            onKeyDown={resizeWithKeyboard('both')}
                            onDoubleClick={resetAutoSize}
                            className="group absolute bottom-0 right-0 z-40 hidden h-7 w-7 cursor-nwse-resize border-0 sui-bg-transparent p-0 focus:outline-none min-[720px]:block"
                        >
                            <span className="absolute bottom-1.5 right-1.5 h-3.5 w-3.5 rounded-br-md border-b-2 border-r-2  transition-colors sui-group-hover-border-info sui-border-info" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(
        renderInDocumentBody ? (
            <div
                data-workspace-modal-portal="document"
                data-app-color-scheme={colorScheme}
                style={{ colorScheme }}
            >
                {modalLayer}
            </div>
        ) : (
            modalLayer
        ),
        portalTarget
    );
};
