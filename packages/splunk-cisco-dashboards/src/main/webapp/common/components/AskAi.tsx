import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import CollapsiblePanel from '@splunk/react-ui/CollapsiblePanel';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Drawer from '@splunk/react-ui/Drawer';
import Heading from '@splunk/react-ui/Heading';
import Link from '@splunk/react-ui/Link';
import Message from '@splunk/react-ui/Message';
import ScreenReaderContent from '@splunk/react-ui/ScreenReaderContent';
import Select from '@splunk/react-ui/Select';
import Text from '@splunk/react-ui/Text';
import TextArea from '@splunk/react-ui/TextArea';
import Tooltip from '@splunk/react-ui/Tooltip';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import { addLeadingSearchCommand } from '@splunk/splunk-utils/search';
import { variables } from '@splunk/themes';
import styled from 'styled-components';
import SearchbaseDrilldownGuidance from '@/common/components/workspace/SearchbaseDrilldownGuidance';
import { SplSyntax } from '@/common/components/SplSyntax';
import { WORKSPACE_ADD_HELP, type WorkspaceAddScope } from '@/common/components/workspace/workspaceAddHelp';
import { getCurrentSplunkUsername, userScopedStorageKey } from '@/common/config/insightsWorkspaces';
import { Sparkles } from '@/common/icons/SuiIcon';
import { isSearchBaseInstalled } from '@/common/lib/searchbase';
import { splunkSearchAppUrl, splunkSearchbaseEditUrl, type SplunkSearchTimeRange } from '@/common/lib/splunkSearchUrl';
import {
    askModel, canValidateDraft, getAskAiSettings, saveDraftToSearchbase, validateDraft,
    type AskAiSettings, type AssistantTurn,
} from '@/common/services/askAiToolkit';
import { ASK_SEARCHBASE_QUESTION_LIMIT, rankAssistantSearchMatches, rankSearchbaseMatches } from '@/common/services/askSearchbase';
import { getSearchbaseCatalogue, type SearchbaseRecord } from '@/common/services/searchbaseCatalogue';

const Content = styled.div`
    display: grid;
    gap: ${variables.spacingMedium};
    min-width: 0;
`;

const SearchCard = styled.article`
    display: grid;
    gap: ${variables.spacingSmall};
    min-width: 0;
    padding: ${variables.spacingMedium};
    border: 1px solid ${variables.borderColorWeak};
    border-radius: ${variables.borderRadius};
    overflow-wrap: anywhere;

    p, pre { margin: 0; }

    pre {
        max-height: 14rem;
        overflow: auto;
        white-space: pre-wrap;
    }
`;

const SearchDetailsBody = styled.div`
    min-width: 0;
    padding: ${variables.spacingMedium};
    background: ${variables.backgroundColorSection};
    border-radius: ${variables.borderRadius};
`;

const ActionRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${variables.spacingSmall};
`;

const AskAiSparkles = styled(Sparkles)<{ $gradientId: string }>`
    path, use {
        fill: ${({ $gradientId }) => `url("#${$gradientId}")`};
    }

    @media (forced-colors: active), (prefers-contrast: more) {
        path, use { fill: currentColor; }
    }
`;

const CatalogueDetails = styled.dl`
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: ${variables.spacingXSmall} ${variables.spacingSmall};
    margin: ${variables.spacingMedium} 0 0;
    padding-top: ${variables.spacingMedium};
    border-top: 1px solid ${variables.borderColorWeak};

    dt { font-weight: ${variables.fontWeightSemiBold}; }
    dd { margin: 0; }
`;

const AnswerText = styled.p`
    white-space: pre-wrap;
`;

const ChatComposer = styled.div`
    flex: 0 0 auto;
    display: grid;
    gap: ${variables.spacingSmall};
    min-width: 0;
    padding: ${variables.spacingLarge} ${variables.spacingXLarge};
    border-bottom: 1px solid ${variables.borderColorWeak};

    @media (max-height: 420px) {
        box-sizing: border-box;
        max-height: 50%;
        overflow-y: auto;
    }
`;

const ComposerActions = styled(ActionRow)`
    justify-content: flex-end;
`;

const ChatQuestion = styled.div`
    justify-self: end;
    max-width: 85%;
    padding: ${variables.spacingMedium};
    border-radius: ${variables.borderRadius};
    background: ${variables.backgroundColorSection};
    overflow-wrap: anywhere;

    p {
        margin: ${variables.spacingXSmall} 0 0;
        white-space: pre-wrap;
    }
`;

const ChatReply = styled(SearchCard)`
    margin-inline-end: ${variables.spacingXLarge};
`;

const Transcript = styled.section`
    display: grid;
    gap: ${variables.spacingMedium};
`;

const ChatStarters = styled.section`
    display: grid;
    gap: ${variables.spacingSmall};
`;

const SearchStatus = styled.div`
    &:empty {
        position: absolute;
    }
`;

const ActivityStatus = styled(SearchStatus)`
    &:not(:empty) {
        display: flex;
        align-items: center;
        gap: ${variables.spacingSmall};
        padding: ${variables.spacingSmall} ${variables.spacingMedium};
        background: ${variables.backgroundColorSection};
        border-radius: ${variables.borderRadius};

        > :first-child { flex-shrink: 0; }
        > span { min-width: 0; overflow-wrap: anywhere; }
    }

