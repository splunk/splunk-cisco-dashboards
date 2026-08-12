import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@splunk/react-ui/Modal';
import { Copy, Plus, Save, Trash2 } from '@/common/icons/SuiIcon';

import {
    WORKSPACE_SOURCES,
    type InsightsWorkspace,
    type SectionId,
    type WorkspaceDefinitionInput,
    type WorkspaceId,
    type WorkspaceMapPosition,
    type WorkspaceRegionalView,
    type WorkspaceSourceId,
} from '@/common/config/insightsWorkspaces';
import {
    deleteInsightsWorkspace,
    saveInsightsWorkspace,
    type WorkspaceLayoutConfig,
} from '@/common/services/insightsWorkspaceService';
import { cn } from '@/common/lib/utils';

interface WorkspaceManagerProps {
    open: boolean;
    returnFocus: React.MutableRefObject<HTMLAnchorElement | HTMLButtonElement | null>;
    currentWorkspace: InsightsWorkspace;
    workspaces: readonly InsightsWorkspace[];
    layouts: Record<WorkspaceId, WorkspaceLayoutConfig>;
    onClose: () => void;
    onWorkspaceSaved: (workspaceId: WorkspaceId) => void;
    onWorkspaceDeleted: (workspaceId: WorkspaceId) => void;
}

interface WorkspaceDraft {
    id: string;
    label: string;
    sourceWorkspace: WorkspaceSourceId;
    sectionIds: SectionId[];
    headerTitle: string;
    headerSubtitle: string;
    defaultTileCount: number;
    sortOrder: number;
    mapVisible: boolean;
    mapPosition: WorkspaceMapPosition;
    regionalView: WorkspaceRegionalView;
    existingWorkspace?: InsightsWorkspace;
    layoutToCopy?: WorkspaceLayoutConfig;
}

const slugifyWorkspaceId = (raw: string): string => {
    const slug = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64);
    return /^[a-z]/.test(slug) ? slug : `workspace_${slug || 'new'}`;
};

const draftFromWorkspace = (
    workspace: InsightsWorkspace,
    layout?: WorkspaceLayoutConfig,
): WorkspaceDraft => ({
    id: workspace.id,
    label: workspace.label,
    sourceWorkspace: workspace.sourceWorkspace,
    sectionIds: workspace.sections.map((section) => section.id),
    headerTitle: workspace.headerTitle ?? '',
    headerSubtitle: workspace.headerSubtitle ?? '',
    defaultTileCount: workspace.fallbackTileCount,
    sortOrder: workspace.sortOrder,
    mapVisible: workspace.mapVisible,
    mapPosition: workspace.mapPosition,
    regionalView: workspace.regionalView,
    existingWorkspace: workspace,
    layoutToCopy: layout,
});

const emptyDraft = (sourceWorkspace: WorkspaceSourceId): WorkspaceDraft => {
    const source = WORKSPACE_SOURCES[sourceWorkspace];
    return {
        id: 'customer_demo',
        label: 'Customer Demo',
        sourceWorkspace,
        sectionIds: [...source.defaultSectionIds],
        headerTitle: 'Customer Demo',
        headerSubtitle: 'Purpose-built customer briefing workspace',
        defaultTileCount: source.fallbackTileCount,
        sortOrder: 100,
        mapVisible: true,
        mapPosition: 'right',
        regionalView: 'map',
    };
};

const copyDraft = (
    workspace: InsightsWorkspace,
    layout?: WorkspaceLayoutConfig,
): WorkspaceDraft => {
    const label = `${workspace.label} Copy`;
    return {
        ...draftFromWorkspace(workspace, layout),
        id: slugifyWorkspaceId(label),
        label,
        headerTitle: workspace.headerTitle ? `${workspace.headerTitle} Copy` : label,
        existingWorkspace: undefined,
        layoutToCopy: layout,
        sortOrder: 100,
    };
};

const sourceLabel = (sourceWorkspace: WorkspaceSourceId): string =>
    sourceWorkspace === 'secure_networking' ? 'Secure Networking' : 'Executive Briefing';

