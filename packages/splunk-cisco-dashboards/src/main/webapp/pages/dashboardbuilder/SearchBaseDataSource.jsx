import hash from 'hash-it';
import { mapKeys } from 'lodash';

import { console, noop, getDefaultDataSourceName } from '@splunk/dashboard-utils';
import { createPostSearchQueryArray, mergeSearches } from '@splunk/datasource-utils';
import SearchJob from '@splunk/search-job';
import { _ } from '@splunk/ui-utils/i18n';

import { DataSet, DS_STATUS } from '@splunk/datasource-utils';
import { DataSource } from '@splunk/datasources';
import { pick, get } from 'lodash';
import { Observable } from 'rxjs';
import moment from '@splunk/moment';
import { app } from '@splunk/splunk-utils/config';
import { getSearchBaseConfStanza } from '../../common/lib/searchbase';

const deprecatedSearchMetas = ['resultCount', 'isDone', 'dispatchState'];

const isRealTimeProgress = (progress) => {
    return progress?.content?.isRealTimeSearch ?? false;
};

const transformObserver = (observer, search) => ({
    next: (response) => observer.next(response),
    error: (err) =>
        observer.error({
            level: 'error',
            message: err.message,
            meta: {
                search,
            },
        }),
    complete: () => observer.complete(),
});

const combineResultWhenProgress = (resultsObservable, progressObservable, callback) =>
    Observable.combineLatest(resultsObservable, progressObservable, callback);

const combineResultWhenFinalized = (resultsObservable, progressObservable, callback) =>
    Observable.forkJoin(resultsObservable, progressObservable, callback);

const getEnterpriseSearchContext = (context) => {
    return { keepAlive: true, cache: false, app, ...context };
};

const ownRequestParams = {
    output_mode: 'json_cols',
    show_metadata: true,
};

const defaultParams = {
    preview: true,
};

const defaultRequestParams = {
    count: 0,
    offset: 0,
    progress: true,
};

const paramsMapping = {
    earliest: 'earliest_time',
    latest: 'latest_time',
    searchMode: 'adhoc_search_level',
    sampleRatio: 'sample_ratio',
};

const VALID_SPAN_PATTERN = /^[1-9]\d*(?:s|m|h|d|w|mon|qtr|y)$/i;

const normalizeSpanOverride = (span) => {
    if (typeof span !== 'string') {
        return '';
    }

    const normalizedSpan = span.trim();
    return normalizedSpan.toLowerCase() !== 'auto' && VALID_SPAN_PATTERN.test(normalizedSpan)
        ? normalizedSpan
        : '';
};

const applySpanOverride = (search, span) => {
    const spanOverride = normalizeSpanOverride(span);
    if (!spanOverride || typeof search !== 'string') {
        return search;
    }

    const timechartSearch = search.replace(/(\|\s*timechart\b)([^|\r\n]*)/gi, (command) => {
        if (/\bspan\s*=\s*[^\s,]+/i.test(command)) {
            return command.replace(/\bspan\s*=\s*[^\s,]+/i, `span=${spanOverride}`);
        }
        if (/\bbins\s*=\s*\d+/i.test(command)) {
            return command.replace(/\bbins\s*=\s*\d+/i, `span=${spanOverride}`);
        }
        return command.replace(/\btimechart\b/i, `timechart span=${spanOverride}`);
    });

    return timechartSearch.replace(/(\|\s*tstats\b)([^|\r\n]*)/gi, (command) => {
        if (!/\bby\b[^|\r\n]*\b_time\b/i.test(command)) {
            return command;
        }
        if (/\b_time\b\s+span\s*=\s*[^\s,]+/i.test(command)) {
            return command.replace(
                /(\b_time\b\s+span\s*=\s*)[^\s,]+/i,
                `$1${spanOverride}`,
            );
        }
        return command.replace(/\b_time\b/i, `_time span=${spanOverride}`);
    });
};

const parseQueryParameters = (options) => ({
    ...defaultParams,
    ...mapKeys(options.queryParameters, (_value, key) => {
        return paramsMapping[key] || key;
    }),
});

const noCollectInSplRegex = /\|\s*collect/gi;
const APP_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_\-.]{0,127}$/;

