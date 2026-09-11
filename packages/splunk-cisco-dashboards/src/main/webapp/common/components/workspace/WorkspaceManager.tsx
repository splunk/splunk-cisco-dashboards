import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import Button from '@splunk/react-ui/Button';
import Checkbox from '@splunk/react-ui/Checkbox';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Menu from '@splunk/react-ui/Menu';
import Message from '@splunk/react-ui/Message';
import Modal from '@splunk/react-ui/Modal';
import NumberInput from '@splunk/react-ui/Number';
import RadioList from '@splunk/react-ui/RadioList';
import Select from '@splunk/react-ui/Select';
import Text from '@splunk/react-ui/Text';
import { variables } from '@splunk/themes';
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
import type { SignalTickerConfig } from '@/common/config/signalTicker';
import {
    deleteInsightsWorkspace,
    saveInsightsWorkspace,
    type WorkspaceLayoutConfig,
} from '@/common/services/insightsWorkspaceService';

interface WorkspaceManagerProps {
    open: boolean;
    returnFocus: React.MutableRefObject<HTMLAnchorElement | HTMLButtonElement | null>;
    currentWorkspace: InsightsWorkspace;
    workspaces: readonly InsightsWorkspace[];
    layouts: Record<WorkspaceId, WorkspaceLayoutConfig>;
    signalRails: Record<WorkspaceId, SignalTickerConfig>;
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
    signalRailToCopy?: SignalTickerConfig;
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
    signalRail?: SignalTickerConfig,
): WorkspaceDraft => {
    const label = `${workspace.label} Copy`;
    return {
        ...draftFromWorkspace(workspace, layout),
        id: slugifyWorkspaceId(label),
        label,
        headerTitle: workspace.headerTitle ? `${workspace.headerTitle} Copy` : label,
        existingWorkspace: undefined,
        layoutToCopy: layout,
        signalRailToCopy: signalRail,
        sortOrder: 100,
    };
};

const sourceLabel = (sourceWorkspace: WorkspaceSourceId): string => {
    if (sourceWorkspace === 'secure_networking') return 'Secure Networking';
    if (sourceWorkspace === 'agentic_soc') return 'Agentic Security Operations Center';
    return 'Executive Briefing';
};

const sourceDescription = (sourceWorkspace: WorkspaceSourceId): string => {
    if (sourceWorkspace === 'secure_networking') {
        return 'Starts with access, infrastructure, segmentation, firewalling, and agentic operations.';
    }
    if (sourceWorkspace === 'agentic_soc') {
        return 'Starts with live Umbrella DNS, Cisco Secure Firewall, Endace/Zeek network detection, and Splunk-led investigation.';
    }
    return 'Starts with IT operations, security operations, digital experience, and executive signals.';
};

const ManagerLayout = styled.div`
    display: grid;
    grid-template-columns: minmax(220px, 272px) minmax(0, 1fr);
    height: min(640px, calc(100vh - 220px));
    min-height: 420px;
    overflow: hidden;

    @media (width <= 760px) {
        grid-template-columns: minmax(0, 1fr);
        grid-template-rows: minmax(148px, 32%) minmax(0, 1fr);
        min-height: min(560px, calc(100vh - 180px));
    }
`;

const WorkspaceNavigation = styled.aside`
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
    border-right: 1px solid ${variables.borderColorWeak};
    background-color: ${variables.backgroundColorPage};

    @media (width <= 760px) {
        border-right: 0;
        border-bottom: 1px solid ${variables.borderColorWeak};
    }
`;

const WorkspaceMenu = styled(Menu)`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: ${variables.spacingSmall};
`;

const NavigationActions = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${variables.spacingSmall};
    padding: ${variables.spacingSmall};
    border-top: 1px solid ${variables.borderColorWeak};
`;

const WorkspaceEditor = styled.section`
    display: flex;
    min-width: 0;
    min-height: 0;
    flex-direction: column;
`;

const EditorHeader = styled.header`
    padding: ${variables.spacingMedium} ${variables.spacingLarge};
    border-bottom: 1px solid ${variables.borderColorWeak};
`;

const EditorTitle = styled.h3`
    margin: 0;
    color: ${variables.contentColorActive};
    font-family: ${variables.fontFamilyTitle};
    font-size: ${variables.fontSizeLarge};
    font-weight: ${variables.fontWeightSemiBold};
    line-height: ${variables.lineHeightSingle};

    &:focus-visible {
        outline: 0;
        box-shadow: ${variables.focusShadow};
    }
