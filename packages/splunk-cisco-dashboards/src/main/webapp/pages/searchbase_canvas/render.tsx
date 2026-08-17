import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import SearchbaseCanvasPage from './index';

import '@/common/styles/tailwind.css';

mountPageRaw(SearchbaseCanvasPage, {
    allowColorSchemeChoice: true,
    colorSchemeStorageKey:
        'splunk-cisco-dashboards:searchbase-canvas-color-scheme',
});
