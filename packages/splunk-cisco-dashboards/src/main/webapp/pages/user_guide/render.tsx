/* eslint-disable react/jsx-filename-extension */
import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import UserGuidePage from './index';

import '@/common/styles/tailwind.css';

mountPageRaw(UserGuidePage);