`;

const EditorDescription = styled.p`
    margin: ${variables.spacingXSmall} 0 0;
    color: ${variables.contentColorMuted};
    font-size: ${variables.fontSizeSmall};
`;

const EditorBody = styled.div`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: ${variables.spacingLarge};
`;

const FieldsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: ${variables.spacingLarge};

    @media (width <= 860px) {
        grid-template-columns: minmax(0, 1fr);
    }
`;

const FullWidth = styled.div`
    grid-column: 1 / -1;
`;

const TemplateRadioList = styled(RadioList)`
    && {
        grid-template-columns: [input] 20px [label] minmax(0, 1fr);
    }

    && input[type='radio'] {
        inline-size: 20px;
        min-inline-size: 20px;
        block-size: 20px;
        min-block-size: 20px;
    }
`;

const SectionFieldset = styled.fieldset`
    min-width: 0;
    margin: ${variables.spacingSmall} 0 0;
    padding: 0;
    border: 0;
`;

const FieldsetLegend = styled.legend`
    margin: 0;
    padding: 0;
    color: ${variables.contentColorActive};
    font-size: ${variables.fontSizeSmall};
    font-weight: ${variables.fontWeightSemiBold};
`;

const FieldsetDescription = styled.p`
    margin: ${variables.spacingXSmall} 0 0;
    color: ${variables.contentColorMuted};
    font-size: ${variables.fontSizeSmall};
    line-height: ${variables.lineHeight};
`;

const SectionError = styled.p`
    margin: ${variables.spacingXSmall} 0 0;
    color: ${variables.contentColorNegative};
    font-size: ${variables.fontSizeSmall};
`;

const SectionGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${variables.spacingSmall};
    margin-top: ${variables.spacingSmall};

    @media (width <= 860px) {
        grid-template-columns: minmax(0, 1fr);
    }
`;

const SectionOption = styled.div<{ $selected: boolean }>`
    min-width: 0;
    padding: ${variables.spacingSmall};
    border: 1px solid
        ${({ $selected }) =>
            $selected ? variables.interactiveColorBorder : variables.borderColorWeak};
    border-radius: ${variables.borderRadius};
    background-color: ${({ $selected }) =>
        $selected ? variables.interactiveColorOverlaySelected : variables.transparent};

    &:focus-within {
        box-shadow: ${variables.focusShadow};
    }
`;

const MessageStack = styled.div`
    display: grid;
    gap: ${variables.spacingSmall};
    margin-top: ${variables.spacingLarge};
