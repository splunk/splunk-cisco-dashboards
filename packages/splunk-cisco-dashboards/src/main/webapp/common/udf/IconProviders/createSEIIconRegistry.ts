import {
    IconRegistry,
    LocalIconProvider,
} from '@splunk/dashboard-context';
import { StandardIconProvider } from '@splunk/dashboard-ui';

import SEIIconProvider from './SEIIconProvider';

export default function createSEIIconRegistry() {
    const iconRegistry = IconRegistry.create();

    iconRegistry.addDefaultProvider(new LocalIconProvider());
    iconRegistry.addProvider(new SEIIconProvider());
    iconRegistry.addProvider(new StandardIconProvider());

    return iconRegistry;
}
