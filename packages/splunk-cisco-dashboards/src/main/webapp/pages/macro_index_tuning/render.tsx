import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import MacroIndexTuningPage from './index';

import '@/common/styles/tailwind.css';
import './macro-index-tuning.css';

mountPageRaw(MacroIndexTuningPage, { fixedColorScheme: 'dark' });
