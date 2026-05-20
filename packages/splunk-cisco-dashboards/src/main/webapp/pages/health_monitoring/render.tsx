// Must run before any motion/framer-motion import so the patched
// window.require is in place when filter-props.mjs evaluates.
import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import HealthMonitoringDashboard from './index';

import '@/common/styles/tailwind.css';

mountPageRaw(HealthMonitoringDashboard);
