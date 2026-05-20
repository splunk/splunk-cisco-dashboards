import '@/common/shims/requirejs-emotion-shim';

import mountPageRaw from '@/common/render-raw';
import NetworkDiagramPage from './index';

import '@/common/styles/tailwind.css';
import '@/common/components/diagram/networkDiagram.css';

mountPageRaw(NetworkDiagramPage);
