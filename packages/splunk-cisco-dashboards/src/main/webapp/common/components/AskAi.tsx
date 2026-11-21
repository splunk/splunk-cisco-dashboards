import React, { useEffect, useId, useRef, useState } from 'react';
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

const QUESTION_STORAGE_KEY = 'scd:ask-ai:question';
const SEARCHBASE_LISTING_URL = 'https://splunkbase.splunk.com/app/7188';
const RESULT_BATCH_SIZE = 5;

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

    useEffect(() => () => { pending.current = null; }, []);
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

    async function findMatches() {
        const submitted = question.trim();
        if (!submitted || pending.current || adding) return;
        const request = {};
        pending.current = request;
        nextResultToFocus.current = null;
        setLoading(true);
        setResult(null);
        setFeedback(null);
        rememberQuestion(submitted);
        try {
            const catalogue = await getSearchbaseCatalogue({ allApps: true, includeHidden: true });
            if (pending.current === request) {
                const records = rankSearchbaseMatches(catalogue, submitted);
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

    function clear() {
        resumedQuestion.current = '';
        nextResultToFocus.current = null;
        setQuestion('');
        setResult(null);
        setFeedback(null);
        rememberQuestion('');
    }

    function showMoreResults() {
        if (!result || result.visibleCount >= result.records.length) return;
        nextResultToFocus.current = result.visibleCount;
        setResult({ ...result, visibleCount: Math.min(result.visibleCount + RESULT_BATCH_SIZE, result.records.length) });
    }

    function openDrawer() {
        setOpen(true);
        if (resumedQuestion.current) {
            resumedQuestion.current = '';
            void findMatches();
        }
    }

    return <>
        <Button
            appearance="secondary"
            label="Ask AI"
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
        <Drawer open={open} onRequestClose={() => setOpen(false)} returnFocus={trigger} width="min(560px, 100vw)">
            <Drawer.Header title="Ask AI" subtitle={context} />
            <Drawer.Body>
                <Content>
                    <p>Describe what you want to monitor. This preview finds matching searches in Searchbase.</p>
                    <form onSubmit={(event) => { event.preventDefault(); void findMatches(); }}>
                        <ControlGroup label="Monitoring question" help="For example, which sites have the most WAN packet loss?">
                            <Text
                                maxLength={ASK_SEARCHBASE_QUESTION_LIMIT}
                                value={question}
                                onChange={(_event, { value }) => setQuestion(value)}
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
                    {loading && <p role="status">Looking for Searchbase matches…</p>}
                    {result && <>
                        <Heading level={2} variant="title3">Searchbase matches</Heading>
                        <p role="status">{result.records.length
                            ? `Showing ${result.visibleCount} of ${result.records.length} ${result.records.length === 1 ? 'match' : 'matches'} for “${result.question}”.`
                            : `No close matches for “${result.question}”. Try a product name, metric, or data source.`}</p>
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
                                                to={splunkSearchbaseEditUrl(ambiguous ? undefined : record.id, 'basic-information')}>
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
                <Button appearance="secondary" label="Clear" disabled={loading || adding || (!question && !result)} onClick={clear} />
                <Button appearance="primary" label="Find searches" disabled={!question.trim() || loading || adding} onClick={() => { void findMatches(); }} />
            </Drawer.Footer>
        </Drawer>
    </>;
}
