import React, { useCallback, useState, useEffect } from 'react';
import Button from '@splunk/react-ui/Button';
import Paintbrush from '@splunk/react-icons/Paintbrush';
import Tooltip from '@splunk/react-ui/Tooltip';

const generateRandomString = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

const newTemplateVizConfig = (search, searchKey) => {
    var vizOptions = { readonly: true };

    return {
        visualizationId: `viz_template_${generateRandomString()}`,
        visualizationDefinition: {
            type: 'splunk.template_kpi',
            title: '[[Title]]',
            options: vizOptions,
        },
    };
};

const TemplateVizButton = (props) => {
    return (
        <Tooltip content="Add a placeholder for data visualization">
            <Button
                style={{ maxWidth: 32 }}
                appearance="subtle"
                icon={<Paintbrush width={20} height={20}></Paintbrush>}
                onClick={() => {
                    const { dashboardApi } = props;
                    dashboardApi.coreApi.createVisualization(newTemplateVizConfig());
                }}
            ></Button>
        </Tooltip>
    );
};

export default TemplateVizButton;
