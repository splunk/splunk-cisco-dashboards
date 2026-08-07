import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Code2, X } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';

type SplPreviewTooltipAnchor = 'auto' | 'left' | 'right';

interface DragState {
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
}

interface SplPreviewTooltipProps {
    title: string;
    spl: string;
    footnote?: string;
    anchor?: SplPreviewTooltipAnchor;
    iconAriaLabel?: string;
    className?: string;
    iconClassName?: string;
    fontScale?: number;
    maxWidth?: number;
}

const SPL_COMMANDS = new Set([
    'append',
    'appendcols',
    'appendpipe',
    'bin',
    'chart',
    'collect',
    'dedup',
    'eval',
    'eventstats',
    'fields',
    'filldown',
    'fillnull',
    'head',
    'inputlookup',
    'join',
    'lookup',
    'makeresults',
    'makemv',
    'mvexpand',
    'outputlookup',
    'predict',
    'rename',
    'rex',
    'search',
    'sort',
    'spath',
    'stats',
    'streamstats',
    'table',
    'tail',
    'timechart',
    'tstats',
    'union',
    'where',
]);

const SPL_KEYWORDS = new Set([
    'and',
    'as',
    'by',
    'case',
    'coalesce',
    'earliest',
    'false',
    'if',
    'in',
    'isnotnull',
    'isnull',
    'latest',
    'like',
    'lower',
    'match',
    'max',
    'min',
    'not',
    'null',
    'or',
    'round',
    'sum',
    'tonumber',
    'tostring',
    'true',
    'values',
    'avg',
    'cidrmatch',
    'count',
    'first',
    'last',
    'len',
    'mvcount',
    'mvjoin',
    'relative_time',
    'replace',
    'split',
    'strftime',
    'strptime',
]);

const SPL_OPERATOR_KEYWORDS = new Set([
    'and',
    'as',
    'by',
    'from',
    'in',
    'or',
    'where',
]);

const POPOVER_MAX_WIDTH = 760;
const POPOVER_GAP = 8;
const VIEWPORT_PADDING = 12;
const SPLUNK_EDITOR_COLORS = {
    shell: '#11181c',
    editor: '#293135',
    border: '#00a4fd',
    borderSoft: '#52616b',
    text: '#d7dde2',
    muted: '#9aa6af',
    pipe: '#7f8b96',
    command: '#5da7ff',
    function: '#cf6edc',
    logical: '#f6a23b',
    string: '#5fd6a5',
    macro: '#d6b34b',
    number: '#f19f5d',
    operator: '#f0a04b',
    field: '#d2d8dd',
} as const;

interface TooltipCoords {
    left: number;
    top: number;
    width: number;
}

const popoverWidth = (maxWidth = POPOVER_MAX_WIDTH): number =>
    Math.min(
        maxWidth,
        Math.max(240, window.innerWidth - VIEWPORT_PADDING * 2)
    );

const computeCoords = (
    rect: DOMRect,
    anchor: SplPreviewTooltipAnchor,
    popoverHeight: number,
    maxWidth?: number
): TooltipCoords => {
    const width = popoverWidth(maxWidth);
    let left: number;
    if (anchor === 'left') {
        left = rect.left;
    } else if (anchor === 'right') {
        left = rect.right - width;
    } else {
        left = rect.left + rect.width / 2 - width / 2;
    }
    left = Math.max(
        VIEWPORT_PADDING,
        Math.min(left, window.innerWidth - width - VIEWPORT_PADDING)
    );

    let top = rect.bottom + POPOVER_GAP;
    if (popoverHeight > 0 && top + popoverHeight > window.innerHeight - VIEWPORT_PADDING) {
        top = Math.max(VIEWPORT_PADDING, rect.top - POPOVER_GAP - popoverHeight);
    }

    return { left, top, width };
};

const clampPopoverPosition = (
    left: number,
    top: number,
    width: number,
    height: number
): Pick<TooltipCoords, 'left' | 'top'> => ({
    left: Math.max(
        VIEWPORT_PADDING,
        Math.min(left, window.innerWidth - width - VIEWPORT_PADDING)
    ),
    top: Math.max(
        VIEWPORT_PADDING,
        Math.min(top, window.innerHeight - height - VIEWPORT_PADDING)
    ),
});

