import {
    IconRegistry,
    LocalIconProvider,
    StandardIconProvider,
} from '@splunk/dashboard-context';

import SEIIconProvider from './SEIIconProvider';

export default function createSEIIconRegistry() {
    const iconRegistry = IconRegistry.create();

    iconRegistry.addDefaultProvider(new LocalIconProvider());
    iconRegistry.addProvider(new SEIIconProvider());
    iconRegistry.addProvider(new StandardIconProvider());

    return iconRegistry;
}