const sourceDescription = (sourceWorkspace: WorkspaceSourceId): string =>
    sourceWorkspace === 'secure_networking'
        ? 'Starts with access, infrastructure, segmentation, firewalling, and agentic operations.'
        : 'Starts with IT operations, security operations, digital experience, and executive signals.';

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
    open,
    returnFocus,
    currentWorkspace,
    workspaces,
    layouts,
    onClose,
    onWorkspaceSaved,
    onWorkspaceDeleted,
}) => {
    const [draft, setDraft] = useState<WorkspaceDraft>(() =>
        draftFromWorkspace(currentWorkspace, layouts[currentWorkspace.id]),
    );
    const [idTouched, setIdTouched] = useState(true);
    const [status, setStatus] = useState<'idle' | 'saving' | 'deleting' | 'error'>(
        'idle',
    );
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!open) return;
        setDraft(draftFromWorkspace(currentWorkspace, layouts[currentWorkspace.id]));
        setIdTouched(true);
        setStatus('idle');
        setErrorMessage('');
    }, [currentWorkspace, layouts, open]);

    const source = WORKSPACE_SOURCES[draft.sourceWorkspace];
    const duplicateId = useMemo(
        () =>
            workspaces.some(
                (workspace) =>
                    workspace.id === draft.id && workspace.id !== draft.existingWorkspace?.id,
            ),
        [draft.existingWorkspace?.id, draft.id, workspaces],
    );
    const validId = /^[a-z][a-z0-9_]{1,63}$/.test(draft.id);
    const canSave =
        status === 'idle' &&
        Boolean(draft.label.trim()) &&
        validId &&
        !duplicateId &&
        draft.sectionIds.length > 0;

    const selectWorkspace = (workspace: InsightsWorkspace) => {
        setDraft(draftFromWorkspace(workspace, layouts[workspace.id]));
        setIdTouched(true);
        setErrorMessage('');
    };

    const startNew = () => {
        setDraft(emptyDraft(currentWorkspace.sourceWorkspace));
        setIdTouched(false);
        setErrorMessage('');
    };

    const startCopy = () => {
        const selected = draft.existingWorkspace ?? currentWorkspace;
        setDraft(copyDraft(selected, layouts[selected.id]));
        setIdTouched(false);
        setErrorMessage('');
    };

    const updateLabel = (label: string) => {
        setDraft((current) => ({
            ...current,
            label,
            id: idTouched ? current.id : slugifyWorkspaceId(label),
        }));
    };

    const updateSource = (sourceWorkspace: WorkspaceSourceId) => {
        const nextSource = WORKSPACE_SOURCES[sourceWorkspace];
        setDraft((current) => ({
            ...current,
            sourceWorkspace,
            sectionIds: [...nextSource.defaultSectionIds],
            defaultTileCount: nextSource.fallbackTileCount,
            layoutToCopy: undefined,
        }));
    };

    const toggleSection = (sectionId: SectionId) => {
        setDraft((current) => ({
            ...current,
            sectionIds: current.sectionIds.includes(sectionId)
                ? current.sectionIds.filter((candidate) => candidate !== sectionId)
                : [...current.sectionIds, sectionId],
        }));
    };

    const handleSave = async () => {
        if (!canSave) return;
        setStatus('saving');
        setErrorMessage('');
        try {
            const existing = draft.existingWorkspace;
            const input: WorkspaceDefinitionInput = {
                id: draft.id,
                label: draft.label.trim(),
                sourceWorkspace: draft.sourceWorkspace,
                sectionIds: draft.sectionIds,
                defaultVisibleSections: draft.sectionIds,
                maxVisibleSections: draft.sectionIds.length,
                minTileCount:
                    existing?.minTileCount ??
                    WORKSPACE_SOURCES[draft.sourceWorkspace].minTileCount,
                maxTileCount:
                    existing?.maxTileCount ??
                    WORKSPACE_SOURCES[draft.sourceWorkspace].maxTileCount,
                fallbackTileCount: draft.defaultTileCount,
                headerTitle: draft.headerTitle,
                headerSubtitle: draft.headerSubtitle,
                defaultLogoSrc: existing?.defaultLogoSrc,
                hideDefaultLogo:
                    existing?.hideDefaultLogo ??
                    draft.sourceWorkspace === 'secure_networking',
                legacyViewNames: existing?.legacyViewNames,
                isBuiltIn: existing?.isBuiltIn ?? false,
                enabled: true,
                sortOrder: draft.sortOrder,
                mapVisible: draft.mapVisible,
                mapPosition: draft.mapPosition,
                regionalView: draft.regionalView,
            };
            await saveInsightsWorkspace(input, draft.layoutToCopy);
            onWorkspaceSaved(draft.id);
        } catch (error) {
            setStatus('error');
            setErrorMessage(
                error instanceof Error ? error.message : 'Could not save this workspace.',
            );
            window.setTimeout(() => setStatus('idle'), 1200);
        }
    };

    const handleDelete = async () => {
        const workspace = draft.existingWorkspace;
        if (!workspace || workspace.isBuiltIn) return;
        if (
            !window.confirm(
                `Delete the "${workspace.label}" workspace?\n\nIts shared layout will also be removed. This cannot be undone.`,
            )
        ) {
            return;
        }
        setStatus('deleting');
        setErrorMessage('');
        try {
            await deleteInsightsWorkspace(workspace);
            onWorkspaceDeleted(workspace.id);
        } catch (error) {
            setStatus('error');
            setErrorMessage(
                error instanceof Error ? error.message : 'Could not delete this workspace.',
            );
            window.setTimeout(() => setStatus('idle'), 1200);
        }
    };

    return (
        <Modal
            initialFocus="first"
            onRequestClose={onClose}
            open={open}
            returnFocus={returnFocus}
            style={{ width: 'min(1040px, 96vw)' }}
        >
            <Modal.Header
                subtitle="Reusable customer demo views"
                title="Insights workspaces"
            />
            <div className="flex h-[min(720px,92vh)] overflow-hidden">
                <aside className="flex w-72 flex-shrink-0 flex-col border-r   sui-border-default sui-bg-page">
                    <div className="flex-1 space-y-1 overflow-y-auto p-2">
                        {workspaces.map((workspace) => (
                            <button
                                key={workspace.id}
                                type="button"
                                onClick={() => selectWorkspace(workspace)}
                                className={cn(
                                    'w-full rounded-lg border px-3 py-2 text-left transition-colors',
                                    draft.existingWorkspace?.id === workspace.id
                                        ? 'sui-border-info sui-bg-info sui-color-info'
                                        : 'sui-border-transparent   sui-color-default sui-hover-bg-overlay',
                                )}
                            >
                                <span className="block truncate text-xs font-bold">
                                    {workspace.label}
                                </span>
                                <span className="mt-0.5 block truncate text-xs  sui-color-default">
                                    {workspace.id}
                                    {workspace.isBuiltIn ? ' · built in' : ''}
                                </span>
                            </button>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t  p-3 sui-border-default">
                        <button
                            type="button"
                            onClick={startNew}
                            className="inline-flex items-center justify-center gap-1 rounded-md sui-bg-accent px-2 py-2 text-xs font-bold sui-color-active sui-hover-bg-accent"
                        >
                            <Plus className="h-3.5 w-3.5" /> New
                        </button>
                        <button
                            type="button"
                            onClick={startCopy}
                            className="inline-flex items-center justify-center gap-1 rounded-md border   px-2 py-2 text-xs font-bold   sui-border-default sui-bg-popup sui-color-active sui-hover-bg-floating"
                        >
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                        </button>
                    </div>
                </aside>

                <section className="flex min-w-0 flex-1 flex-col">
                    <header className="flex items-center justify-between border-b  px-5 py-3 sui-border-default">
                        <div>
                            <h3 className="text-sm font-bold  sui-color-active">
                                {draft.existingWorkspace
                                    ? `Edit ${draft.existingWorkspace.label}`
                                    : 'Create workspace'}
                            </h3>
                            <p className="mt-0.5 text-xs  sui-color-default">
                                Metadata and section choices are stored in insights_workspaces.conf.
                            </p>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-5">
                        <div className="grid grid-cols-2 gap-4">
                            <label className="text-xs font-bold  sui-color-active">
                                Display name
                                <input
                                    value={draft.label}
                                    onChange={(event) => updateLabel(event.target.value)}
                                    maxLength={80}
                                    className="mt-1 block h-9 w-full rounded-md border   px-3 text-xs font-normal  outline-none sui-focus-border-info focus:ring-2 sui-focus-ring sui-border-default sui-bg-popup sui-color-active sui-focus-ring"
                                />
                            </label>
                            <label className="text-xs font-bold  sui-color-active">
                                Workspace ID
                                <input
                                    value={draft.id}
                                    disabled={Boolean(draft.existingWorkspace)}
                                    onChange={(event) => {
                                        setIdTouched(true);
                                        setDraft((current) => ({
                                            ...current,
                                            id: event.target.value.toLowerCase(),
                                        }));
                                    }}
                                    maxLength={64}
                                    className="mt-1 block h-9 w-full rounded-md border   px-3 font-mono text-xs font-normal  outline-none sui-focus-border-info focus:ring-2 sui-focus-ring disabled:cursor-not-allowed  sui-disabled-color-muted sui-border-default sui-bg-popup sui-color-active sui-disabled-bg-page"
                                />
                                {(!validId || duplicateId) && (
                                    <span className="mt-1 block font-normal  sui-color-negative">
                                        {duplicateId
                                            ? 'That workspace ID already exists.'
                                            : 'Use lowercase letters, numbers, and underscores; start with a letter.'}
                                    </span>
                                )}
                            </label>
                            <label className="text-xs font-bold  sui-color-active">
                                Default visible tiles per section
                                <input
                                    type="number"
                                    min={source.minTileCount}
                                    max={source.maxTileCount}
                                    value={draft.defaultTileCount}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            defaultTileCount: Number(event.target.value),
                                        }))
                                    }
                                    className="mt-1 block h-9 w-full rounded-md border   px-3 text-xs font-normal  outline-none sui-focus-border-info sui-border-default sui-bg-popup sui-color-active"
                                />
                            </label>
                            {!draft.existingWorkspace && (
                                <div className="col-span-2">
                                    <fieldset>
                                        <legend className="text-xs font-bold  sui-color-active">
                                            Start from a template
                                        </legend>
                                        <p className="mt-1 text-xs  sui-color-default">
                                            Templates only provide a useful first configuration. After creation, this workspace owns its own sections, rail, map, theme, and layouts.
                                        </p>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            {(Object.keys(WORKSPACE_SOURCES) as WorkspaceSourceId[]).map(
                                                (sourceId) => {
                                                    const selected = draft.sourceWorkspace === sourceId;
                                                    const template = WORKSPACE_SOURCES[sourceId];
                                                    return (
                                                        <button
                                                            key={sourceId}
                                                            type="button"
                                                            onClick={() => updateSource(sourceId)}
                                                            aria-pressed={selected}
                                                            className={cn(
                                                                'rounded-lg border p-3 text-left transition-colors focus:outline-none focus:ring-2 sui-focus-ring',
                                                                selected
                                                                    ? 'sui-border-info  ring-1 sui-focus-ring sui-border-info sui-bg-info sui-focus-ring'
                                                                    : 'sui-border-weak    sui-border-default sui-bg-popup sui-hover-border-info sui-hover-bg-overlay',
                                                            )}
                                                        >
                                                            <span className="block text-xs font-bold  sui-color-active">
                                                                {sourceLabel(sourceId)}
                                                            </span>
                                                            <span className="mt-1 block text-xs leading-relaxed  sui-color-default">
                                                                {sourceDescription(sourceId)}
                                                            </span>
                                                            <span className="mt-2 block text-xs font-semibold  sui-color-info">
                                                                Starts with: {template.sections
                                                                    .filter((section) => template.defaultSectionIds.includes(section.id))
                                                                    .map((section) => section.title)
                                                                    .join(' · ')}
                                                            </span>
                                                        </button>
                                                    );
                                                },
                                            )}
                                        </div>
                                    </fieldset>
                                </div>
                            )}
                            <label className="text-xs font-bold  sui-color-active">
                                Map placement
                                <select
                                    value={draft.mapPosition}
                                    onChange={(event) => setDraft((current) => ({
                                        ...current,
                                        mapPosition: event.target.value as WorkspaceMapPosition,
                                    }))}
                                    className="mt-1 block h-9 w-full rounded-md border   px-3 text-xs font-normal  outline-none sui-focus-border-info sui-border-default sui-bg-popup sui-color-active"
                                >
                                    <option value="right">Right of tiles</option>
                                    <option value="below">Below tiles</option>
                                    <option value="above">Above tiles</option>
                                </select>
                            </label>
                            <label className="text-xs font-bold  sui-color-active">
                                Map presentation
                                <select
                                    value={draft.regionalView}
                                    onChange={(event) => setDraft((current) => ({
                                        ...current,
                                        regionalView: event.target.value as WorkspaceRegionalView,
                                    }))}
                                    className="mt-1 block h-9 w-full rounded-md border   px-3 text-xs font-normal  outline-none sui-focus-border-info sui-border-default sui-bg-popup sui-color-active"
                                >
                                    <option value="map">Interactive map</option>
                                    <option value="table">Site summary table</option>
                                </select>
                            </label>
                            <label className="mt-5 flex items-center gap-2 text-xs font-bold  sui-color-active">
                                <input
                                    type="checkbox"
                                    checked={draft.mapVisible}
                                    onChange={(event) => setDraft((current) => ({ ...current, mapVisible: event.target.checked }))}
                                    className="h-4 w-4 accent-sky-600"
                                />
                                Show customer connectivity map
                            </label>
                            <label className="col-span-2 text-xs font-bold  sui-color-active">
                                Header title
                                <input
                                    value={draft.headerTitle}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            headerTitle: event.target.value,
                                        }))
                                    }
                                    maxLength={120}
                                    className="mt-1 block h-9 w-full rounded-md border   px-3 text-xs font-normal  outline-none sui-focus-border-info sui-border-default sui-bg-popup sui-color-active"
                                />
                            </label>
                            <label className="col-span-2 text-xs font-bold  sui-color-active">
                                Header subtitle
                                <input
                                    value={draft.headerSubtitle}
                                    onChange={(event) =>
                                        setDraft((current) => ({
                                            ...current,
                                            headerSubtitle: event.target.value,
                                        }))
                                    }
                                    maxLength={180}
                                    className="mt-1 block h-9 w-full rounded-md border   px-3 text-xs font-normal  outline-none sui-focus-border-info sui-border-default sui-bg-popup sui-color-active"
                                />
                            </label>
                        </div>

                        <fieldset className="mt-5">
                            <legend className="text-xs font-bold  sui-color-active">
                                Workspace sections
                            </legend>
                            <p className="mt-1 text-xs  sui-color-default">
                                Mix Secure Networking, SecOps, ITOps, digital experience, and executive signals. Each selected area uses its real Searchbase tile catalogue and can be changed at any time.
                            </p>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {source.sections.map((section) => (
                                    <label
                                        key={section.id}
                                        className={cn(
                                            'flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-xs',
                                            draft.sectionIds.includes(section.id)
                                                ? 'sui-border-info sui-bg-info sui-color-info'
                                                : 'sui-border-weak  sui-border-default sui-color-default',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={draft.sectionIds.includes(section.id)}
                                            onChange={() => toggleSection(section.id)}
                                            className="h-4 w-4 accent-sky-600"
                                        />
                                        <span className="font-bold">{section.title}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <div className="mt-5 rounded-lg border   p-3 text-xs  sui-border-info sui-bg-info sui-color-info">
                            Open the workspace, arrange its tiles, then use <strong>Publish workspace layout</strong>{' '}
                            in the tile editor to update the matching layout stanzas.
                        </div>
                        {errorMessage && (
                            <div className="mt-3 rounded-lg border   p-3 text-xs  sui-border-negative sui-bg-negative sui-color-negative">
                                {errorMessage}
                            </div>
                        )}
                    </div>

                    <footer className="flex items-center justify-between border-t  px-5 py-3 sui-border-default">
                        <div>
                            {draft.existingWorkspace && !draft.existingWorkspace.isBuiltIn && (
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={status !== 'idle'}
                                    className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-xs font-bold   disabled:opacity-50 sui-color-negative sui-hover-bg-negative"
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Delete workspace
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={status === 'saving' || status === 'deleting'}
                                className="rounded-md px-3 py-2 text-xs font-bold   disabled:opacity-50 sui-color-default sui-hover-bg-overlay"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!canSave}
                                className="inline-flex items-center gap-1 rounded-md sui-bg-accent px-4 py-2 text-xs font-bold sui-color-active sui-hover-bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Save className="h-3.5 w-3.5" />
                                {status === 'saving' ? 'Saving…' : 'Save workspace'}
                            </button>
                        </div>
                    </footer>
                </section>
            </div>
        </Modal>
    );
};
