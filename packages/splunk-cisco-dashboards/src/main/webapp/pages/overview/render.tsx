// Must run before any motion/framer-motion import so the patched
// window.require is in place when filter-props.mjs evaluates. See the
// shim's header comment for the full rationale.
import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import OverviewPage from './index';

// Tailwind utilities + scoped resets for the dashboard mount point.
import '@/common/styles/tailwind.css';

mountPageRaw(OverviewPage);
