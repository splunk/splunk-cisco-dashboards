import React, { useEffect, useRef, useState } from 'react';
import Button from '@splunk/react-ui/Button';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Drawer from '@splunk/react-ui/Drawer';
import Heading from '@splunk/react-ui/Heading';
import Message from '@splunk/react-ui/Message';
import Select from '@splunk/react-ui/Select';
import Text from '@splunk/react-ui/Text';
import { addLeadingSearchCommand } from '@splunk/splunk-utils/search';
import { variables } from '@splunk/themes';
import styled from 'styled-components';
import SearchbaseDrilldownGuidance from '@/common/components/workspace/SearchbaseDrilldownGuidance';
import { getCurrentSplunkUsername, userScopedStorageKey } from '@/common/config/insightsWorkspaces';
import { splunkSearchAppUrl, type SplunkSearchTimeRange } from '@/common/lib/splunkSearchUrl';
import { ASK_SEARCHBASE_QUESTION_LIMIT, rankSearchbaseMatches } from '@/common/services/askSearchbase';
import { getSearchbaseCatalogue, plainTextFromHtml, type SearchbaseRecord } from '@/common/services/searchbaseCatalogue';

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
        margin-top: ${variables.spacingSmall};
        white-space: pre-wrap;
    }
`;

const ActionRow = styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${variables.spacingSmall};
`;

const CatalogueDetails = styled.dl`
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: ${variables.spacingXSmall} ${variables.spacingSmall};
    margin: ${variables.spacingMedium} 0 0;

    dt { font-weight: ${variables.fontWeightSemiBold}; }
    dd { margin: 0; }
`;

const QUESTION_STORAGE_KEY = 'scd:ask-ai:question';

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
    add: (record: SearchbaseRecord) => Promise<'added' | 'already-present'>;
}

interface AskAiProps {
    context: string;
    contextId?: string;
    range?: SplunkSearchTimeRange & { label?: string };
    destinations?: readonly Destination[];
}

interface Result {
    question: string;
    records: SearchbaseRecord[];
}

export default function AskAi({ context, contextId = context, range, destinations }: AskAiProps) {
    const trigger = useRef<HTMLButtonElement | null>(null);
    const pending = useRef<object | null>(null);
    const activeContext = useRef(contextId);
    const [open, setOpen] = useState(false);
    const [question, setQuestion] = useState(readQuestion);
    const resumedQuestion = useRef(question);
    const [result, setResult] = useState<Result | null>(null);
    const [loading, setLoading] = useState(false);
    const [destinationId, setDestinationId] = useState('');
    const [adding, setAdding] = useState(false);
    const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);

    useEffect(() => () => { pending.current = null; }, []);
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
        setLoading(true);
        setResult(null);
        setFeedback(null);
        rememberQuestion(submitted);
        try {
            const catalogue = await getSearchbaseCatalogue({ allApps: true });
            if (pending.current === request) {
                setResult({ question: submitted, records: rankSearchbaseMatches(catalogue, submitted) });
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
    async function add(record: SearchbaseRecord) {
        if (!destination || adding) return;
        const targetContext = contextId;
        setAdding(true);
        setFeedback(null);
        try {
            const outcome = await destination.add(record);
            if (activeContext.current === targetContext) {
                const text = outcome === 'already-present'
                    ? `${record.searchName} is already in ${destination.title}.`
                    : `Added ${record.searchName} to ${destination.title} for you.`;
                setFeedback({ text });
            }
        } catch {
            if (activeContext.current === targetContext) {
                setFeedback({ text: `Could not add the search to ${destination.title}. Try again.`, error: true });
            }
        } finally {
            setAdding(false);
        }
    }

    function clear() {
        resumedQuestion.current = '';
        setQuestion('');
        setResult(null);
        setFeedback(null);
        rememberQuestion('');
    }

    function openDrawer() {
        setOpen(true);
        if (resumedQuestion.current) {
            resumedQuestion.current = '';
            void findMatches();
        }
    }

    return <>
        <Button appearance="secondary" label="Ask AI" elementRef={trigger} onClick={openDrawer} />
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
                    {feedback && <Message type={feedback.error ? 'error' : 'success'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</Message>}
                    {loading && <p role="status">Looking for Searchbase matches…</p>}
                    {result && <>
                        <Heading level={2} variant="title3">Searchbase matches</Heading>
                        <p role="status">{result.records.length
                            ? `${result.records.length} matches for “${result.question}”`
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
                        {result.records.map((record) => {
                            const description = plainTextFromHtml(record.description);
                            const needsInputs = /\$[\w.]+\$/.test(record.search);
                            return <SearchCard key={`${record.ownerApp}:${record.id}`}>
                                <Heading level={3} variant="title4">{record.searchName}</Heading>
                                <p>{[record.ownerApp, record.category, record.subCategory].filter(Boolean).join(' · ')}</p>
                                {description && <p>{description}</p>}
                                <details>
                                    <summary>Search details</summary>
                                    <SearchbaseDrilldownGuidance metadata={{ ...record, title: record.searchName }} appearance="inline" />
                                    <CatalogueDetails>
                                        {record.tags.length > 0 && <><dt>Tags</dt><dd>{record.tags.join(', ')}</dd></>}
                                        {record.defaultViz && <><dt>Default visualization</dt><dd>{record.defaultViz}</dd></>}
                                        <dt>Search ID</dt><dd><code>{record.id}</code></dd>
                                        {record.dispatchContext && record.dispatchContext !== record.ownerApp && (
                                            <><dt>Runs in Splunk app</dt><dd>{record.dispatchContext}</dd></>
                                        )}
                                    </CatalogueDetails>
                                </details>
                                <details>
                                    <summary>View SPL</summary>
                                    <pre tabIndex={0}><code>{record.search}</code></pre>
                                </details>
                                {needsInputs && <p>This search needs inputs from its original view.</p>}
                                <ActionRow>
                                    {!needsInputs && <Button appearance="secondary" label="Open in Search" openInNewContext
                                        to={splunkSearchAppUrl(addLeadingSearchCommand(record.search), range, record.dispatchContext)} />}
                                    {!needsInputs && destination && <Button appearance="secondary" label="Add for me" disabled={adding}
                                        onClick={() => { void add(record); }} />}
                                </ActionRow>
                            </SearchCard>;
                        })}
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