`;

const QUESTION_STORAGE_KEY = 'scd:ask-ai:question';
const SEARCHBASE_LISTING_URL = 'https://splunkbase.splunk.com/app/7188';
const RESULT_BATCH_SIZE = 5;
const FIND_SEARCHES_DELAY_MS = 350;
const CHAT_TURN_LIMIT = 12;

function readQuestion(): string {
    if (!getCurrentSplunkUsername()) return '';
    try {
        return window.sessionStorage.getItem(userScopedStorageKey(QUESTION_STORAGE_KEY))?.slice(0, ASK_SEARCHBASE_QUESTION_LIMIT) ?? '';
    } catch {
        return '';
    }
}

function rememberQuestion(question: string): void {
    if (!getCurrentSplunkUsername()) return;
    try {
        const key = userScopedStorageKey(QUESTION_STORAGE_KEY);
        if (question) window.sessionStorage.setItem(key, question);
        else window.sessionStorage.removeItem(key);
    } catch {
        // Search remains available when the browser blocks session storage.
    }
}

interface Destination {
    id: string;
    title: string;
    add: (record: SearchbaseRecord, scope: WorkspaceAddScope) => Promise<'added' | 'already-present'>;
}

interface AskAiProps {
    context: string;
    contextId?: string;
    range?: SplunkSearchTimeRange & { label?: string };
    destinations?: readonly Destination[];
    canManageWorkspace?: boolean;
    showLabel?: boolean;
}

interface Result {
    question: string;
    records: SearchbaseRecord[];
    ambiguousIds: Set<string>;
    visibleCount: number;
}

interface DraftReview {
    id?: string;
    validated?: boolean;
    saved?: SearchbaseRecord;
    error?: string;
    copyStatus?: string;
}

interface ChatTurn extends AssistantTurn {
    id: number;
    modelFailed?: boolean;
    explanationSpl?: string;
    recommendation?: SearchbaseRecord;
    draftReference?: SearchbaseRecord;
    draftReview?: DraftReview;
}

export default function AskAi({
    context,
    contextId = context,
    range,
    destinations,
    canManageWorkspace = false,
    showLabel = false,
}: AskAiProps) {
    const iconGradientId = useId();
    const trigger = useRef<HTMLButtonElement | null>(null);
    const nextResultToFocus = useRef<number | null>(null);
    const pending = useRef<object | null>(null);
    const finderTimer = useRef<number>();
    const composing = useRef(false);
    const compositionEnter = useRef(false);
    const activeContext = useRef(contextId);
    const [open, setOpen] = useState(false);
    const [searchbaseInstalled, setSearchbaseInstalled] = useState<boolean | null>();
    const [question, setQuestion] = useState('');
    const [rememberedQuestion] = useState(readQuestion);
    const resumedQuestion = useRef(rememberedQuestion);
    const chatInput = useRef<HTMLTextAreaElement>(null);
    const drawerContent = useRef<HTMLDivElement>(null);
    const latestChatQuestion = useRef<HTMLDivElement>(null);
    const modelWarning = useRef<HTMLDivElement>(null);
    const latestReplyHeading = useRef<HTMLHeadingElement>(null);
    const conversationSequence = useRef(0);
    const [result, setResult] = useState<Result | null>(null);
    const [phase, setPhase] = useState<'catalogue' | 'model' | null>(null);
    const loading = phase !== null;
    const [destinationId, setDestinationId] = useState('');
    const [adding, setAdding] = useState(false);
    const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

    const [settings, setSettings] = useState<AskAiSettings>();
    const [conversation, setConversation] = useState<ChatTurn[]>([]);
    const currentTurn = conversation[conversation.length - 1];
    const answer = currentTurn?.answer;
    const modelFailed = currentTurn?.modelFailed;
    const [showCatalogMatches, setShowCatalogMatches] = useState(false);
    const [draftOperation, setDraftOperation] = useState<'validate' | 'save' | null>(null);
    const draftBusy = draftOperation !== null;
    const drawerRevision = useRef(0);
    const returnFocusToSearch = useRef<number | null>(null);
    const modelRequest = useRef<AbortController | null>(null);
    const canAskAi = Boolean(settings?.enabled && settings.canUseModel);
    const launcherLabel = canAskAi ? 'Ask AI' : 'Find searches';

    const cancelFinderTimer = useCallback(() => {
        window.clearTimeout(finderTimer.current);
        finderTimer.current = undefined;
    }, []);

    useEffect(() => cancelFinderTimer, [canAskAi, cancelFinderTimer]);

    useEffect(() => {
        if (open && canAskAi && currentTurn?.id !== undefined) {
            latestChatQuestion.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [open, canAskAi, currentTurn?.id]);

    useEffect(() => {
        if (!open || !canAskAi || drawerContent.current?.contains(document.activeElement)) return;
        const viewport = drawerContent.current?.parentElement?.getBoundingClientRect();
        const questionBounds = latestChatQuestion.current?.getBoundingClientRect();
        if (!viewport || !questionBounds || questionBounds.bottom < viewport.top || questionBounds.top > viewport.bottom) return;
        if (answer) {
            const heading = latestReplyHeading.current;
            const replyBottom = heading?.parentElement?.getBoundingClientRect().bottom;
            if (replyBottom && replyBottom > viewport.bottom) heading?.scrollIntoView({ block: 'start' });
            return;
        }
        if (modelFailed) modelWarning.current?.scrollIntoView({ block: 'nearest' });
    }, [open, canAskAi, answer, modelFailed]);

    useEffect(() => {
        let active = true;
        void getAskAiSettings().then((current) => { if (active) setSettings(current); }).catch(() => {});
        return () => {
            active = false;
            pending.current = null;
            modelRequest.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (!open) return;
        let active = true;
        void isSearchBaseInstalled().then((installed) => {
            if (active) setSearchbaseInstalled(installed);
        });
        return () => { active = false; };
    }, [open]);
    useEffect(() => {
        activeContext.current = contextId;
        setDestinationId('');
        setFeedback(null);
    }, [contextId]);

    async function findMatches(query: string, useModel = false, selectedSpl?: string) {
        const submitted = query.trim();
        if (!submitted || pending.current || adding || draftBusy || composing.current) return;
        cancelFinderTimer();
        const request = {};
        pending.current = request;
        nextResultToFocus.current = null;
        const modelMode = useModel && canAskAi && settings;
        const turnId = modelMode ? ++conversationSequence.current : undefined;
        const retrying = currentTurn?.modelFailed && submitted === currentTurn.question;
        const explanationSpl = selectedSpl ?? (retrying ? currentTurn.explanationSpl : undefined);
        setPhase(explanationSpl === undefined ? 'catalogue' : 'model');
        if (explanationSpl === undefined) {
            setResult(null);
            setShowCatalogMatches(false);
        }
        setFeedback(null);
        if (turnId !== undefined) {
            setConversation((turns) => [
                ...(retrying ? turns.slice(0, -1) : turns),
                { id: turnId, question: submitted, explanationSpl },
            ].slice(-CHAT_TURN_LIMIT));
            if (selectedSpl === undefined) setQuestion('');
            chatInput.current?.focus({ preventScroll: selectedSpl === undefined });
        } else {
            rememberQuestion(submitted);
        }
        try {
            const catalogue = explanationSpl === undefined
                ? await getSearchbaseCatalogue({ allApps: true, includeHidden: true })
                : [];
            if (pending.current === request) {
                const ranked = rankSearchbaseMatches(catalogue, submitted);
                const assistantMatches = modelMode ? rankAssistantSearchMatches(catalogue, submitted) : undefined;
                const records = ranked.length ? ranked : assistantMatches?.matches ?? ranked;
                // Searchbase's editor route accepts a stanza ID without its owning app.
                const ownerById = new Map<string, string>();
                const ambiguousIds = new Set<string>();
                for (const { id, ownerApp } of catalogue) {
                    const firstOwner = ownerById.get(id);
                    if (firstOwner === undefined) ownerById.set(id, ownerApp);
                    else if (firstOwner !== ownerApp) ambiguousIds.add(id);
                }
                if (explanationSpl === undefined) {
                    setResult({ question: submitted, records, ambiguousIds, visibleCount: Math.min(RESULT_BATCH_SIZE, records.length) });
                }
                if (modelMode && turnId !== undefined && assistantMatches) {
                    const controller = new AbortController();
                    modelRequest.current = controller;
                    try {
                        const examples = assistantMatches.examples.slice(0, conversation.length ? 3 : 5);
                        // Reserve context for the previous answer when refining a search.
                        const related = [...(result?.records.slice(0, 2) ?? []), ...records, ...assistantMatches.examples];
                        for (const record of related) {
                            if (examples.length === 5) break;
                            if (!examples.includes(record)) examples.push(record);
                        }
                        setPhase('model');
                        const response = await askModel(
                            submitted, examples, modelMode.connection, conversation,
                            AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
                            explanationSpl,
                        );
                        if (pending.current !== request) return;
                        const recommendation = examples.find((record) =>
                            record.id === response.source?.id && record.ownerApp === response.source?.ownerApp);
                        if (recommendation) {
                            setResult((current) => {
                                if (!current) return current;
                                const isRecommendation = ({ id, ownerApp }: SearchbaseRecord) =>
                                    id === recommendation.id && ownerApp === recommendation.ownerApp;
                                if (current.records.some(isRecommendation)) return current;
                                return {
                                    ...current,
                                    records: [
                                        ...current.records.slice(0, current.visibleCount),
                                        recommendation,
                                        ...current.records.slice(current.visibleCount),
                                    ],
                                    visibleCount: current.visibleCount + 1,
                                };
                            });
                        }
                        setConversation((turns) => turns.map((turn) => turn.id === turnId
                            ? { ...turn, answer: response, recommendation, draftReference: recommendation ?? records[0] }
                            : turn));
                    } catch {
                        if (pending.current === request) {
                            setQuestion((typed) => typed || submitted);
                            setConversation((turns) => turns.map((turn) => turn.id === turnId
                                ? { ...turn, modelFailed: true }
                                : turn));
                            if (explanationSpl === undefined) setShowCatalogMatches(records.length > 0);
                        }
                    }
                }
            }
        } catch {
            if (pending.current === request) {
                if (turnId !== undefined) setQuestion((typed) => typed || submitted);
                setFeedback({ text: 'Searchbase could not be loaded. Try again.', error: true });
            }
        } finally {
            if (pending.current === request) {
                modelRequest.current = null;
                pending.current = null;
                setPhase(null);
            }
        }
    }

    const destination = destinations?.find(({ id }) => id === destinationId);
    async function add(record: SearchbaseRecord, scope: WorkspaceAddScope) {
        if (!destination || adding || (scope === 'workspace' && !canManageWorkspace)) return;
        const targetContext = contextId;
        setAdding(true);
        setFeedback(null);
        try {
            const outcome = await destination.add(record, scope);
            if (activeContext.current === targetContext) {
                const visibility = scope === 'workspace' ? 'everyone' : 'you';
                const text = outcome === 'already-present'
                    ? `${record.searchName} is already in ${destination.title} for ${visibility}.`
                    : `Added ${record.searchName} to ${destination.title} for ${visibility}.`;
                setFeedback({ text });
            }
        } catch (error) {
            if (activeContext.current === targetContext) {
                const text = error instanceof Error ? error.message : `Could not add the search to ${destination.title}. Try again.`;
                setFeedback({ text, error: true });
            }
        } finally {
            setAdding(false);
        }
    }

    function updateDraftReview(turnId: number, review: DraftReview) {
        setConversation((turns) => turns.map((turn) => turn.id === turnId
            ? { ...turn, draftReview: { ...turn.draftReview, ...review } }
            : turn));
    }

    async function copyDraft(turnId: number, spl: string, button: HTMLElement) {
        try {
            const copied = await navigator.clipboard?.writeText(spl).then(() => true, () => false);
            if (!copied) {
                const previousFocus = document.activeElement;
                const field = document.createElement('textarea');
                field.value = spl;
                field.style.position = 'fixed';
                field.style.opacity = '0';
                button.parentElement?.appendChild(field);
                try {
                    field.select();
                    if (!document.execCommand('copy')) throw new Error('Copy failed');
                } finally {
                    field.remove();
                    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
                        previousFocus.focus({ preventScroll: true });
                    }
                }
            }
            updateDraftReview(turnId, { copyStatus: 'SPL copied.' });
        } catch {
            updateDraftReview(turnId, { copyStatus: 'Open View draft SPL to select and copy the query.' });
        }
    }

    async function reviewDraft(turn: ChatTurn, save: boolean, button: HTMLElement) {
        const reply = turn.answer;
        if (!reply?.search || draftBusy || loading || adding) return;
        const draft = reply.search;
        const requestDrawerRevision = drawerRevision.current;
        const actions = button.closest('[data-ask-ai-draft-actions]');
        const actionsHadFocus = actions?.contains(document.activeElement);
        const signal = AbortSignal.timeout(20000);
        setDraftOperation(save ? 'save' : 'validate');
        updateDraftReview(turn.id, { error: undefined });
        try {
            let review: DraftReview;
            if (save) {
                const id = turn.draftReview?.id || `ask_ai_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
                updateDraftReview(turn.id, { id });
                const saved = await saveDraftToSearchbase(draft, id, {
                    description: reply.explanation,
                    reference: turn.draftReference,
                }, signal);
                review = { saved };
                setResult((current) => {
                    if (!current) return { question: turn.question, ambiguousIds: new Set(), records: [saved], visibleCount: 1 };
                    if (current.records.some(({ id: recordId, ownerApp }) => recordId === saved.id && ownerApp === saved.ownerApp)) return current;
                    return {
                        ...current,
                        records: [
                            ...current.records.slice(0, current.visibleCount),
                            saved,
                            ...current.records.slice(current.visibleCount),
                        ],
                        visibleCount: current.visibleCount + 1,
                    };
                });
            } else {
                await validateDraft(draft.spl, signal);
                review = { validated: true };
            }
            if (requestDrawerRevision === drawerRevision.current && actions?.isConnected &&
                (actions.contains(document.activeElement) || (actionsHadFocus && document.activeElement === document.body))) {
                returnFocusToSearch.current = turn.id;
            }
            updateDraftReview(turn.id, review);
        } catch (error) {
            updateDraftReview(turn.id, { error: error instanceof Error ? error.message : 'The draft could not be checked.' });
        } finally {
            setDraftOperation(null);
        }
    }

    function clear() {
        cancelFinderTimer();
        pending.current = null;
        setPhase(null);
        resumedQuestion.current = '';
        nextResultToFocus.current = null;
        setQuestion('');
        setConversation([]);
        setShowCatalogMatches(false);
        setResult(null);
        setFeedback(null);
        if (!canAskAi) rememberQuestion('');
        chatInput.current?.focus({ preventScroll: true });
    }

    function updateQuestion(value: string) {
        setQuestion(value);
        if (canAskAi || composing.current) return;
        cancelFinderTimer();
        const submitted = value.trim();
        if (!submitted) {
            clear();
            return;
        }
        if (result?.question === submitted) return;
        // The catalogue request can be shared with other views. Ignore its old
        // result instead of aborting a fetch another view may still need.
        pending.current = null;
        setPhase(null);
        setResult(null);
        setFeedback(null);
        finderTimer.current = window.setTimeout(() => {
            void findMatches(submitted);
        }, FIND_SEARCHES_DELAY_MS);
    }

    function showMoreResults() {
        if (!result || result.visibleCount >= result.records.length) return;
        nextResultToFocus.current = result.visibleCount;
        setResult({ ...result, visibleCount: Math.min(result.visibleCount + RESULT_BATCH_SIZE, result.records.length) });
    }

    function openDrawer() {
        setOpen(true);
        if (canAskAi) return;
        const finderQuestion = question || resumedQuestion.current;
        resumedQuestion.current = '';
        if (finderQuestion.trim() && result?.question !== finderQuestion.trim()) {
            setQuestion(finderQuestion);
            void findMatches(finderQuestion);
        }
    }

    function closeDrawer() {
        drawerRevision.current += 1;
        returnFocusToSearch.current = null;
        cancelFinderTimer();
        composing.current = false;
        compositionEnter.current = false;
        if (!canAskAi) {
            pending.current = null;
            setPhase(null);
        }
        setOpen(false);
    }

    const questionForm = (
        <form
            onSubmit={(event) => {
                event.preventDefault();
                if (!compositionEnter.current) void findMatches(question, canAskAi);
            }}
            onKeyDown={(event) => {
                // WebKit can end composition before the keydown that confirms it.
                compositionEnter.current = event.key === 'Enter' &&
                    (composing.current || event.nativeEvent.isComposing || event.keyCode === 229);
                if (canAskAi && event.key === 'Enter' && !event.shiftKey && !compositionEnter.current) {
                    event.preventDefault();
                    void findMatches(question, true);
                }
            }}
            onKeyUp={() => { compositionEnter.current = false; }}
            onCompositionStart={() => {
                composing.current = true;
                cancelFinderTimer();
            }}
            onCompositionEnd={(event) => {
                composing.current = false;
                if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
                    updateQuestion(event.target.value);
                }
            }}
        >
            <ControlGroup label={canAskAi ? 'Message Ask AI' : 'What are you looking for?'} help={canAskAi ? <>
                {!conversation.length && <>Questions, recent replies, and selected Searchbase examples go to the configured model.<br /></>}
                Enter to send. Shift+Enter for a new line.
            </> : 'Results update as you type. Try “WAN packet loss”.'}>
                {canAskAi ? (
                    <TextArea
                        inputRef={chatInput}
                        rowsMin={2}
                        rowsMax={4}
                        maxLength={ASK_SEARCHBASE_QUESTION_LIMIT}
                        value={question}
                        disabled={adding || draftBusy}
                        onChange={(_event, { value }) => updateQuestion(value)}
                    />
                ) : (
                    <Text
                        maxLength={ASK_SEARCHBASE_QUESTION_LIMIT}
                        value={question}
                        disabled={adding || draftBusy ? 'dimmed' : false}
                        onChange={(_event, { value }) => updateQuestion(value)}
                    />
                )}
            </ControlGroup>
        </form>
    );

    const catalogResults = result && <>
        {!canAskAi && <Heading level={2} variant="title3">Searchbase matches</Heading>}
        <p>
            {result.records.length
                ? (canAskAi
                    ? `Showing ${result.visibleCount} of ${result.records.length} matches.`
                    : `Showing ${result.visibleCount} of ${result.records.length} ${result.records.length === 1 ? 'match' : 'matches'} for “${result.question}”.`)
                : `No close matches for “${result.question}”. Try a product name, metric, or data source.`}
        </p>
        {result.records.length > 0 && <p>Searches open with the time range <strong>{range?.label ?? 'Last 24 hours'}</strong>.</p>}
        {Boolean(result.records.length && destinations?.length) && (
            <ControlGroup label="Add to a workspace section">
                <Select value={destinationId} disabled={adding} onChange={(_event, { value }) => setDestinationId(String(value))}>
                    <Select.Option value="" label="Choose a section" />
                    {destinations?.map(({ id, title }) => <Select.Option key={id} value={id} label={title} />)}
                </Select>
            </ControlGroup>
        )}
        {result.records.slice(0, result.visibleCount).map((record, index) => {
            const categoryLabel = [record.category, record.subCategory].filter(Boolean).join(' · ');
            const needsInputs = /\$[\w.]+\$/.test(record.search);
            const ambiguous = result.ambiguousIds.has(record.id);
            const searchbaseLabel = ambiguous ? 'Browse Searchbase' : 'Open in Searchbase';
            return <SearchCard key={`${record.ownerApp}:${record.id}`}>
                <Heading level={3} variant="title4" tabIndex={-1} elementRef={(heading) => {
                    if (heading && nextResultToFocus.current === index) {
                        nextResultToFocus.current = null;
                        heading.focus();
                    }
                }}>{record.searchName}</Heading>
                {categoryLabel && <p>{categoryLabel}</p>}
                {needsInputs && <p>This search needs inputs from its original view.</p>}
                <ActionRow>
                    {!needsInputs && (
                        <Link appearance="standalone" openInNewContext
                            aria-label={`Open in Search: ${record.searchName} (opens in new window)`}
                            to={splunkSearchAppUrl(addLeadingSearchCommand(record.search), range, record.dispatchContext)}>
                            Open in Search
                        </Link>
                    )}
                    {searchbaseInstalled === true && (
                        <Tooltip content={ambiguous
                            ? 'This search ID exists in more than one app. Find it by name and app in Searchbase.'
                            : 'View this saved search and its details in the Searchbase app.'} wrapContent>
                            <Link appearance="standalone" openInNewContext
                                aria-label={`${searchbaseLabel}: ${record.searchName} (opens in new window)`}
                                to={splunkSearchbaseEditUrl(ambiguous ? undefined : record.id)}>
                                {searchbaseLabel}
                            </Link>
                        </Tooltip>
                    )}
                    {!needsInputs && destination && (
                        <ActionRow>
                            <Tooltip content={WORKSPACE_ADD_HELP.personal}>
                                <Button appearance="secondary" label="Add for me" disabled={adding}
                                    aria-label={`Add for me: ${record.searchName} to ${destination.title}`}
                                    onClick={() => { void add(record, 'personal'); }} />
                            </Tooltip>
                            {canManageWorkspace && (
                                <Tooltip content={WORKSPACE_ADD_HELP.workspace}>
                                    <Button appearance="secondary" label="Add for everyone" disabled={adding}
                                        aria-label={`Add for everyone: ${record.searchName} to ${destination.title}`}
                                        onClick={() => { void add(record, 'workspace'); }} />
                                </Tooltip>
                            )}
                        </ActionRow>
                    )}
                </ActionRow>
                <CollapsiblePanel appearance="subtle" title="Search details" inset={false}>
                    <SearchDetailsBody>
                        <SearchbaseDrilldownGuidance metadata={{ ...record, title: record.searchName }} appearance="inline" />
                        <CatalogueDetails>
                            {record.tags.length > 0 && <><dt>Tags</dt><dd>{record.tags.join(', ')}</dd></>}
                            {record.defaultViz && <><dt>Default visualization</dt><dd>{record.defaultViz}</dd></>}
                            <dt>Search ID</dt><dd><code>{record.id}</code></dd>
                        </CatalogueDetails>
                    </SearchDetailsBody>
                </CollapsiblePanel>
                <CollapsiblePanel appearance="subtle" title="View SPL" inset={false}>
                    <pre tabIndex={0}><code><SplSyntax spl={record.search} /></code></pre>
                </CollapsiblePanel>
            </SearchCard>;
        })}
        {result.visibleCount < result.records.length && (
            <ActionRow>
                <Button appearance="secondary" label="Show more results" onClick={showMoreResults} />
            </ActionRow>
        )}
    </>;

    function renderReply(turn: ChatTurn, latest: boolean) {
        const reply = turn.answer;
        if (!reply) return null;
        const { search: draft } = reply;
        const { recommendation, draftReview } = turn;
        const actionsDisabled = loading || adding || draftBusy;
        const draftSpl = draftReview?.saved?.search ?? draft?.spl;
        const canValidate = draftSpl !== undefined && canValidateDraft(draftSpl);
        const viewLabel = draftReview?.saved ? 'View saved SPL' : 'View draft SPL';
        const explainLabel = draftReview?.saved ? 'Explain this search' : 'Explain this draft';

        return (
            <ChatReply aria-label={latest ? 'Latest Ask AI reply' : 'Earlier Ask AI reply'}>
                <Heading level={2} variant="title4" tabIndex={latest ? -1 : undefined}
                    elementRef={latest ? latestReplyHeading : undefined}>
                    Ask AI{latest && <ScreenReaderContent> latest reply</ScreenReaderContent>}
                </Heading>
                {draft && draftSpl !== undefined ? (
                    <>
                        <Heading level={3} variant="title4">{draft.title}</Heading>
                        <p role="status">
                            {draftReview?.saved ? 'Saved to Searchbase' : draftReview?.validated
                                ? 'SPL syntax validated' : canValidate ? 'Draft SPL' : 'Draft SPL requires manual review'}
                        </p>
                        <ActionRow data-ask-ai-draft-actions>
                            {(draftReview?.validated || draftReview?.saved) ? (
                                <Link appearance="standalone" openInNewContext
                                    elementRef={(link) => {
                                        if (link && returnFocusToSearch.current === turn.id) {
                                            returnFocusToSearch.current = null;
                                            if (document.activeElement === document.body) link.focus();
                                        }
                                    }}
                                    to={splunkSearchAppUrl(addLeadingSearchCommand(draftReview.saved?.search ?? draft.spl),
                                        range, draftReview.saved?.dispatchContext)}>
                                    Open in Search
                                </Link>
                            ) : canValidate ? (
                                <Button label="Validate SPL" disabled={actionsDisabled}
                                    onClick={(event) => { void reviewDraft(turn, false, event.currentTarget); }} />
                            ) : (
                                <Link appearance="standalone" openInNewContext to={splunkSearchAppUrl('', range)}>
                                    Open in Search
                                </Link>
                            )}
                            {!draftReview?.saved && (
                                <Button appearance="secondary" label="Copy SPL"
                                    aria-label={`Copy SPL for ${draft.title}`}
                                    onClick={(event) => { void copyDraft(turn.id, draftSpl, event.currentTarget); }} />
                            )}
                            {searchbaseInstalled === true && (draftReview?.saved ? (
                                <Link appearance="standalone" openInNewContext
                                    to={splunkSearchbaseEditUrl(draftReview.saved.id)}>
                                    Open in Searchbase
                                </Link>
                            ) : (
                                <Tooltip content="Opens the Add search form. Use Copy SPL to paste the query into the form." wrapContent>
                                    <Link appearance="standalone" openInNewContext to={`${splunkSearchbaseEditUrl()}#/add/`}>
                                        Add in Searchbase
                                    </Link>
                                </Tooltip>
                            ))}
                            {draftReview?.validated && !draftReview.saved && settings?.writable && (
                                <Button appearance="secondary" label="Save to Searchbase" disabled={actionsDisabled}
                                    onClick={(event) => { void reviewDraft(turn, true, event.currentTarget); }} />
                            )}
                            <Button appearance="secondary" label={explainLabel} aria-label={`${explainLabel} for ${draft.title}`}
                                disabled={actionsDisabled}
                                onClick={() => {
                                    const prompt = `Explain the SPL for “${draft.title}” and list its output fields.`;
                                    void findMatches(prompt, true, draftSpl);
                                }} />
                        </ActionRow>
                        {!canValidate && !draftReview?.saved && (
                            <p>{searchbaseInstalled === true
                                ? 'Copy the SPL, then paste it into Search to review it or into Searchbase to save it manually.'
                                : 'Copy the SPL, then paste it into Search to review it.'}</p>
                        )}
                        <SearchStatus role="status">{draftReview?.copyStatus}</SearchStatus>
                        {draftReview?.error && <Message type="error" role="alert">{draftReview.error}</Message>}
                        <CollapsiblePanel appearance="subtle" inset={false}
                            title={<>{viewLabel}<ScreenReaderContent> for {draft.title}</ScreenReaderContent></>}>
                            <pre tabIndex={0} aria-label={draftReview?.saved ? 'Saved search SPL' : 'Draft SPL'}>
                                <code><SplSyntax spl={draftSpl} /></code>
                            </pre>
                        </CollapsiblePanel>
                    </>
                ) : recommendation && (
                    <>
                        <Heading level={3} variant="title4">{recommendation.searchName}</Heading>
                        <ActionRow>
                            {!/\$[\w.]+\$/.test(recommendation.search) && (
                                <Link appearance="standalone" openInNewContext
                                    to={splunkSearchAppUrl(addLeadingSearchCommand(recommendation.search), range, recommendation.dispatchContext)}>
                                    Open in Search
                                </Link>
                            )}
                            <Button appearance="secondary" label="Explain this search" disabled={actionsDisabled}
                                onClick={() => {
                                    const prompt = `Explain the SPL for “${recommendation.searchName}” and list its output fields.`;
                                    void findMatches(prompt.slice(0, ASK_SEARCHBASE_QUESTION_LIMIT), true, recommendation.search);
                                }} />
                        </ActionRow>
                        <CollapsiblePanel appearance="subtle" inset={false}
                            title={<>View SPL<ScreenReaderContent> for {recommendation.searchName}</ScreenReaderContent></>}>
                            <pre tabIndex={0} aria-label={`SPL for ${recommendation.searchName}`}>
                                <code><SplSyntax spl={recommendation.search} /></code>
                            </pre>
                        </CollapsiblePanel>
                    </>
                )}
                <AnswerText>{reply.explanation}</AnswerText>
            </ChatReply>
        );
    }

    let activity = '';
    if (draftOperation === 'validate') activity = 'Checking SPL syntax…';
    if (draftOperation === 'save') activity = 'Saving the search to Searchbase…';
    if (phase === 'catalogue') activity = 'Looking for Searchbase matches…';
    if (phase === 'model') {
        activity = currentTurn?.explanationSpl !== undefined
            ? 'Explaining the selected SPL…'
            : result?.records.length
                ? 'Searchbase matches are ready. Waiting for the model’s answer…'
                : 'Waiting for the model’s answer…';
    }
    const feedbackMessage = feedback && (
        <Message type={feedback.error ? 'error' : 'success'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</Message>
    );
    const askButtonLabel = modelFailed && question.trim() === currentTurn.question
        ? 'Try Ask AI again'
        : 'Send';

    return <>
        <Button
            appearance="secondary"
            label={launcherLabel}
            hideLabel={!showLabel}
            icon={(
                <AskAiSparkles aria-hidden="true" variant="filled" size={24} $gradientId={iconGradientId}>
                    <defs>
                        {/* Match the gradient in Splunk Search's AI Assistant launcher. */}
                        <linearGradient id={iconGradientId} x1="0" y1="0" x2="27.7119" y2="5.58624" gradientUnits="userSpaceOnUse">
                            <stop stopColor="#FFAB0F" />
                            <stop offset="0.993998" stopColor="#FF0F7B" />
                        </linearGradient>
                    </defs>
                </AskAiSparkles>
            )}
            aria-haspopup="dialog"
            elementRef={trigger}
            onClick={openDrawer}
        />
        <Drawer open={open} onRequestClose={closeDrawer} returnFocus={trigger} width="min(560px, 100vw)">
            <Drawer.Header title={launcherLabel} subtitle={context} />
            {canAskAi && (
                <ChatComposer>
                    <ActivityStatus role="status">
                        {activity && <>
                            <WaitSpinner screenReaderText={null} />
                            <span>{activity}</span>
                        </>}
                    </ActivityStatus>
                    {questionForm}
                    <ComposerActions>
                        {answer && <Button appearance="subtle" label="Read latest reply" onClick={() => latestReplyHeading.current?.focus()} />}
                        {conversation.length > 0 && (
                            <Button appearance="secondary" label="New chat" disabled={loading || adding || draftBusy} onClick={clear} />
                        )}
                        <Button appearance="primary" label={askButtonLabel}
                            disabled={!question.trim() || loading || adding || draftBusy}
                            onClick={() => { void findMatches(question, true); }} />
                    </ComposerActions>
                </ChatComposer>
            )}
            <Drawer.Body>
                <Content ref={drawerContent}>
                    {!canAskAi && <>
                        <p>Find existing searches in Searchbase by topic, product, or monitoring goal.</p>
                        {questionForm}
                    </>}
                    {(searchbaseInstalled === false || searchbaseInstalled === null) && (
                        <ActionRow>
                            <Tooltip content="View the Searchbase app listing for installation instructions." wrapContent>
                                <Link appearance="standalone" openInNewContext to={SEARCHBASE_LISTING_URL}>
                                    {searchbaseInstalled === false ? 'Get Searchbase' : 'Searchbase on Splunkbase'}
                                </Link>
                            </Tooltip>
                        </ActionRow>
                    )}
                    {canAskAi ? (
                        <>
                            <ScreenReaderContent role="status">{answer ? 'AI response ready.' : ''}</ScreenReaderContent>
                            {conversation.length === 0 && (
                                <ChatStarters aria-label="Suggested questions">
                                    <Heading level={2} variant="title4">Try a question</Heading>
                                    <ActionRow>
                                        <Button appearance="secondary" label="Find a search for WAN packet loss"
                                            disabled={Boolean(question.trim()) || loading}
                                            onClick={() => { void findMatches('Find a search for WAN packet loss.', true); }} />
                                        <Button appearance="secondary" label="Draft SPL for failed logins by hour"
                                            disabled={Boolean(question.trim()) || loading}
                                            onClick={() => { void findMatches('Draft SPL for failed logins by hour.', true); }} />
                                    </ActionRow>
                                </ChatStarters>
                            )}
                            {conversation.length > 0 && <Transcript aria-label="Conversation">
                                {conversation.map((turn) => (
                                    <React.Fragment key={turn.id}>
                                        <ChatQuestion ref={turn.id === currentTurn?.id ? latestChatQuestion : undefined}>
                                            <strong>You</strong>
                                            <p>{turn.question}</p>
                                        </ChatQuestion>
                                        {renderReply(turn, turn.id === currentTurn?.id)}
                                    </React.Fragment>
                                ))}
                                {modelFailed && (
                                    <Message type="warning" role="alert" elementRef={modelWarning}>
                                        {currentTurn.explanationSpl !== undefined
                                            ? 'Ask AI couldn’t explain this SPL. Try Ask AI again.'
                                            : result?.records.length
                                            ? 'Ask AI couldn’t answer. Use the Searchbase matches below or try Ask AI again.'
                                            : 'Ask AI couldn’t answer, and Searchbase found no close matches. Try a shorter question or a product name.'}
                                    </Message>
                                )}
                                {feedbackMessage}
                            </Transcript>}
                        </>
                    ) : <>
                        <SearchStatus role="status">{activity}</SearchStatus>
                        {feedbackMessage}
                        <ScreenReaderContent role="status">
                            {result && `Showing ${result.visibleCount} of ${result.records.length} Searchbase matches.`}
                        </ScreenReaderContent>
                    </>}
                    {canAskAi && result ? (!modelFailed || currentTurn.explanationSpl !== undefined || result.records.length > 0) && (
                        <CollapsiblePanel appearance="subtle" title={`Searchbase matches (${result.records.length})`}
                            open={showCatalogMatches} onChange={(_, { action }) => setShowCatalogMatches(action === 'open')} inset={false}>
                            <Content>
                                {catalogResults}
                            </Content>
                        </CollapsiblePanel>
                    ) : catalogResults}
                </Content>
            </Drawer.Body>
            {!canAskAi && (
                <Drawer.Footer>
                    <Button appearance="secondary" label="Clear" disabled={adding || draftBusy || (!question && !result)} onClick={clear} />
                    <Button appearance="primary" label="Find searches" disabled={!question.trim() || loading || adding || draftBusy}
                        onClick={() => { void findMatches(question); }} />
                </Drawer.Footer>
            )}
        </Drawer>
    </>;
}