const normalizeDispatchContext = (content = {}) => {
    const dispatchContext =
        typeof content.dispatch_context === 'string'
            ? content.dispatch_context.trim()
            : '';
    return APP_NAME_PATTERN.test(dispatchContext) ? dispatchContext : undefined;
};

const isDispatchContextForced = (content = {}) =>
    typeof content.dispatch_context_force === 'string' &&
    /^(1|true|yes)$/i.test(content.dispatch_context_force.trim());

const getEmptyResultMessage = (content = {}, ref = '') => {
    const configuredMessage =
        typeof content.empty_message === 'string' ? content.empty_message.trim() : '';

    if (configuredMessage) {
        return configuredMessage;
    }

    const searchName =
        typeof content.search_name === 'string' && content.search_name.trim()
            ? content.search_name.trim()
            : ref || 'this panel';
    const tags =
        typeof content.tags === 'string'
            ? content.tags
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean)
            : [];
    const sourceHint = tags.length
        ? ` Confirm the ${tags.join(', ')} data source is onboarded and enabled, or widen the time range.`
        : ' Confirm the relevant data source is onboarded and enabled, or widen the time range.';

    return `No matching telemetry was found for ${searchName} in the selected time range. This can be expected when the condition this panel detects did not occur.${sourceHint}`;
};

const previewFetchPredicate = (searchState) => {
    if (get(searchState, ['content', 'isRealTimeSearch'], false)) {
        return true;
    }
    // we do a fetch when
    // 1. result count > 0
    // 2. search is done so we can make sure we always return the result
    return (
        get(searchState, ['content', 'resultPreviewCount'], 0) > 0 ||
        !!get(searchState, ['content', 'isDone'])
    );
};

const getStatusMessage = ({ status, isRealTimeSearch, totalCount, emptyResultMessage }) => {
    if (status === 'running') {
        if (isRealTimeSearch) {
            return _('Real-time search is running');
        }
        if (totalCount === 0) {
            return _('Search is running, but not enough data to render visualization');
        }
    }
    if (status === 'queued') {
        return _('Search is not yet running, queued on server');
    }
    if (status === 'parsing') {
        return _('Search is not yet running, queued on server');
    }
    if (status === 'done' && totalCount === 0) {
        return emptyResultMessage || _('Search ran successfully, but no results were returned');
    }

    return '';
};

const projectFunc = (results, progress, search, emptyResultMessage) => {
    const {
        fields,
        columns,
        results: searchResult,
        messages,
        post_process_count: postProcessCount,
        highlighted,
        tags,
    } = results;

    // handle output_mode: json
    const data =
        searchResult && !columns
            ? DataSet.fromJSONArray(fields, searchResult)
            : DataSet.fromJSONCols(fields, columns);

    const { isRealTimeSearch, resultPreviewCount, resultCount } = progress.content;

    // totalCount is required for pagination.
    let totalCount;
    if (postProcessCount != null) {
        // for post process searches, the totalCount is post_process_count in the results, NOT the resultPreviewCount/resultCount in the jobProperties.
        totalCount = postProcessCount;
    } else if (resultPreviewCount != null) {
        // we look at resultPreviewCount since that is always set when preview = true.
        // when search job is done, resultPreviewCount can be null,
        // see https://splunk.slack.com/archives/C8YPWKC4U/p1591290195175900 for more context.
        totalCount = resultPreviewCount;
    } else {
        totalCount = resultCount;
    }
    const status = progress.content.dispatchState.toLowerCase();

    return {
        data,
        meta: {
            ...pick(progress.content, deprecatedSearchMetas),
            sid: progress.content.sid,
            app: progress.acl?.app,
            totalCount,
            status,
            statusMessage: getStatusMessage({
                status,
                isRealTimeSearch,
                totalCount,
                emptyResultMessage,
            }),
            // need to manually convert progress from [0, 1] to [0, 100]
            percentComplete:
                status === 'done' ? 100 : Math.round(progress.content.doneProgress * 100),
            isRealTimeSearch,
            lastUpdated: moment(progress.published)
                .add(pick(progress.content, 'runDuration'), 'seconds')
                .toISOString(),
            search,
            serverLog: Array.isArray(messages)
                ? messages.map((m) => ({ level: m.type, message: m.text }))
                : undefined,
            highlighted,
            tags,
        },
    };
};

