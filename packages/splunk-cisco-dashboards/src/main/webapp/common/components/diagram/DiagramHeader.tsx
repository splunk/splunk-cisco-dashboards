/**
 * DiagramHeader — top bar for the Network Diagram page.
 *
 * Mirrors the typical "drawing app" header: app title on the
 * left, a diagram-name picker in the middle, and a cluster of
 * action buttons on the right (New, Open, Save, Save As, Delete).
 *
 * The header is presentational; persistence and dirty-state
 * tracking live in the parent page (`pages/network_diagram/
 * index.tsx`). The header just exposes callbacks for each action
 * and renders the picker dropdown when `availableDiagrams` is
 * provided.
 *
 * Save semantics:
 *   • The current `diagramName` is shown as the active name.
 *   • If `dirty` is true, an asterisk shows next to the name and
 *     the Save button has a sky tint to draw attention.
 *   • Save (no arg) calls `onSave()` against the active name —
 *     overwrites or creates.
 *   • Save As prompts the operator for a new name and calls
 *     `onSaveAs(newName)`.
 *   • Delete is hidden when the active diagram is unsaved (no
 *     name yet) or when the diagram doesn't exist server-side.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
    Network,
    Save,
    SaveAll,
    FolderOpen,
    FilePlus,
    Trash2,
    Loader2,
    ChevronDown,
    Type,
    Maximize2,
    Pencil,
    RotateCcw,
    Zap,
    ZapOff,
    Eye,
    EyeOff,
    Download,
    Pause,
    Search,
    X,
    AlertTriangle,
    RefreshCw,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';
// Build 115.11 — alias the helper so it doesn't collide with the
// boolean prop of the same name on this component (the picker
// already exposes a `isFactoryDiagram` flag for the active
// diagram). Using `isFactoryDiagramName` inside the picker
// dropdown keeps both readable and lets TypeScript narrow the
// prop without runtime ambiguity.
import {
    isFactoryDiagram as isFactoryDiagramName,
    type DiagramSummary,
} from '@/common/services/diagramPersistenceService';
import { APP_BUILD, APP_VERSION_LABEL } from '@/common/lib/buildInfo';

interface DiagramHeaderProps {
    /** Friendly name of the active diagram. `null` while a brand
     *  new diagram is being authored before its first Save. */
    diagramName: string | null;
    /** Whether the active diagram has unsaved changes. */
    dirty: boolean;
    /** Whether a save / load operation is in flight. */
    busy: boolean;
    /** All saved diagrams (lightweight directory). Drives the
     *  picker dropdown. `null` while loading the directory; an
     *  empty array means "no diagrams saved yet". */
    availableDiagrams: DiagramSummary[] | null;
    /** Whether the active diagram exists in the persisted
     *  directory (i.e. Delete is meaningful). */
    diagramExistsOnServer: boolean;
    /** Build 115.7 — whether the active diagram is one of the
     *  factory (OOB) diagrams shipped in
     *  `default/network_diagrams.conf`. Drives the Delete vs
     *  Revert affordance: factory diagrams without a local
     *  override can't be deleted (greyed out); factory diagrams
     *  WITH a local override expose a Revert button (clears the
     *  override, the OOB version reappears). */
    isFactoryDiagram: boolean;
    /** Build 115.7 — whether the active diagram has a stanza in
     *  the app's `local/` overlay (i.e. splunkd would accept a
     *  DELETE). Combined with `isFactoryDiagram` this lets the
     *  header render one of three Delete-button states without
     *  any branching at the call-site:
     *    • factory + !hasLocalOverride → "Delete" disabled.
     *    • factory +  hasLocalOverride → "Revert" (red).
     *    • custom  +  hasLocalOverride → "Delete".
     *  Defaults to true so unsaved drafts and pre-115.7 rows
     *  behave as before (Delete enabled). */
    hasLocalOverride: boolean;
    /** Last operation status (success or error message). The
     *  header renders info messages inline next to the picker
     *  and error messages as a wrapped banner below the header
     *  (Build 115.20). */
    statusMessage?: { kind: 'info' | 'error'; text: string } | null;
    /** Build 115.20 — invoked when the operator dismisses the
     *  current error banner via the X button. Errors are now
     *  sticky (no auto-dismiss) so the header needs an explicit
     *  way to clear them. Parent typically wires this to
     *  `setStatusMessage(null)`. */
    onDismissStatus?: () => void;
    /** Build 113: edit (default) vs read-only view/present mode. */
    mode: 'edit' | 'view';
    /** Build 113: whether the active diagram already has an
     *  on-canvas title. Toggles the Title button between "Add" and
     *  "Edit" labels. */
    hasTitle: boolean;
    onNew: () => void;
    onOpen: (name: string) => void;
    onSave: () => void;
    onSaveAs: (newName: string) => void;
    onDelete: () => void;
    onRefreshDirectory: () => void;
    /** Build 113: invoked when the operator clicks the Title button.
     *  Parent forwards to the canvas's `addOrSelectTitle` handle. */
    onAddOrSelectTitle: () => void;
    /** Build 113: switch between edit and view (presentation) mode.
     *  Parent is responsible for the fullscreen API call; the
     *  header just emits the mode change. */
    onModeChange: (mode: 'edit' | 'view') => void;
    /** Build 115.10 — light/dark theme toggle. Optional so callers
     *  that don't care about theming (tests, future embeds) keep
     *  working without breakage. When provided, the header
     *  renders the same `ThemeToggle` pill the overview dashboard
     *  uses so the operator gets one consistent affordance across
     *  pages. */
    themeSlot?: React.ReactNode;
    /** Build 115.12 — page-level animation kill switch. Operators
     *  asked for a quick way to pause every flowing dot /
     *  marching-ants effect on busy diagrams (e.g. while
     *  presenting). The page owns the boolean (persisted to
     *  localStorage), this header just hosts the affordance. */
    animationsEnabled?: boolean;
    onToggleAnimations?: () => void;
    /** Build 115.13 — page-level IP-address visibility toggle.
     *  Lets operators hide every device IP before sharing the
     *  diagram screenshot with an audience that shouldn't see
     *  internal addressing. Same plumbing pattern as the
     *  animations toggle: the page owns the boolean (persisted
     *  to localStorage), the header renders the eye / eye-off
     *  pill, the canvas reads the value via context. */
    ipAddressesVisible?: boolean;
    onToggleIpAddresses?: () => void;
    /** Build 115.13 — diagram export. Wires the header's "Save
     *  as PNG / Save as PDF" dropdown to whatever capture target
     *  the page chose (typically the canvas wrapper, mirroring
     *  the overview dashboard). The hook itself lives at the
     *  page level so the captured DOM stays referentially
     *  stable and the busy spinner here can read directly off
     *  the same `exporting` flag. */
    onExport?: (format: 'png' | 'pdf') => void;
    exporting?: boolean;
}

