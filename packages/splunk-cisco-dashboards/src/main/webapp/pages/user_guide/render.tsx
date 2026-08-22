/* eslint-disable react/jsx-filename-extension */
import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import UserGuidePage from './index';

import '@/common/styles/tailwind.css';

// Share Home's account-scoped appearance preference so the guide opens in the
// same mode and exposes the same Light/Dark choices.
mountPageRaw(UserGuidePage, { allowColorSchemeChoice: true });