class SearchBaseSearch extends DataSource {
    static config;

    constructor(options = {}, context = {}, meta = {}) {
        super(options, context);

        if (!this.options.ref) {
            throw Error('ref search id required!');
        }

        const { ownerApp, ...searchbaseOptions } = options;
        const { span, ...queryParameters } = searchbaseOptions.queryParameters || {};
        this.ownerApp = ownerApp;
        this.spanOverride = normalizeSpanOverride(span);
        this.context = getEnterpriseSearchContext(this.context);
        this.options = {
            ...parseQueryParameters({ ...searchbaseOptions, queryParameters }),
            ref: searchbaseOptions.ref,
            check_risky_command: searchbaseOptions.checkRiskyCommand,
            label: this.context.id,
        };

        if (this.context.auditProvenance) {
            this.options.provenance = this.context.auditProvenance;
        }

        this.meta = meta;
    }

    async setup() {
        try {
            const { splunkdPath, sessionKey } = this.context;
            if (splunkdPath) {
                SearchJob.setSplunkConfig({ splunkdPath });
            }
            if (sessionKey) {
                SearchJob.setBaseFetchInit({
                    headers: {
                        Authorization: `Splunk ${sessionKey}`,
                    },
                });
            }

            this.isPaused = false;
            let data = await getSearchBaseConfStanza(this.options.ref, this.ownerApp);
            if (data.status >= 200 && data.status < 300) {
                const content = data.entry[0].content || {};
                this.emptyResultMessage = getEmptyResultMessage(content, this.options.ref);
                this.options = {
                    ...this.options,
                    search: applySpanOverride(content.search, this.spanOverride),
                };

                const dispatchContext = normalizeDispatchContext(content);
                if (dispatchContext && isDispatchContextForced(content)) {
                    this.context.app = dispatchContext;
                }

                this.searchJob = SearchJob.create(this.options, this.context);
                const sid = await this.searchJob.getSid().first().toPromise();

                return sid;
            } else {
                console.error('failed to create search job:', e);
                return null;
            }
        } catch (e) {
            if (e instanceof Error) {
                console.error('failed to create search job:', e);

                this.setupError = e;
            }
            return null;
        }
    }
    /*
    request(requestParams = {}) {
        if (this.setupError) {
            return (observer) => {
                observer?.error({
                    level: 'error',
                    message: this.setupError?.message,
                    meta: {
                        search: this.options.search,
                    },
                });
                return noop;
            };
        }

        const key = hash(requestParams);
        let requestResult = this.results?.[key];

        if (!requestResult && this.searchJob) {
            let searchRequestParams = requestParams;

            const params = {
                ...defaultRequestParams,
                ...ownRequestParams,
                ...searchRequestParams,
            };

            if (params.sort) {
                let sortStr = '';
                Object.entries(params.sort).forEach(([sortKey, sortDir]) => {
                    sortStr += sortDir === 'desc' ? ` -"${sortKey}"` : ` +"${sortKey}"`;
                });

                if (sortStr) {
                    params.search = params.search ? `${params.search} | sort 0` : '| sort 0';
                    params.search += sortStr;
                }
                delete params.sort;
            }

            const progressObservable = this.searchJob.getProgress();

            if (params.progress) {
                requestResult = combineResultWhenProgress(
                    this.searchJob.getResultsPreview(params, {
                        fetchPredicate: this.fetchPredicate,
                    }),
                    progressObservable
                );
            }
        }
    }*/