const NAME_PROMPT =
    'Save as: enter a diagram name (1–64 letters, digits, spaces, dots, hyphens or underscores)';

export const DiagramHeader: React.FC<DiagramHeaderProps> = ({
    diagramName,
    dirty,
    busy,
    availableDiagrams,
    diagramExistsOnServer,
    isFactoryDiagram,
    hasLocalOverride,
    statusMessage,
    onDismissStatus,
    mode,
    hasTitle,
    onNew,
    onOpen,
    onSave,
    onSaveAs,
    onDelete,
    onRefreshDirectory,
    onAddOrSelectTitle,
    onModeChange,
    themeSlot,
    animationsEnabled,
    onToggleAnimations,
    ipAddressesVisible,
    onToggleIpAddresses,
    onExport,
    exporting,
}) => {
    const [pickerOpen, setPickerOpen] = useState<boolean>(false);
    /** Build 115.14 — picker filter. Plain case-insensitive
     *  substring match against `DiagramSummary.name`. Reset to
     *  empty on every open so a stale query doesn't surprise an
     *  operator returning to the picker, and bound to a ref so
     *  the input takes focus the moment the dropdown opens —
     *  operators can start typing immediately without a click. */
    const [pickerQuery, setPickerQuery] = useState<string>('');
    const pickerInputRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        if (!pickerOpen) return undefined;
        setPickerQuery('');
        // Defer focus a tick so the input is mounted before we
        // try to focus it (the dropdown wraps in a conditional
        // render, so the DOM node doesn't exist on the same
        // microtask the state change fires on).
        const id = window.setTimeout(() => {
            pickerInputRef.current?.focus();
        }, 0);
        return () => window.clearTimeout(id);
    }, [pickerOpen]);
    const isViewMode = mode === 'view';

    const handleSaveAsClick = (): void => {
        const initial = diagramName ?? '';
        // We use the browser prompt for the v1 — minimal,
        // accessible-by-default, no extra UI surface to debug.
        // A bespoke modal can drop in later if the prompt UX
        // wears out its welcome.
        const name = window.prompt(NAME_PROMPT, initial);
        if (!name) return;
        onSaveAs(name.trim());
    };

    /** Build 115.7 — three-state action handler.
     *  • Factory + override → confirm copy mentions the revert,
     *    not deletion (the OOB version comes back).
     *  • Factory + !override → header should never invoke this
     *    (button is disabled), but bail defensively just in case.
     *  • Custom → existing "Delete … This cannot be undone." flow. */
    const handleDeleteClick = (): void => {
        if (!diagramName) return;
        if (isFactoryDiagram && !hasLocalOverride) return;
        const message =
            isFactoryDiagram && hasLocalOverride
                ? `Revert "${diagramName}" to its factory copy? Your local customizations will be discarded.`
                : `Delete diagram "${diagramName}"? This cannot be undone.`;
        const confirm = window.confirm(message);
        if (!confirm) return;
        onDelete();
    };

    const handlePickerToggle = (): void => {
        if (!pickerOpen) onRefreshDirectory();
        setPickerOpen((prev) => !prev);
    };

    const handlePickerSelect = (name: string): void => {
        setPickerOpen(false);
        if (name === diagramName) return;
        onOpen(name);
    };

    /** Build 115.14 — keyboard handling for the picker search box.
     *  Two convenience bindings:
     *    • Esc      — clear the query if non-empty, otherwise
     *                 close the picker. Standard "incremental
     *                 search" semantics.
     *    • Enter    — auto-open the diagram when exactly one
     *                 result remains. With a long picker (15+
     *                 factory diagrams) the operator can type
     *                 a few unique letters and just press Enter
     *                 instead of mousing onto the row. Multiple
     *                 matches → no-op (don't pick the first
     *                 alphabetical, that surprises operators
     *                 who haven't yet narrowed). */
    const handlePickerSearchKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>
    ): void => {
        if (e.key === 'Escape') {
            if (pickerQuery.length > 0) {
                e.preventDefault();
                setPickerQuery('');
                return;
            }
            setPickerOpen(false);
            return;
        }
        if (e.key === 'Enter') {
            const q = pickerQuery.trim().toLowerCase();
            if (q.length === 0 || !availableDiagrams) return;
            const matched = availableDiagrams.filter((d) =>
                d.name.toLowerCase().includes(q)
            );
            if (matched.length === 1) {
                e.preventDefault();
                handlePickerSelect(matched[0].name);
            }
        }
    };

    /** Build 115.20 — detect stale-CSRF errors so the banner
     *  below can offer a one-click "Reload page" button.
     *
     *  We re-run the same heuristic that
     *  `diagramPersistenceService#friendlyMessage` already uses
     *  for the message body: any error that mentions "session
     *  token is stale" or "CSRF validation failed" came out of
     *  the Splunk auth layer and is fixed by reloading splunkweb
     *  (which sets a fresh `splunkweb_csrf_token_<port>` cookie).
     *  We don't try to introspect the original Error object here
     *  — by the time the message reaches the header it's a plain
     *  string, and a string match is cheap and keeps the header
     *  decoupled from the persistence service.
     *
     *  Note: we deliberately do NOT auto-reload. Operators may
     *  have unsaved on-canvas annotations they want to copy
     *  before the reload; the banner says so explicitly. */
    const isCsrfError =
        statusMessage?.kind === 'error' &&
        /stale|csrf/i.test(statusMessage.text);

    return (
        <>
        <header className="flex items-center justify-between gap-4 px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative">
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex-shrink-0">
                    <Network className="w-5 h-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-base font-semibold tracking-tight truncate">
                            Network Diagram
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePickerToggle}
                            className={cn(
                                'flex items-center gap-1.5 px-2 py-0.5 rounded text-xs',
                                'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
                                'text-slate-700 dark:text-slate-300'
                            )}
                            title="Switch diagrams"
                        >
                            <span className="font-medium">
                                {diagramName ?? 'Untitled diagram'}
                            </span>
                            {dirty && (
                                <span
                                    className="text-amber-500 dark:text-amber-400"
                                    title="Unsaved changes"
                                >
                                    •
                                </span>
                            )}
                            <ChevronDown className="w-3 h-3 opacity-60" aria-hidden />
                        </button>
                        <span
                            className={cn(
                                'hidden sm:inline-flex items-center h-5 px-1.5 rounded',
                                'border border-slate-200 dark:border-slate-700',
                                'bg-slate-50 dark:bg-slate-800',
                                'font-mono text-[10px] text-slate-500 dark:text-slate-400',
                                'select-none flex-shrink-0'
                            )}
                            title={APP_VERSION_LABEL}
                            aria-label={APP_VERSION_LABEL}
                        >
                            Build {APP_BUILD}
                        </span>
                        {/* Build 115.20 — only INFO toasts render
                         *  inline next to the picker.
                         *
                         *  Error toasts are rendered below the header
                         *  as a wrapped banner (see end of this
                         *  component). The old inline rendering used
                         *  `truncate`, which clipped the operator
                         *  advice mid-sentence on long errors:
                         *
                         *    "...stale (HTTP 401 ... CSRF validation
                         *     failed.). Rel..."
                         *
                         *  An operator hitting that screenshot in the
                         *  field literally couldn't tell that the next
                         *  word was "Reload" — the action they need to
                         *  take to recover. Errors deserve full text +
                         *  a CTA, not 10px ellipsis. Info toasts (e.g.
                         *  "Saved 'foo' at 3:21:05 PM") fit fine on a
                         *  single line and stay where they were. */}
                        {statusMessage && statusMessage.kind === 'info' && (
                            <span className="text-[10px] truncate text-slate-500 dark:text-slate-400">
                                {statusMessage.text}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Action buttons.
             *  Build 113: in view mode we collapse the cluster down to
             *  a single "Exit view" button — the rest are editing
             *  affordances that wouldn't make sense in presentation
             *  mode. Pressing Esc also exits (handled by the parent
             *  page's fullscreenchange listener), so this is a
             *  belt-and-suspenders for users not on a keyboard. */}
            <div className="flex items-center gap-1.5">
                {isViewMode ? (
                    <HeaderButton
                        icon={Pencil}
                        label="Exit view (Esc)"
                        onClick={() => onModeChange('edit')}
                        accent
                        title="Return to edit mode"
                    />
                ) : (
                    <>
                        <HeaderButton
                            icon={FilePlus}
                            label="New"
                            onClick={onNew}
                            title="Start a blank diagram"
                        />
                        {/* Build 113: Title button — adds an on-canvas
                         *  headline when none exists yet, or selects the
                         *  existing one so it can be re-styled. */}
                        <HeaderButton
                            icon={Type}
                            label={hasTitle ? 'Edit title' : 'Add title'}
                            onClick={onAddOrSelectTitle}
                            title={
                                hasTitle
                                    ? 'Select the diagram title to re-style it'
                                    : 'Insert a draggable on-canvas headline'
                            }
                        />
                        <HeaderButton
                            icon={Save}
                            label="Save"
                            onClick={onSave}
                            disabled={busy || !diagramName}
                            accent={dirty}
                            title={
                                diagramName
                                    ? 'Save the current diagram'
                                    : 'Pick a name with Save As to save'
                            }
                        />
                        <HeaderButton
                            icon={SaveAll}
                            label="Save As"
                            onClick={handleSaveAsClick}
                            disabled={busy}
                            title="Save this diagram under a new name"
                        />
                        {/* Build 115.7 — Delete vs Revert.
                         *
                         *   isFactoryDiagram && hasLocalOverride:
                         *     Show "Revert" with a rotate-back icon.
                         *     Click clears the local stanza so the
                         *     factory version reappears.
                         *
                         *   isFactoryDiagram && !hasLocalOverride:
                         *     Show "Delete" but disabled with a
                         *     tooltip explaining why — splunkd's
                         *     conf REST won't remove default-shipped
                         *     stanzas, so the click would be a no-op.
                         *
                         *   Custom diagrams: regular Delete behaviour.
                         *
                         *   `diagramExistsOnServer` still gates
                         *   the unsaved-draft case (no row yet → no
                         *   action). */}
                        {isFactoryDiagram && hasLocalOverride ? (
                            <HeaderButton
                                icon={RotateCcw}
                                label="Revert"
                                onClick={handleDeleteClick}
                                disabled={busy || !diagramExistsOnServer}
                                danger
                                title="Revert this factory diagram to its OOB copy by clearing local customizations"
                            />
                        ) : (
                            <HeaderButton
                                icon={Trash2}
                                label="Delete"
                                onClick={handleDeleteClick}
                                disabled={
                                    busy ||
                                    !diagramExistsOnServer ||
                                    (isFactoryDiagram && !hasLocalOverride)
                                }
                                danger
                                title={
                                    isFactoryDiagram && !hasLocalOverride
                                        ? 'Factory diagram — nothing to delete. Save changes first if you want to customize it.'
                                        : 'Delete this diagram from the server'
                                }
                            />
                        )}
                        {/* A thin visual divider between the file/title
                         *  cluster and the Present button so the latter
                         *  reads as a separate "mode switch" affordance. */}
                        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                        {/* Build 113: Present button — switches the
                         *  canvas to read-only view mode and the parent
                         *  page enters fullscreen. */}
                        <HeaderButton
                            icon={Maximize2}
                            label="Present"
                            onClick={() => onModeChange('view')}
                            disabled={busy}
                            title="Open the diagram full-screen as a read-only view"
                        />
                        {/* Build 115.12 — animations kill switch. Lives
                         *  next to the theme toggle so the two
                         *  presentation-time controls cluster
                         *  together. Icon: Zap when on (canvas is
                         *  alive), ZapOff when paused. */}
                        {onToggleAnimations && (
                            <>
                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                                <button
                                    type="button"
                                    onClick={onToggleAnimations}
                                    aria-pressed={animationsEnabled !== false}
                                    title={
                                        animationsEnabled !== false
                                            ? 'Animations are ON — click to pause flowing dots and live-status dashes.'
                                            : 'Animations are OFF — click to resume flowing dots and live-status dashes.'
                                    }
                                    className={cn(
                                        'inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                                        animationsEnabled !== false
                                            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-amber-500 hover:border-slate-300 dark:hover:border-slate-600'
                                            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                                    )}
                                >
                                    {animationsEnabled !== false ? (
                                        <Zap className="w-3.5 h-3.5" aria-hidden />
                                    ) : (
                                        <ZapOff className="w-3.5 h-3.5" aria-hidden />
                                    )}
                                </button>
                            </>
                        )}
                        {/* Build 115.13 — IP visibility toggle. Sits in
                         *  the same presentation-time cluster as the
                         *  animations toggle. Eye = visible, EyeOff =
                         *  redacted. Used right before sharing the
                         *  diagram with an audience that shouldn't
                         *  see internal addressing. */}
                        {onToggleIpAddresses && (
                            <button
                                type="button"
                                onClick={onToggleIpAddresses}
                                aria-pressed={ipAddressesVisible !== false}
                                title={
                                    ipAddressesVisible !== false
                                        ? 'IP addresses are visible — click to hide every IP for sharing.'
                                        : 'IP addresses are hidden — click to reveal every IP again.'
                                }
                                className={cn(
                                    'inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                                    ipAddressesVisible !== false
                                        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-sky-500 hover:border-slate-300 dark:hover:border-slate-600'
                                        : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400 hover:border-slate-400 dark:hover:border-slate-500'
                                )}
                            >
                                {ipAddressesVisible !== false ? (
                                    <Eye className="w-3.5 h-3.5" aria-hidden />
                                ) : (
                                    <EyeOff className="w-3.5 h-3.5" aria-hidden />
                                )}
                            </button>
                        )}
                        {/* Build 115.13 — Save-to-PNG / Save-to-PDF
                         *  dropdown. Same hover-to-open pattern the
                         *  overview dashboard uses, so operators get
                         *  a familiar Download glyph that expands
                         *  into the two format choices. We disable
                         *  the trigger while a capture is in flight
                         *  to prevent multiple concurrent renders. */}
                        {onExport && (
                            <div className="relative group">
                                <button
                                    type="button"
                                    disabled={exporting === true}
                                    title="Save the diagram as PNG or PDF"
                                    aria-busy={exporting === true}
                                    className={cn(
                                        'inline-flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
                                        'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600',
                                        'disabled:opacity-50 disabled:cursor-wait'
                                    )}
                                >
                                    {exporting === true ? (
                                        <Pause
                                            className="w-3.5 h-3.5 animate-pulse"
                                            aria-hidden
                                        />
                                    ) : (
                                        <Download className="w-3.5 h-3.5" aria-hidden />
                                    )}
                                </button>
                                {/* Build 115.16 — split the menu into an
                                 *  outer "hover catcher" (with `pt-1`
                                 *  internal padding) and an inner
                                 *  visual panel. The catcher's bounding
                                 *  box now starts right at the
                                 *  trigger's bottom edge with no
                                 *  margin gap, so the cursor never
                                 *  leaves the `.group` container while
                                 *  travelling from the trigger down to
                                 *  the menu — fixing the "the menu
                                 *  escapes from me weirdly when I try
                                 *  to select PNG" report. The 4px of
                                 *  visible breathing room moves from
                                 *  `mt-1` (margin, outside the
                                 *  hover area) to `pt-1` (padding,
                                 *  inside the hover area). */}
                                <div className="absolute right-0 top-full pt-1 hidden group-hover:block group-focus-within:block z-50 w-32">
                                    <div className="flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => onExport('png')}
                                            disabled={exporting === true}
                                            className="px-3 py-1.5 text-[11px] text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 disabled:opacity-50"
                                        >
                                            Save as PNG
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onExport('pdf')}
                                            disabled={exporting === true}
                                            className="px-3 py-1.5 text-[11px] text-left font-semibold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-slate-800 border-t border-slate-100 dark:border-slate-700 disabled:opacity-50"
                                        >
                                            Save as PDF
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {themeSlot && (
                            <>
                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />
                                {themeSlot}
                            </>
                        )}
                    </>
                )}
                {busy && (
                    <Loader2
                        className="w-4 h-4 animate-spin text-slate-400 ml-1"
                        aria-hidden
                    />
                )}
            </div>

            {/* Picker dropdown.
             *  Build 115.11 — wider (288 → 384px) so the longer
             *  factory diagram names (e.g. "Distributed Clustered
             *  with SHC Single Site - C3 C13") fit without
             *  truncation, and grouped under collapsible Factory
             *  / Custom headings so operators can quickly tell
             *  which diagrams ship with the app vs which they
             *  authored. The factory list comes from the canonical
             *  `FACTORY_DIAGRAM_NAMES` registry in
             *  `diagramPersistenceService.ts`; anything else is
             *  considered custom. */}
            {pickerOpen && (
                <div
                    role="listbox"
                    className={cn(
                        'absolute top-full left-16 mt-1 z-30 w-96 max-w-[90vw] max-h-[70vh] overflow-auto rounded-lg shadow-lg',
                        'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'
                    )}
                >
                    <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        <span>Saved diagrams</span>
                        <button
                            type="button"
                            onClick={() => {
                                setPickerOpen(false);
                                onNew();
                            }}
                            className="flex items-center gap-1 text-sky-600 dark:text-sky-400 normal-case tracking-normal text-[11px] hover:underline"
                        >
                            <FilePlus className="w-3 h-3" aria-hidden />
                            New
                        </button>
                    </div>
                    {/* Build 115.14 — quick-filter row. Skipped while
                     *  the directory is loading or empty (nothing to
                     *  search), and pinned at the top of the
                     *  scrollable list so a long match list still
                     *  shows the input as the operator scrolls. */}
                    {availableDiagrams && availableDiagrams.length > 0 && (
                        <div className="sticky top-0 z-10 px-2 py-1.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <Search
                                    className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400"
                                    aria-hidden
                                />
                                <input
                                    ref={pickerInputRef}
                                    type="text"
                                    value={pickerQuery}
                                    onChange={(e) => setPickerQuery(e.target.value)}
                                    onKeyDown={handlePickerSearchKeyDown}
                                    placeholder="Search diagrams…"
                                    autoComplete="off"
                                    spellCheck={false}
                                    aria-label="Filter saved diagrams by name"
                                    className={cn(
                                        'w-full pl-7 pr-7 py-1 text-xs rounded-md',
                                        'bg-white dark:bg-slate-800',
                                        'border border-slate-200 dark:border-slate-700',
                                        'text-slate-900 dark:text-slate-100',
                                        'placeholder:text-slate-400 dark:placeholder:text-slate-500',
                                        'focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-400'
                                    )}
                                />
                                {pickerQuery.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPickerQuery('');
                                            pickerInputRef.current?.focus();
                                        }}
                                        title="Clear search (Esc)"
                                        aria-label="Clear search"
                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    >
                                        <X className="w-3 h-3" aria-hidden />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {availableDiagrams === null && (
                        <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                            Loading…
                        </div>
                    )}
                    {availableDiagrams && availableDiagrams.length === 0 && (
                        <p className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                            No saved diagrams yet. Use Save As to create one.
                        </p>
                    )}
                    {availableDiagrams && availableDiagrams.length > 0 && (() => {
                        // Build 115.11 — partition once per render, sort
                        // by name (case-insensitive) inside each group so
                        // alphabetical scanning matches what operators
                        // expect from a "saved files" list.
                        // Build 115.14 — and filter by the picker's
                        // search query (plain substring, case-
                        // insensitive). Empty query keeps everything;
                        // non-empty narrows both the factory and
                        // custom groups simultaneously and the
                        // section headers reflect the filtered count.
                        const q = pickerQuery.trim().toLowerCase();
                        const matchesQuery = (d: DiagramSummary): boolean =>
                            q.length === 0 || d.name.toLowerCase().includes(q);
                        const factory = availableDiagrams
                            .filter(
                                (d) =>
                                    isFactoryDiagramName(d.name) && matchesQuery(d)
                            )
                            .sort((a, b) =>
                                a.name.localeCompare(b.name, undefined, {
                                    sensitivity: 'base',
                                })
                            );
                        const custom = availableDiagrams
                            .filter(
                                (d) =>
                                    !isFactoryDiagramName(d.name) && matchesQuery(d)
                            )
                            .sort((a, b) =>
                                a.name.localeCompare(b.name, undefined, {
                                    sensitivity: 'base',
                                })
                            );
                        const renderRow = (d: DiagramSummary) => (
                            <li key={d.name}>
                                <button
                                    type="button"
                                    onClick={() => handlePickerSelect(d.name)}
                                    className={cn(
                                        'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left text-xs',
                                        d.name === diagramName
                                            ? 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200'
                                    )}
                                    title={d.name}
                                >
                                    <span className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <FolderOpen
                                            className="w-3 h-3 flex-shrink-0 opacity-60"
                                            aria-hidden
                                        />
                                        {/* Build 115.11 — drop `truncate`,
                                         *  use `break-words` so long names
                                         *  wrap onto a second line instead
                                         *  of getting clipped. */}
                                        <span className="font-medium break-words flex-1">
                                            {d.name}
                                        </span>
                                    </span>
                                    <span className="text-[9px] text-slate-400 flex-shrink-0 whitespace-nowrap">
                                        {d.updatedAt
                                            ? new Date(d.updatedAt).toLocaleString()
                                            : ''}
                                    </span>
                                </button>
                            </li>
                        );
                        return (
                            <>
                                {/* Build 115.14 — empty-result line
                                 *  when a query is typed but neither
                                 *  group has a hit. We deliberately
                                 *  render only this row (no Default /
                                 *  Custom headings) so the dropdown
                                 *  doesn't flash empty section
                                 *  scaffolding while the operator is
                                 *  mid-typing. */}
                                {q.length > 0 &&
                                    factory.length === 0 &&
                                    custom.length === 0 && (
                                        <p className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                                            No diagrams match{' '}
                                            <span className="font-mono">
                                                "{pickerQuery}"
                                            </span>
                                            .
                                        </p>
                                    )}
                                {factory.length > 0 && (
                                    <>
                                        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                            <FolderOpen
                                                className="w-3 h-3 opacity-70"
                                                aria-hidden
                                            />
                                            Default ({factory.length})
                                        </div>
                                        <ul className="py-0.5">
                                            {factory.map(renderRow)}
                                        </ul>
                                    </>
                                )}
                                {custom.length > 0 && (
                                    <>
                                        <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 mt-1 flex items-center gap-1.5">
                                            <FolderOpen
                                                className="w-3 h-3 opacity-70"
                                                aria-hidden
                                            />
                                            Custom ({custom.length})
                                        </div>
                                        <ul className="py-0.5">
                                            {custom.map(renderRow)}
                                        </ul>
                                    </>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </header>

        {/* Build 115.20 — error banner with full wrapped text +
         *  CTA. Lives outside the <header> so its height grows
         *  freely without disturbing the picker / action-button
         *  layout above. The operator never has to play hide-
         *  and-seek with an ellipsis to figure out the recovery
         *  step. */}
        {statusMessage?.kind === 'error' && (
            <div
                role="alert"
                className={cn(
                    'flex items-start gap-3 px-6 py-2.5 border-b',
                    'bg-rose-50 dark:bg-rose-950/40',
                    'border-rose-200 dark:border-rose-900/60',
                    'text-rose-800 dark:text-rose-200'
                )}
            >
                <AlertTriangle
                    className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-600 dark:text-rose-400"
                    aria-hidden
                />
                <div className="flex-1 min-w-0 text-xs leading-relaxed">
                    {statusMessage.text}
                </div>
                {isCsrfError && (
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium',
                            'bg-rose-600 hover:bg-rose-700 text-white',
                            'dark:bg-rose-500 dark:hover:bg-rose-600',
                            'transition-colors flex-shrink-0'
                        )}
                        title="Reload the page to refresh the CSRF cookie"
                    >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden />
                        Reload page
                    </button>
                )}
                {onDismissStatus && (
                    <button
                        type="button"
                        onClick={onDismissStatus}
                        className={cn(
                            'p-1 rounded flex-shrink-0',
                            'text-rose-700 dark:text-rose-300',
                            'hover:bg-rose-100 dark:hover:bg-rose-900/40',
                            'transition-colors'
                        )}
                        aria-label="Dismiss error"
                        title="Dismiss"
                    >
                        <X className="w-3.5 h-3.5" aria-hidden />
                    </button>
                )}
            </div>
        )}
        </>
    );
};

interface HeaderButtonProps {
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    label: string;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
    accent?: boolean;
    danger?: boolean;
}

const HeaderButton: React.FC<HeaderButtonProps> = ({
    icon: Icon,
    label,
    onClick,
    disabled,
    title,
    accent,
    danger,
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            !disabled && accent
                ? 'bg-sky-500 hover:bg-sky-600 text-white border-sky-600'
                : !disabled && danger
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
        )}
    >
        <Icon className="w-3.5 h-3.5" aria-hidden />
        {label}
    </button>
);