const renderSplLine = (line: string, lineIndex: number): React.ReactNode[] => {
    const pattern =
        /(`[^`]*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\|\s*[A-Za-z_][A-Za-z0-9_]*|\b\d+(?:\.\d+)?\b|\b[A-Za-z_][A-Za-z0-9_.:{}-]*\b|!=|>=|<=|=|>|<|\+|-|\*|\/)/g;
    const parts = line.split(pattern);

    return parts.map((part, partIndex) => {
        if (!part) return null;
        const key = `spl-${lineIndex}-${partIndex}`;

        if (part.startsWith('`') && part.endsWith('`')) {
            return (
                <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.macro }}>
                    {part}
                </span>
            );
        }

        if (
            (part.startsWith('"') && part.endsWith('"')) ||
            (part.startsWith("'") && part.endsWith("'"))
        ) {
            return (
                <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.string }}>
                    {part}
                </span>
            );
        }

        if (part.startsWith('|')) {
            const command = part.slice(1).trim();
            return (
                <React.Fragment key={key}>
                    <span style={{ color: SPLUNK_EDITOR_COLORS.pipe }}>|</span>
                    {command ? (
                        <>
                            {' '}
                            <span style={{ color: SPLUNK_EDITOR_COLORS.command }}>
                                {command}
                            </span>
                        </>
                    ) : null}
                </React.Fragment>
            );
        }

        if (/^\d+(?:\.\d+)?$/.test(part)) {
            return (
                <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.number }}>
                    {part}
                </span>
            );
        }

        if (/^(?:!=|>=|<=|=|>|<|\+|-|\*|\/)$/.test(part)) {
            return (
                <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.operator }}>
                    {part}
                </span>
            );
        }

        const normalized = part.toLowerCase();
        if (SPL_OPERATOR_KEYWORDS.has(normalized)) {
            return (
                <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.logical }}>
                    {part}
                </span>
            );
        }

        if (SPL_COMMANDS.has(normalized)) {
            return (
                <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.command }}>
                    {part}
                </span>
            );
        }

        if (SPL_KEYWORDS.has(normalized)) {
            return (
                <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.function }}>
                    {part}
                </span>
            );
        }

        if (part.includes('.') || part.includes(':')) {
            return (
                <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.field }}>
                    {part}
                </span>
            );
        }

        return (
            <span key={key} style={{ color: SPLUNK_EDITOR_COLORS.text }}>
                {part}
            </span>
        );
    });
};

const renderSplBlock = (spl: string): React.ReactNode => {
    const lines = spl.split('\n');
    return lines.map((line, lineIndex) => (
        <React.Fragment key={`spl-line-${lineIndex}`}>
            {renderSplLine(line, lineIndex)}
            {lineIndex < lines.length - 1 ? '\n' : null}
        </React.Fragment>
    ));
};