    request(requestParams = {}) {
        if (this.setupError) {
            return (observer) => {
                observer?.error({
                    level: 'error',
                    message: this.setupError?.message,
                    meta: {
                        search: this.options.search,
                    },
                });

                return noop;
            };
        }

        const key = hash(requestParams);
        let requestResult = this.results?.[key];

        // One observable serves for all viz and ds subscription with same requestParams
        if (!requestResult && this.searchJob) {
            let searchRequestParams = requestParams;

            const params = {
                ...defaultRequestParams,
                ...ownRequestParams,
                ...searchRequestParams,
            };

            if (params.sort) {
                let sortStr = '';

                Object.entries(params.sort).forEach(([sortKey, sortDir]) => {
                    if (sortDir === 'desc') {
                        sortStr += ` -"${sortKey}"`;
                    } else if (sortDir === 'asc') {
                        sortStr += ` +"${sortKey}"`;
                    }
                });

                if (sortStr) {
                    if (params.search) {
                        params.search += ' | sort 0';
                    } else {
                        params.search = '| sort 0';
                    }

                    params.search += sortStr;
                }

                delete params.sort;
            }

            const progressObservable = this.searchJob.getProgress();

            if (params.progress) {
                requestResult = combineResultWhenProgress(
                    this.searchJob.getResultsPreview(params, {
                        fetchPredicate: this.fetchPredicate,
                    }),
                    progressObservable,
                    // populate the search query to the chained data source for construct the chain-chain query
                    this.combineResultCallback(searchRequestParams.search),
                );
            } else {
                requestResult = combineResultWhenFinalized(
                    this.searchJob.getResults(params),
                    progressObservable,
                    this.combineResultCallback(searchRequestParams.search),
                );
            }

            this.results ??= {};
            this.results[key] = requestResult;
        }

        return (observer) => {
            // note: due to the nature that 'data' and 'meta' are from two different endpoints, there's no
            // way to guarantee that they always match. But they'll eventually match when search is done.
            // no search job? then return a empty Observable
            const result = requestResult || Observable.of();
            const subscription = result.subscribe(
                transformObserver(observer, this.completeSearchQuery || this.options.search),
            );

            return () => {
                subscription.unsubscribe();
            };
        };
    }

    async pause() {
        const observable = this.isPaused ? Observable.of() : this.searchJob.pause().first();

        this.isPaused = true;
        return observable.toPromise();
    }

    async resume() {
        const observable = !this.isPaused ? Observable.of() : this.searchJob.unpause().first();

        this.isPaused = false;
        return observable.toPromise();
    }

    supportsControlActions() {
        return this.isRealTimeSearch;
    }

    async teardown() {
        this.results = null;
        // chain search does not cancel search job

        try {
            const { cache } = this.context;
            if (!cache && this.searchJob) {
                return this.searchJob.cancel().first().toPromise();
            }
            return null;
        } catch (ex) {
            console.error('failed to cancel search job:', ex);
            return null;
        }
    }

    getObserver = () => ({
        next: ({ meta }) => {
            const { sid, search, checkRiskyCommand, completeSearchQuery } = meta;

            if (
                this.options.sid !== sid ||
                this.options.check_risky_command !== checkRiskyCommand ||
                this.parentChainQuery !== search ||
                this.completeSearchQuery !== completeSearchQuery
            ) {
                this.options.sid = sid;
                this.options.check_risky_command = checkRiskyCommand;
                this.parentChainQuery = search;
                this.completeSearchQuery = completeSearchQuery;
                this.results = {};
                this.shouldRefreshSub = true;
                this.isRealTimeSearch = false;

                // re-create SearchJob. setup() is async but should be fine here
                this.setup();
            } else {
                this.shouldRefreshSub = false;
            }
        },
        error: (error) => {
            if (error instanceof Error) {
                console.log(error);
            }
        },
        complete: noop,
    });

    shouldRefreshSubscription() {
        return this.shouldRefreshSub;
    }

    validation() {
        const { search } = this.options;
        if (search && noCollectInSplRegex.test(search)) {
            throw new Error(
                _(
                    `The "collect" command cannot be used in a base search. Use an ad-hoc search for data source ${this.context.id} to use the "collect" command.`,
                ),
            );
        }
    }

    combineResultCallback = (search = '') => {
        return (results, progress) => {
            this.isRealTimeSearch = isRealTimeProgress(progress);
            return projectFunc(results, progress, search, this.emptyResultMessage);
        };
    };

    fetchPredicate = (searchState) => {
        if (this.isPaused) {
            return false;
        }

        return previewFetchPredicate(searchState);
    };
}

export default SearchBaseSearch;
