import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import MacroIndexTuningPage, {
    SETUP_COLOR_SCHEME_STORAGE_KEY,
} from './index';

import '@/common/styles/tailwind.css';

const setupMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('setup') === '1';

mountPageRaw(
    MacroIndexTuningPage,
    setupMode
        ? {
              allowColorSchemeChoice: true,
              colorSchemeStorageKey: SETUP_COLOR_SCHEME_STORAGE_KEY,
          }
        : undefined
);