export const SplPreviewTooltip: React.FC<SplPreviewTooltipProps> = ({
    title,
    spl,
    footnote,
    anchor = 'auto',
    iconAriaLabel = 'Show SPL preview',
    className,
    iconClassName,
    fontScale = 1,
    maxWidth = POPOVER_MAX_WIDTH,
}) => {
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<DragState | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState<TooltipCoords | null>(null);
    const [manualCoords, setManualCoords] = useState<Pick<
        TooltipCoords,
        'left' | 'top'
    > | null>(null);
    const highlightedSpl = useMemo(() => renderSplBlock(spl), [spl]);

    const openTooltip = () => {
        dragRef.current = null;
        setCoords(null);
        setManualCoords(null);
        setIsOpen(true);
    };

    const closeTooltip = () => {
        dragRef.current = null;
        setIsOpen(false);
        setCoords(null);
        setManualCoords(null);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    const toggleTooltip = () => {
        if (isOpen) {
            closeTooltip();
            return;
        }
        openTooltip();
    };

    useEffect(() => {
        if (!isOpen) return undefined;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeTooltip();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen]);

    useLayoutEffect(() => {
        if (!isOpen || !triggerRef.current) return;
        if (manualCoords) return;
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const popoverHeight = popoverRef.current
            ? popoverRef.current.getBoundingClientRect().height
            : 0;
        setCoords(computeCoords(triggerRect, anchor, popoverHeight, maxWidth));
    }, [anchor, fontScale, isOpen, manualCoords, maxWidth, spl, title, footnote]);

    useEffect(() => {
        if (!isOpen) return undefined;

        const clampToViewport = () => {
            if (!popoverRef.current) return;
            const rect = popoverRef.current.getBoundingClientRect();
            setManualCoords((currentManualCoords) => {
                if (!currentManualCoords) return currentManualCoords;
                return clampPopoverPosition(
                    currentManualCoords.left,
                    currentManualCoords.top,
                    rect.width,
                    rect.height
                );
            });
            setCoords((currentCoords) => {
                if (!currentCoords || manualCoords) return currentCoords;
                return {
                    ...currentCoords,
                    ...clampPopoverPosition(
                        currentCoords.left,
                        currentCoords.top,
                        currentCoords.width,
                        rect.height
                    ),
                };
            });
        };

        window.addEventListener('resize', clampToViewport);
        return () => {
            window.removeEventListener('resize', clampToViewport);
        };
    }, [isOpen, manualCoords]);

    useEffect(() => {
        const onPointerMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            if (!drag || !popoverRef.current || !coords) return;

            const rect = popoverRef.current.getBoundingClientRect();
            const nextLeft = drag.startLeft + event.clientX - drag.startX;
            const nextTop = drag.startTop + event.clientY - drag.startY;
            setManualCoords(
                clampPopoverPosition(nextLeft, nextTop, coords.width, rect.height)
            );
        };

        const onPointerUp = () => {
            if (!dragRef.current) return;
            dragRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [coords]);

    const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!coords) return;
        event.preventDefault();
        event.stopPropagation();
        const startLeft = manualCoords?.left ?? coords.left;
        const startTop = manualCoords?.top ?? coords.top;
        dragRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            startLeft,
            startTop,
        };
        setManualCoords({ left: startLeft, top: startTop });
        document.body.style.cursor = 'move';
        document.body.style.userSelect = 'none';
    };

    const portalTarget =
        typeof document === 'undefined'
            ? null
            : document.getElementById('scan-root') ?? document.body;

    const popover =
        isOpen && portalTarget
            ? createPortal(
                  <div
                      ref={popoverRef}
                      role="dialog"
                      aria-label={`SPL preview for ${title}`}
                      style={{
                          position: 'fixed',
                          left: manualCoords?.left ?? coords?.left ?? -9999,
                          top: manualCoords?.top ?? coords?.top ?? -9999,
                          width: coords?.width ?? popoverWidth(maxWidth),
                          visibility: coords ? 'visible' : 'hidden',
                          backgroundColor: SPLUNK_EDITOR_COLORS.shell,
                          color: SPLUNK_EDITOR_COLORS.text,
                      }}
                      className="z-[9999] rounded-lg shadow-2xl ring-1 ring-black/40"
                  >
                      <div
                          onPointerDown={startDrag}
                          className="flex cursor-move items-center justify-between gap-3 rounded-t-lg border-b px-3 py-2"
                          style={{
                              backgroundColor: SPLUNK_EDITOR_COLORS.shell,
                              borderColor: SPLUNK_EDITOR_COLORS.borderSoft,
                          }}
                      >
                          <div className="min-w-0">
                              <p
                                  className="truncate text-xs font-bold"
                                  style={{ color: SPLUNK_EDITOR_COLORS.text }}
                              >
                                  SPL preview
                              </p>
                              <p
                                  className="truncate font-mono text-xs"
                                  style={{ color: SPLUNK_EDITOR_COLORS.muted }}
                              >
                                  {title}
                              </p>
                          </div>
                          <div className="flex flex-none items-center gap-2">
                              <Code2
                                  className="h-4 w-4"
                                  style={{ color: SPLUNK_EDITOR_COLORS.border }}
                              />
                              <button
                                  type="button"
                                  aria-label={`Close SPL preview for ${title}`}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={closeTooltip}
                                  className="rounded p-1 transition-colors hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-sky-300"
                                  style={{ color: SPLUNK_EDITOR_COLORS.muted }}
                              >
                                  <X className="h-3.5 w-3.5" />
                              </button>
                          </div>
                      </div>
                      <div
                          aria-label="SPL preview source"
                          className="max-h-[34rem] overflow-auto rounded-b-lg border px-3 py-3 font-mono text-[12.5px] leading-6"
                          style={{
                              backgroundColor: SPLUNK_EDITOR_COLORS.editor,
                              borderColor: SPLUNK_EDITOR_COLORS.border,
                              color: SPLUNK_EDITOR_COLORS.text,
                              textShadow: 'none',
                              fontSize: `${12.5 * fontScale}px`,
                              lineHeight: `${22 * fontScale}px`,
                          }}
                      >
                          <code
                              className="block whitespace-pre-wrap break-words bg-transparent p-0"
                              style={{ backgroundColor: 'transparent', color: 'inherit' }}
                          >
                              {spl.trim() ? (
                                  highlightedSpl
                              ) : (
                                  <span
                                      className="italic"
                                      style={{ color: SPLUNK_EDITOR_COLORS.muted }}
                                  >
                                      No SPL found for this search.
                                  </span>
                              )}
                          </code>
                      </div>
                      {footnote && (
                          <div
                              className="border-t px-3 py-2 font-mono text-xs"
                              style={{
                                  borderColor: SPLUNK_EDITOR_COLORS.borderSoft,
                                  color: SPLUNK_EDITOR_COLORS.muted,
                              }}
                          >
                              {footnote}
                          </div>
                      )}
                  </div>,
                  portalTarget
              )
            : null;

    return (
        <span
            data-tile-control="true"
            className={cn('relative inline-flex focus-within:outline-none', className)}
        >
            <button
                ref={triggerRef}
                type="button"
                aria-label={iconAriaLabel}
                aria-expanded={isOpen}
                aria-haspopup="dialog"
                onClick={toggleTooltip}
                className={cn(
                    'rounded p-0.5 -my-0.5 text-slate-400 transition-colors hover:text-sky-600 focus:text-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-400',
                    iconClassName
                )}
            >
                <Code2 className="h-3.5 w-3.5 stroke-[2.25px]" />
            </button>
            {popover}
        </span>
    );
};
