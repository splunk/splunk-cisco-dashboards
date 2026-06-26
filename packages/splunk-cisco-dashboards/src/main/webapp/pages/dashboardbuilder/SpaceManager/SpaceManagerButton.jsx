import React from 'react';
import PropTypes from 'prop-types';
import { IconButton } from '@splunk/dashboard-toolbar';
import Tooltip from '@splunk/react-ui/Tooltip';
import Buildings from '@splunk/react-icons/Buildings';
import { cloneDeep } from 'lodash-es';

const SPACE_MANAGER_VIZ_TYPE = 'splunk.cisco_spaces_space_manager';
const LAYOUT_MARGIN = 24;
const LAYOUT_GAP = 24;
const DEFAULT_WIDTH = 1180;
const DEFAULT_HEIGHT = 720;

const generateRandomString = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    return Array.from({ length }, () =>
        characters.charAt(Math.floor(Math.random() * characters.length)),
    ).join('');
};

const newSpaceManagerVizConfig = () => {
    return {
        visualizationId: `viz_spaceManager_${generateRandomString()}`,
        visualizationDefinition: {
            type: SPACE_MANAGER_VIZ_TYPE,
            title: 'Cisco Spaces Space Manager',
            options: {
                title: 'Cisco Spaces Space Manager',
                siteName: 'Cisco Spaces',
                floorName: 'First Floor',
            },
        },
    };
};

const getActiveLayout = (definition, dashboardApi) => {
    const layout = definition?.layout;
    if (!layout) {
        return undefined;
    }

    if (layout.layoutDefinitions) {
        const activeTab = dashboardApi.getActiveTab?.();
        const activeLayoutKey =
            activeTab && layout.layoutDefinitions[activeTab]
                ? activeTab
                : Object.keys(layout.layoutDefinitions)[0];

        return activeLayoutKey ? layout.layoutDefinitions[activeLayoutKey] : undefined;
    }

    return layout;
};

const getLayoutBounds = (structure = []) =>
    structure.reduce(
        (bounds, item) => {
            const position = item?.position || {};
            const x = Number(position.x) || 0;
            const y = Number(position.y) || 0;
            const w = Number(position.w) || 0;
            const h = Number(position.h) || 0;

            return {
                bottom: Math.max(bounds.bottom, y + h),
                right: Math.max(bounds.right, x + w),
            };
        },
        { bottom: 0, right: 0 },
    );

const applySpaceManagerLayout = (dashboardApi, visualizationId) => {
    const definition = cloneDeep(dashboardApi.coreApi.getDefinition());
    const activeLayout = getActiveLayout(definition, dashboardApi);

    if (!activeLayout) {
        return;
    }

    const existingStructure = (activeLayout.structure || []).filter(
        (item) => item?.item !== visualizationId,
    );
    const canvasOptions = activeLayout.options || definition.layout?.options || {};
    const canvasWidth = Number(canvasOptions.width) || 1440;
    const tileWidth = Math.min(DEFAULT_WIDTH, Math.max(640, canvasWidth - LAYOUT_MARGIN * 2));
    const tileHeight = DEFAULT_HEIGHT;
    const startY =
        existingStructure.length === 0
            ? LAYOUT_MARGIN
            : Math.ceil((getLayoutBounds(existingStructure).bottom + LAYOUT_GAP) / LAYOUT_GAP) *
              LAYOUT_GAP;

    const createdStructure = {
        item: visualizationId,
        position: {
            h: tileHeight,
            w: tileWidth,
            x: LAYOUT_MARGIN,
            y: startY,
        },
        type: 'block',
    };
    const nextHeight =
        getLayoutBounds([...existingStructure, createdStructure]).bottom + LAYOUT_MARGIN;

    activeLayout.structure = [...existingStructure, createdStructure];
    activeLayout.options = {
        ...activeLayout.options,
        height: Math.max(Number(activeLayout.options?.height) || 0, nextHeight),
        width: canvasWidth,
    };

    if (dashboardApi.updateDefinition) {
        dashboardApi.updateDefinition(definition);
    } else {
        dashboardApi.coreApi.updateDefinition?.(definition);
    }
};

const SpaceManagerButton = ({ iconColor, ...props }) => {
    const handleClick = () => {
        const { dashboardApi } = props;
        const visualizationConfig = newSpaceManagerVizConfig();

        dashboardApi.coreApi.createVisualization(visualizationConfig);
        applySpaceManagerLayout(dashboardApi, visualizationConfig.visualizationId);
    };

    return (
        <Tooltip content="Cisco extension: add Cisco Spaces Space Manager">
            <IconButton
                data-test="space-manager-toolbar-button"
                icon={<Buildings height={24} width={24} style={{ color: iconColor }} />}
                onClick={handleClick}
                style={{ maxWidth: 40, marginLeft: 4 }}
            />
        </Tooltip>
    );
};

SpaceManagerButton.propTypes = {
    ...IconButton.propTypes,
    iconColor: PropTypes.string,
};

SpaceManagerButton.defaultProps = {
    ...IconButton.defaultProps,
    iconColor: '#177ddc',
};

export default SpaceManagerButton;
