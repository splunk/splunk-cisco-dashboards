import EnterpriseViewOnlyPreset from '@splunk/dashboard-presets/EnterpriseViewOnlyPreset';

import VizOther from '../viz-other/VizOther';
import VizKpi from '../viz-kpi/VizKpi';

// Extend the EnterpriseViewOnlyPreset to include VizKpi
const customPreset = {
    ...EnterpriseViewOnlyPreset,
    visualizations: {
        ...EnterpriseViewOnlyPreset.visualizations,
        'splunk.custom_kpi': VizKpi,
        'splunk.custom_other': VizOther,
    },
};

export default customPreset;
