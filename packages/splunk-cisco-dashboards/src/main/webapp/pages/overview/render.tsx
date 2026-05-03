import mountPageRaw from '@/common/render-raw';
import OverviewPage from './index';

// Tailwind utilities + scoped resets for the dashboard mount point.
import '@/common/styles/tailwind.css';

mountPageRaw(OverviewPage);
