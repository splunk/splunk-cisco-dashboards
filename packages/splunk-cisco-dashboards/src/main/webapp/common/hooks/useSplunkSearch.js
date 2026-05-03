import { useEffect, useRef, useState } from 'react';

import { runSearch } from '../services/splunkSearchService';

/**
 * React hook for fetching results from a Splunk search.
 * Cancels stale results if params change or the component unmounts.
 *
 * @param {Object} params - Same shape accepted by runSearch.
 * @returns {{ data: Array<Object>, loading: boolean, error: Error | null, refresh: () => void }}
 */
const useSplunkSearch = (params) => {
    const [state, setState] = useState({ data: [], loading: true, error: null });
    const [reloadToken, setReloadToken] = useState(0);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        setState((s) => ({ ...s, loading: true, error: null }));

        runSearch(params)
            .then((response) => {
                if (cancelled || !isMountedRef.current) return;
                setState({
                    data: (response && response.results) || [],
                    loading: false,
                    error: null,
                });
            })
            .catch((err) => {
                if (cancelled || !isMountedRef.current) return;
                // Surface a generic error in the UI; keep technical details
                // in the developer console only.

                console.error('Splunk search failed:', err);
                setState({
                    data: [],
                    loading: false,
                    error: new Error('Unable to load search results.'),
                });
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params && params.spl, params && params.tag, params && params.earliestTime, params && params.latestTime, reloadToken]);

    return {
        ...state,
        refresh: () => setReloadToken((t) => t + 1),
    };
};

export default useSplunkSearch;
