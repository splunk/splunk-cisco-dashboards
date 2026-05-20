import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import TopologyCanvasPage from './index';

import '@/common/styles/tailwind.css';

mountPageRaw(TopologyCanvasPage);
