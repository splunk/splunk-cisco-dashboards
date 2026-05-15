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

import React, { useState } from 'react';
import {
    Network,
    Save,
    SaveAll,
    FolderOpen,
    FilePlus,
    Trash2,
    Loader2,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/common/lib/utils';
import type { DiagramSummary } from '@/common/services/diagramPersistenceService';

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
    /** Last operation status (success or error message). The
     *  header renders it as a transient line under the name. */
    statusMessage?: { kind: 'info' | 'error'; text: string } | null;
    onNew: () => void;
    onOpen: (name: string) => void;
    onSave: () => void;
    onSaveAs: (newName: string) => void;
    onDelete: () => void;
    onRefreshDirectory: () => void;
}

const NAME_PROMPT =
    'Save as: enter a diagram name (1–64 letters, digits, spaces, dots, hyphens or underscores)';

export const DiagramHeader: React.FC<DiagramHeaderProps> = ({
    diagramName,
    dirty,
    busy,
    availableDiagrams,
    diagramExistsOnServer,
    statusMessage,
    onNew,
    onOpen,
    onSave,
    onSaveAs,
    onDelete,
    onRefreshDirectory,
}) => {
    const [pickerOpen, setPickerOpen] = useState<boolean>(false);

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

    const handleDeleteClick = (): void => {
        if (!diagramName) return;
        const confirm = window.confirm(
            `Delete diagram "${diagramName}"? This cannot be undone.`
        );
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

    return (
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
                        {statusMessage && (
                            <span
                                className={cn(
                                    'text-[10px] truncate',
                                    statusMessage.kind === 'error'
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                )}
                            >
                                {statusMessage.text}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1.5">
                <HeaderButton
                    icon={FilePlus}
                    label="New"
                    onClick={onNew}
                    title="Start a blank diagram"
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
                <HeaderButton
                    icon={Trash2}
                    label="Delete"
                    onClick={handleDeleteClick}
                    disabled={busy || !diagramExistsOnServer}
                    danger
                    title="Delete this diagram from the server"
                />
                {busy && (
                    <Loader2
                        className="w-4 h-4 animate-spin text-slate-400 ml-1"
                        aria-hidden
                    />
                )}
            </div>

            {/* Picker dropdown */}
            {pickerOpen && (
                <div
                    role="listbox"
                    className={cn(
                        'absolute top-full left-16 mt-1 z-30 w-72 max-h-80 overflow-auto rounded-lg shadow-lg',
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
                    {availableDiagrams && availableDiagrams.length > 0 && (
                        <ul className="py-1">
                            {availableDiagrams.map((d) => (
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
                                    >
                                        <span className="flex items-center gap-1.5 min-w-0">
                                            <FolderOpen
                                                className="w-3 h-3 flex-shrink-0 opacity-60"
                                                aria-hidden
                                            />
                                            <span className="truncate font-medium">
                                                {d.name}
                                            </span>
                                        </span>
                                        <span className="text-[9px] text-slate-400 flex-shrink-0">
                                            {d.updatedAt
                                                ? new Date(d.updatedAt).toLocaleString()
                                                : ''}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </header>
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
