import React from 'react';
import EnterprisePreset from '@splunk/dashboard-presets/EnterprisePreset';

// Visualization schemas 28.8.0 omit types on these literal branches. Repair
// our preset before Studio builds the editor and worker validation schemas.
// Leave dynamic expressions, constraints, and the shared vendor preset intact.
export function normalizeNetworkGraphSchema(optionsSchema) {
    let normalized = optionsSchema;
    for (const [name, type, keyword] of [
        ['hierarchyDirection', 'string', 'pattern'],
        ['linkStrength', 'number', 'minimum'],
    ]) {
        const option = optionsSchema?.[name];
        if (!Array.isArray(option?.anyOf)) continue;
        const needsType = (branch) => branch && branch.type === undefined
            && Object.prototype.hasOwnProperty.call(branch, keyword);
        if (!option.anyOf.some(needsType)) continue;
        normalized = {
            ...normalized,
            [name]: {
                ...option,
                anyOf: option.anyOf.map((branch) => needsType(branch) ? { ...branch, type } : branch),
            },
        };
    }
    return normalized;
}

export function withNetworkGraphSchemaTypes(preset) {
    const NetworkGraph = preset.visualizations?.['splunk.networkGraph'];
    const originalSchema = NetworkGraph?.config?.optionsSchema;
    const optionsSchema = normalizeNetworkGraphSchema(originalSchema);
    if (optionsSchema === originalSchema) return preset;

    const TypedNetworkGraph = (props) => React.createElement(NetworkGraph, props);
    Object.assign(TypedNetworkGraph, NetworkGraph, {
        displayName: 'DashboardManagerNetworkGraph',
        config: { ...NetworkGraph.config, optionsSchema },
    });

    return {
        ...preset,
        visualizations: { ...preset.visualizations, 'splunk.networkGraph': TypedNetworkGraph },
    };
}

export default withNetworkGraphSchemaTypes(EnterprisePreset);
