import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import CollapsiblePanel from '@splunk/react-ui/CollapsiblePanel';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Drawer from '@splunk/react-ui/Drawer';
import Heading from '@splunk/react-ui/Heading';
import Link from '@splunk/react-ui/Link';
import Message from '@splunk/react-ui/Message';
import Select from '@splunk/react-ui/Select';
import Text from '@splunk/react-ui/Text';
import Tooltip from '@splunk/react-ui/Tooltip';
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
    type AskAiSettings, type AssistantAnswer,
} from '@/common/services/askAiToolkit';
import { ASK_SEARCHBASE_QUESTION_LIMIT, rankSearchbaseMatches } from '@/common/services/askSearchbase';
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

const SearchStatus = styled.div`
    &:empty {
        position: absolute;
    }
`;

const QUESTION_STORAGE_KEY = 'scd:ask-ai:question';
const SEARCHBASE_LISTING_URL = 'https://splunkbase.splunk.com/app/7188';
const RESULT_BATCH_SIZE = 5;
const FIND_SEARCHES_DELAY_MS = 350;

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
    const [question, setQuestion] = useState(readQuestion);
    const resumedQuestion = useRef(question);
    const [result, setResult] = useState<Result | null>(null);
    const [loading, setLoading] = useState(false);
    const [destinationId, setDestinationId] = useState('');
    const [adding, setAdding] = useState(false);
    const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

    const [settings, setSettings] = useState<AskAiSettings>();
    const [answer, setAnswer] = useState<AssistantAnswer>();
    const [draftId, setDraftId] = useState('');
    const [verifiedSpl, setVerifiedSpl] = useState('');
    const [draftBusy, setDraftBusy] = useState(false);
    const modelRequest = useRef<AbortController | null>(null);
    const canAskAi = Boolean(settings?.enabled && settings.canUseModel);
    const launcherLabel = canAskAi ? 'Ask AI' : 'Find searches';

    const cancelFinderTimer = useCallback(() => {
        window.clearTimeout(finderTimer.current);
        finderTimer.current = undefined;
    }, []);

    useEffect(() => cancelFinderTimer, [canAskAi, cancelFinderTimer]);

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

    async function findMatches(query: string, useModel = false) {
        const submitted = query.trim();
        if (!submitted || pending.current || adding || draftBusy || composing.current) return;
        cancelFinderTimer();
        const request = {};
        pending.current = request;
        nextResultToFocus.current = null;
        setLoading(true);
        setResult(null);
        setAnswer(undefined);
        setVerifiedSpl('');
        setDraftId('');
        setFeedback(null);
        rememberQuestion(submitted);
        try {
            const catalogue = await getSearchbaseCatalogue({ allApps: true, includeHidden: true });
            if (pending.current === request) {
                let records = rankSearchbaseMatches(catalogue, submitted);
                if (useModel && canAskAi && settings) {
                    const controller = new AbortController();
                    modelRequest.current = controller;
                    try {
                        const examples = records.slice(0, 5);
                        // Reserve context for the previous answer when refining a search.
                        const related = [...(result?.records.slice(0, 2) ?? []),
                            ...rankSearchbaseMatches(catalogue, submitted, true).slice(0, 5)];
                        for (const record of related) {
                            if (examples.length === 5) break;
                            if (!examples.includes(record)) examples.push(record);
                        }
                        const response = await askModel(
                            submitted, examples, settings.connection, answer,
                            AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
                        );
                        if (pending.current !== request) return;
                        const recommendation = examples.find((record) =>
                            record.id === response.source?.id && record.ownerApp === response.source?.ownerApp);
                        if (recommendation) {
                            records = [recommendation, ...records.filter((record) => record !== recommendation)];
                        }
                        setAnswer(response);
                    } catch {
                        if (pending.current === request) {
                            setFeedback({ text: 'The AI Toolkit model did not respond. You can still use the Searchbase matches below.', error: true });
                        }
                    }
                }
                if (pending.current !== request) return;
                // Searchbase's editor route accepts a stanza ID without its owning app.
                const ownerById = new Map<string, string>();
                const ambiguousIds = new Set<string>();
                for (const { id, ownerApp } of catalogue) {
                    const firstOwner = ownerById.get(id);
                    if (firstOwner === undefined) ownerById.set(id, ownerApp);
                    else if (firstOwner !== ownerApp) ambiguousIds.add(id);
                }
                setResult({ question: submitted, records, ambiguousIds, visibleCount: Math.min(RESULT_BATCH_SIZE, records.length) });
            }
        } catch {
            if (pending.current === request) {
                setFeedback({ text: 'Searchbase could not be loaded. Try again.', error: true });
            }
        } finally {
            if (pending.current === request) {
                modelRequest.current = null;
                pending.current = null;
                setLoading(false);
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

    async function reviewDraft(save: boolean) {
        const draft = answer?.search;
        if (!draft || draftBusy) return;
        setDraftBusy(true);
        setFeedback(null);
        const signal = AbortSignal.timeout(20000);
        try {
            if (save) {
                const id = draftId || `ask_ai_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
                setDraftId(id);
                const saved = await saveDraftToSearchbase(draft, id, signal);
                if (saved) {
                    setResult((current) => current && ({
                        ...current,
                        records: [saved, ...current.records.filter((record) => record.id !== saved.id || record.ownerApp !== saved.ownerApp)],
                        visibleCount: Math.max(current.visibleCount, 1),
                    }));
                }
                setFeedback({ text: 'Saved to Searchbase. You can add this search to a workspace section from the matching searches below.' });
            } else {
                await validateDraft(draft.spl, signal);
                setVerifiedSpl(draft.spl);
                setFeedback({ text: 'Splunk accepted the SPL syntax. Open in Search to check results with the workspace time range.' });
            }
        } catch (error) {
            setFeedback({ text: error instanceof Error ? error.message : 'The draft could not be checked.', error: true });
        } finally {
            setDraftBusy(false);
        }
    }

    function clear() {
        cancelFinderTimer();
        pending.current = null;
        setLoading(false);
        resumedQuestion.current = '';
        nextResultToFocus.current = null;
        setQuestion('');
        setAnswer(undefined);
        setDraftId('');
        setVerifiedSpl('');
        setResult(null);
        setFeedback(null);
        rememberQuestion('');
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
        setLoading(false);
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
        if (resumedQuestion.current || (!canAskAi && result?.question !== question.trim())) {
            resumedQuestion.current = '';
            void findMatches(question);
        }
    }

    function closeDrawer() {
        cancelFinderTimer();
        composing.current = false;
        compositionEnter.current = false;
        if (!canAskAi) {
            pending.current = null;
            setLoading(false);
        }
        setOpen(false);
    }

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
            <Drawer.Body>
                <Content>
                    <p>{canAskAi
                        ? 'Ask for a search, an SPL explanation, or a draft. Your question and selected Searchbase examples go to the configured model.'
                        : 'Find existing searches in Searchbase by topic, product, or monitoring goal.'}</p>
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (!compositionEnter.current) void findMatches(question, canAskAi);
                        }}
                        onKeyDown={(event) => {
                            // WebKit can end composition before the keydown that confirms it.
                            compositionEnter.current = event.key === 'Enter' &&
                                (composing.current || event.nativeEvent.isComposing || event.keyCode === 229);
                        }}
                        onKeyUp={() => { compositionEnter.current = false; }}
                        onCompositionStart={() => {
                            composing.current = true;
                            cancelFinderTimer();
                        }}
                        onCompositionEnd={(event) => {
                            composing.current = false;
                            if (event.target instanceof HTMLInputElement) updateQuestion(event.target.value);
                        }}
                    >
                        <ControlGroup label="What are you looking for?" help={canAskAi
                            ? 'For example, which sites have the most WAN packet loss?'
                            : 'Results update as you type. Try “WAN packet loss”.'}>
                            <Text
                                maxLength={ASK_SEARCHBASE_QUESTION_LIMIT}
                                value={question}
                                disabled={adding || draftBusy ? 'dimmed' : false}
                                onChange={(_event, { value }) => updateQuestion(value)}
                            />
                        </ControlGroup>
                    </form>
                    {(searchbaseInstalled === false || searchbaseInstalled === null) && (
                        <ActionRow>
                            <Tooltip content="View the Searchbase app listing for installation instructions." wrapContent>
                                <Link appearance="standalone" openInNewContext to={SEARCHBASE_LISTING_URL}>
                                    {searchbaseInstalled === false ? 'Get Searchbase' : 'Searchbase on Splunkbase'}
                                </Link>
                            </Tooltip>
                        </ActionRow>
                    )}
                    {feedback && <Message type={feedback.error ? 'error' : 'success'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</Message>}
                    <SearchStatus role="status">
                        {loading && (canAskAi ? 'Checking Searchbase and preparing an answer…' : 'Looking for Searchbase matches…')}
                        {answer && 'AI response ready.'}
                    </SearchStatus>
                    {answer && <SearchCard aria-label="AI response">
                        <Heading level={2} variant="title4">AI response</Heading>
                        <AnswerText>{answer.explanation}</AnswerText>
                        {answer.search && <>
                            <Heading level={3} variant="title4">{answer.search.title}</Heading>
                            <p>Review this draft SPL before using it.</p>
                            <pre tabIndex={0} aria-label="Draft SPL"><code><SplSyntax spl={answer.search.spl} /></code></pre>
                            <ActionRow>
                                {canValidateDraft(answer.search.spl) && (
                                    <Button label={verifiedSpl === answer.search.spl ? 'Validate SPL again' : 'Validate SPL'}
                                        disabled={draftBusy} onClick={() => { void reviewDraft(false); }} />
                                )}
                                {verifiedSpl === answer.search.spl && (
                                    <Link appearance="standalone" openInNewContext
                                        to={splunkSearchAppUrl(addLeadingSearchCommand(answer.search.spl), range)}>
                                        Open draft in Search
                                    </Link>
                                )}
                                {verifiedSpl === answer.search.spl && settings?.writable && (
                                    <Button label="Save to Searchbase" disabled={draftBusy || Boolean(result?.records.some(({ id }) => id === draftId))}
                                        onClick={() => { void reviewDraft(true); }} />
                                )}
                            </ActionRow>
                            {!canValidateDraft(answer.search.spl) && (
                                <p>Copy this SPL to Search to review commands, macros, or inputs before running it.</p>
                            )}
                        </>}
                    </SearchCard>}
                    {result && <Heading level={2} variant="title3">Searchbase matches</Heading>}
                    <SearchStatus role="status">
                        {result && (result.records.length
                            ? `Showing ${result.visibleCount} of ${result.records.length} ${result.records.length === 1 ? 'match' : 'matches'} for “${result.question}”.`
                            : `No close matches for “${result.question}”. Try a product name, metric, or data source.`)}
                    </SearchStatus>
                    {result && <>
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
                    </>}
                </Content>
            </Drawer.Body>
            <Drawer.Footer>
                <Button appearance="secondary" label="Clear" disabled={(canAskAi && loading) || adding || draftBusy || (!question && !result)} onClick={clear} />
                <Button appearance="primary" label={canAskAi ? (answer ? "Send follow-up" : "Ask AI") : "Find searches"} disabled={!question.trim() || loading || adding || draftBusy} onClick={() => { void findMatches(question, canAskAi); }} />
            </Drawer.Footer>
        </Drawer>
    </>;
}
