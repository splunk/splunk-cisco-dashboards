import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import SecureOperationsGlassPage from './index';

import '@/common/styles/tailwind.css';
import './secure-operations-glass.css';

mountPageRaw(SecureOperationsGlassPage);
