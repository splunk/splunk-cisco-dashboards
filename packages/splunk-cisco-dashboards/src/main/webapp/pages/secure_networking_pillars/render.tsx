// Must run before motion/styled-component imports in the page dependency graph.
import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import SecureNetworkingPillarsPage from './index';

import '@/common/styles/tailwind.css';
import './secure-networking-pillars.css';

mountPageRaw(SecureNetworkingPillarsPage, {
    allowColorSchemeChoice: true,
});

