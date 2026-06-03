import {
    IconRegistry,
    LocalIconProvider,
    StandardIconProvider,
} from '@splunk/dashboard-context';

import IS4SIconProvider from './IS4SIconProvider';

export default function createIS4SIconRegistry() {
    const iconRegistry = IconRegistry.create();

    iconRegistry.addDefaultProvider(new LocalIconProvider());
    iconRegistry.addProvider(new IS4SIconProvider());
    iconRegistry.addProvider(new StandardIconProvider());

    return iconRegistry;
}