`;

export const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
    open,
    returnFocus,
    currentWorkspace,
    workspaces,
    layouts,
    signalRails,
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
    const [validationAttempted, setValidationAttempted] = useState(false);
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const editorTitleRef = React.useRef<HTMLHeadingElement>(null);
    const displayNameRef = React.useRef<HTMLInputElement>(null);
    const workspaceIdRef = React.useRef<HTMLInputElement>(null);
    const firstSectionRef = React.useRef<HTMLInputElement>(null);
    const serverErrorRef = React.useRef<HTMLDivElement>(null);
    const deleteReturnFocusRef = React.useRef<HTMLElement | null>(null);
    const sectionsDescriptionId = React.useId();
    const sectionsErrorId = React.useId();

    useEffect(() => {
        if (!open) {
            return;
        }
        setDraft(draftFromWorkspace(currentWorkspace, layouts[currentWorkspace.id]));
        setIdTouched(true);
        setStatus('idle');
        setErrorMessage('');
        setValidationAttempted(false);
        setDeleteConfirmationOpen(false);
    }, [currentWorkspace, layouts, open]);

    useEffect(() => {
        if (errorMessage) {
            serverErrorRef.current?.focus();
        }
    }, [errorMessage]);

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
    const missingDisplayName = !draft.label.trim();
    const missingSections = draft.sectionIds.length === 0;
    const validDraft =
        !missingDisplayName && validId && !duplicateId && !missingSections;

    const focusEditor = () => {
        window.requestAnimationFrame(() => editorTitleRef.current?.focus());
    };

    const selectWorkspace = (workspace: InsightsWorkspace) => {
        setDraft(draftFromWorkspace(workspace, layouts[workspace.id]));
        setIdTouched(true);
        setErrorMessage('');
        setValidationAttempted(false);
    };

    const startNew = () => {
        setDraft(emptyDraft(currentWorkspace.sourceWorkspace));
        setIdTouched(false);
        setErrorMessage('');
        setValidationAttempted(false);
        focusEditor();
    };

    const startCopy = () => {
        const selected = draft.existingWorkspace ?? currentWorkspace;
        setDraft(
            copyDraft(
                selected,
                layouts[selected.id],
                signalRails[selected.id],
            ),
        );
        setIdTouched(false);
        setErrorMessage('');
        setValidationAttempted(false);
        focusEditor();
    };

    const updateLabel = (label: string) => {
        setDraft((current) => {
            const clonedOrMirroredHeader =
                !current.headerTitle.trim() ||
                current.headerTitle.trim() === current.label.trim() ||
                / copy$/i.test(current.headerTitle.trim());
            return {
                ...current,
                label,
                headerTitle: clonedOrMirroredHeader ? label : current.headerTitle,
                id: idTouched ? current.id : slugifyWorkspaceId(label),
            };
        });
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
        if (status !== 'idle') {
            return;
        }
        setValidationAttempted(true);
        if (!validDraft) {
            window.requestAnimationFrame(() => {
                if (missingDisplayName) {
                    displayNameRef.current?.focus();
                } else if (!validId || duplicateId) {
                    workspaceIdRef.current?.focus();
                } else {
                    firstSectionRef.current?.focus();
                }
            });
            return;
        }
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
            await saveInsightsWorkspace(
                input,
                draft.layoutToCopy,
                draft.existingWorkspace,
                draft.signalRailToCopy,
            );
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
        if (!workspace || workspace.isBuiltIn) {
            return;
        }
        setDeleteConfirmationOpen(false);
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

    let workspaceIdError: string | boolean = false;
    if (duplicateId) {
        workspaceIdError = 'That workspace ID already exists.';
    } else if (!validId) {
        workspaceIdError =
            'Use lowercase letters, numbers, and underscores; start with a letter.';
    }

    return (
        <>
            <Modal
                divider="both"
                initialFocus="first"
                onRequestClose={onClose}
                open={open}
                returnFocus={returnFocus}
                style={{
                    width: `min(1040px, calc(100vw - ${variables.spacingXXLarge}))`,
                }}
            >
                <Modal.Header
                    subtitle="Reusable customer demo views"
                    title="Insights workspaces"
                />
                <Modal.Body className="scd-insights-layer-content">
                    <ManagerLayout>
                        <WorkspaceNavigation aria-label="Available workspaces">
                            <WorkspaceMenu
                                appearance="subtle"
                                focusMode="roving"
                                stopScrollPropagation
                            >
                                <Menu.Heading title>
                                    Available workspaces
                                </Menu.Heading>
                            {workspaces.map((workspace) => {
                                const selected =
                                    draft.existingWorkspace?.id === workspace.id;
                                return (
                                    <Menu.Item
                                        key={workspace.id}
                                        description={`${workspace.id}${workspace.isBuiltIn ? ' · built in' : ''}`}
                                        onClick={() => selectWorkspace(workspace)}
                                        selectable
                                        selected={selected}
                                        truncate
                                    >
                                        {workspace.label}
                                    </Menu.Item>
                                );
                            })}
                            </WorkspaceMenu>
                        <NavigationActions>
                            <Button
                                appearance="primary"
                                icon={<Plus />}
                                inline={false}
                                label="New"
                                onClick={startNew}
                            />
                            <Button
                                appearance="secondary"
                                icon={<Copy />}
                                inline={false}
                                label="Duplicate"
                                onClick={startCopy}
                            />
                        </NavigationActions>
                    </WorkspaceNavigation>

                    <WorkspaceEditor>
                        <EditorHeader>
                            <EditorTitle ref={editorTitleRef} tabIndex={-1}>
                                {draft.existingWorkspace
                                    ? `Edit ${draft.existingWorkspace.label}`
                                    : 'Create workspace'}
                            </EditorTitle>
                            <EditorDescription>
                                Metadata and section choices are stored in
                                insights_workspaces.conf.
                            </EditorDescription>
                        </EditorHeader>

                        <EditorBody>
                            <FieldsGrid>
                                <ControlGroup
                                    label="Display name"
                                    help="Shown in the workspace switcher. The dashboard header title is separate."
                                    required
                                    error={
                                        validationAttempted && missingDisplayName
                                            ? 'Enter a display name.'
                                            : false
                                    }
                                >
                                    <Text
                                        error={
                                            validationAttempted && missingDisplayName
                                        }
                                        inputRef={displayNameRef}
                                        value={draft.label}
                                        onChange={(_event, { value }) =>
                                            updateLabel(value)
                                        }
                                        maxLength={80}
                                    />
                                </ControlGroup>
                                <ControlGroup
                                    label="Workspace ID"
                                    required
                                    error={workspaceIdError}
                                >
                                    <Text
                                        value={draft.id}
                                        disabled={
                                            draft.existingWorkspace ? 'dimmed' : false
                                        }
                                        error={!validId || duplicateId}
                                        inputRef={workspaceIdRef}
                                        onChange={(_event, { value }) => {
                                            setIdTouched(true);
                                            setDraft((current) => ({
                                                ...current,
                                                id: value.toLowerCase(),
                                            }));
                                        }}
                                        maxLength={64}
                                    />
                                </ControlGroup>
                                <ControlGroup
                                    controlsLayout="none"
                                    label="Default visible tiles per section"
                                >
                                    <NumberInput
                                        inline
                                        min={source.minTileCount}
                                        max={source.maxTileCount}
                                        roundTo={0}
                                        value={draft.defaultTileCount}
                                        onChange={(_event, { value }) => {
                                            if (value === undefined) {
                                                return;
                                            }
                                            setDraft((current) => ({
                                                ...current,
                                                defaultTileCount: value,
                                            }));
                                        }}
                                        style={{ width: 120 }}
                                    />
                                </ControlGroup>
                                {!draft.existingWorkspace && (
                                    <FullWidth>
                                        <ControlGroup
                                            label="Start from a template"
                                            help="Templates provide a useful first configuration. After creation, this workspace owns its sections, rail, map, theme, and layouts."
                                        >
                                            <TemplateRadioList
                                                value={draft.sourceWorkspace}
                                                onChange={(_event, { value }) =>
                                                    updateSource(
                                                        value as WorkspaceSourceId,
                                                    )
                                                }
                                            >
                                                {(Object.keys(
                                                    WORKSPACE_SOURCES,
                                                ) as WorkspaceSourceId[]).map(
                                                    (sourceId) => {
                                                        const template =
                                                            WORKSPACE_SOURCES[sourceId];
                                                        const startingSections =
                                                            template.sections
                                                                .filter((section) =>
                                                                    template.defaultSectionIds.includes(
                                                                        section.id,
                                                                    ),
                                                                )
                                                                .map(
                                                                    (section) =>
                                                                        section.title,
                                                                )
                                                                .join(' · ');
                                                        return (
                                                            <RadioList.Option
                                                                key={sourceId}
                                                                description={`${sourceDescription(sourceId)} Starts with: ${startingSections}`}
                                                                value={sourceId}
                                                            >
                                                                {sourceLabel(sourceId)}
                                                            </RadioList.Option>
                                                        );
                                                    },
                                                )}
                                            </TemplateRadioList>
                                        </ControlGroup>
                                    </FullWidth>
                                )}
                                <ControlGroup label="Map placement">
                                    <Select
                                        value={draft.mapPosition}
                                        onChange={(_event, { value }) =>
                                            setDraft((current) => ({
                                                ...current,
                                                mapPosition:
                                                    value as WorkspaceMapPosition,
                                            }))
                                        }
                                    >
                                        <Select.Option
                                            label="Right of tiles"
                                            value="right"
                                        />
                                        <Select.Option
                                            label="Below tiles"
                                            value="below"
                                        />
                                        <Select.Option
                                            label="Above tiles"
                                            value="above"
                                        />
                                    </Select>
                                </ControlGroup>
                                <ControlGroup label="Map presentation">
                                    <Select
                                        value={draft.regionalView}
                                        onChange={(_event, { value }) =>
                                            setDraft((current) => ({
                                                ...current,
                                                regionalView:
                                                    value as WorkspaceRegionalView,
                                            }))
                                        }
                                    >
                                        <Select.Option
                                            label="Interactive map"
                                            value="map"
                                        />
                                        <Select.Option
                                            label="Site summary table"
                                            value="table"
                                        />
                                    </Select>
                                </ControlGroup>
                                <ControlGroup
                                    controlsLayout="none"
                                    label="Customer connectivity map"
                                >
                                    <Checkbox
                                        checked={draft.mapVisible}
                                        onChange={(_event, { checked }) =>
                                            setDraft((current) => ({
                                                ...current,
                                                mapVisible: Boolean(checked),
                                            }))
                                        }
                                    >
                                        Show map in this workspace
                                    </Checkbox>
                                </ControlGroup>
                                <FullWidth>
                                    <ControlGroup
                                        label="Header title"
                                        help="Shown to every viewer in the workspace header."
                                    >
                                        <Text
                                            value={draft.headerTitle}
                                            onChange={(_event, { value }) =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    headerTitle: value,
                                                }))
                                            }
                                            maxLength={120}
                                        />
                                    </ControlGroup>
                                </FullWidth>
                                <FullWidth>
                                    <ControlGroup label="Header subtitle">
                                        <Text
                                            value={draft.headerSubtitle}
                                            onChange={(_event, { value }) =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    headerSubtitle: value,
                                                }))
                                            }
                                            maxLength={180}
                                        />
                                    </ControlGroup>
                                </FullWidth>
                            </FieldsGrid>

                            <SectionFieldset
                                aria-describedby={`${sectionsDescriptionId}${
                                    validationAttempted && missingSections
                                        ? ` ${sectionsErrorId}`
                                        : ''
                                }`}
                            >
                                <FieldsetLegend>
                                    Workspace sections (required)
                                </FieldsetLegend>
                                <FieldsetDescription id={sectionsDescriptionId}>
                                    Mix Secure Networking, SecOps, ITOps, digital
                                    experience, and executive signals. Each selected area
                                    uses its Searchbase tile catalogue and can be changed at
                                    any time.
                                </FieldsetDescription>
                                {validationAttempted && missingSections && (
                                    <SectionError id={sectionsErrorId}>
                                        Select at least one workspace section.
                                    </SectionError>
                                )}
                                <SectionGrid>
                                    {source.sections.map((section, index) => {
                                        const selected = draft.sectionIds.includes(
                                            section.id,
                                        );
                                        return (
                                            <SectionOption
                                                key={section.id}
                                                $selected={selected}
                                            >
                                                <Checkbox
                                                    checked={selected}
                                                    describedBy={`${sectionsDescriptionId}${
                                                        validationAttempted &&
                                                        missingSections
                                                            ? ` ${sectionsErrorId}`
                                                            : ''
                                                    }`}
                                                    error={
                                                        validationAttempted &&
                                                        missingSections
                                                    }
                                                    inputRef={
                                                        index === 0
                                                            ? firstSectionRef
                                                            : undefined
                                                    }
                                                    onChange={() =>
                                                        toggleSection(section.id)
                                                    }
                                                >
                                                    {section.title}
                                                </Checkbox>
                                            </SectionOption>
                                        );
                                    })}
                                </SectionGrid>
                            </SectionFieldset>

                            <MessageStack>
                                <Message type="info">
                                    Open the workspace, arrange its tiles, then use{' '}
                                    <strong>Publish workspace layout</strong> in the tile
                                    editor to update the matching layout stanzas.
                                </Message>
                                {errorMessage && (
                                    <div
                                        ref={serverErrorRef}
                                        role="alert"
                                        tabIndex={-1}
                                    >
                                        <Message type="error">
                                            {errorMessage}
                                        </Message>
                                    </div>
                                )}
                            </MessageStack>
                        </EditorBody>
                    </WorkspaceEditor>
                </ManagerLayout>
                </Modal.Body>
                <Modal.Footer>
                    {draft.existingWorkspace &&
                        !draft.existingWorkspace.isBuiltIn && (
                            <Button
                                appearance="destructiveSecondary"
                                disabled={status !== 'idle'}
                                icon={<Trash2 />}
                                label="Delete workspace"
                                onClick={(event) => {
                                    deleteReturnFocusRef.current =
                                        event.currentTarget;
                                    setDeleteConfirmationOpen(true);
                                }}
                            />
                        )}
                    <Button
                        appearance="secondary"
                        disabled={status === 'saving' || status === 'deleting'}
                        label="Cancel"
                        onClick={onClose}
                    />
                    <Button
                        appearance="primary"
                        disabled={status !== 'idle'}
                        icon={<Save />}
                        label={
                            status === 'saving' ? 'Saving…' : 'Save workspace'
                        }
                        onClick={handleSave}
                    />
                </Modal.Footer>
            </Modal>
            <Modal
                onRequestClose={() => setDeleteConfirmationOpen(false)}
                open={deleteConfirmationOpen}
                returnFocus={() => deleteReturnFocusRef.current?.focus()}
                style={{ width: 420 }}
            >
                <Modal.Header title="Delete workspace?" />
                <Modal.Body>
                    {draft.existingWorkspace && (
                        <p>
                            Delete <strong>{draft.existingWorkspace.label}</strong>? Its
                            shared layout will also be removed. This cannot be undone.
                        </p>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        appearance="secondary"
                        label="Cancel"
                        onClick={() => setDeleteConfirmationOpen(false)}
                    />
                    <Button
                        appearance="destructive"
                        icon={<Trash2 />}
                        label="Delete"
                        onClick={handleDelete}
                    />
                </Modal.Footer>
            </Modal>
        </>
    );
};
