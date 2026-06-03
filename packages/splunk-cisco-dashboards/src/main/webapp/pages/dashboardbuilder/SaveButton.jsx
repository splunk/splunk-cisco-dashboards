import React from 'react';
import propTypes from 'prop-types';
import styled from 'styled-components';
import { Item } from '@splunk/dashboard-toolbar';
import { _ } from '@splunk/ui-utils/i18n';
import Button from '@splunk/react-ui/Button';
import { has } from 'lodash-es';

// code snippet referred from dashboard-framework
const SpacedItem = styled(Item)`
    margin-left: 8px;
`;

const SaveButton = ({ onClick, isDirty, definition }) => {
    // get key indicator group name if visualization is present
    const isKIVizPresent = has(definition, 'visualizations.viz_keyIndicators');
    const kiVizOptions = isKIVizPresent && definition.visualizations.viz_keyIndicators.options;
    // check for valid threshold values for key indicators if present
    const kiOptions = kiVizOptions?.kis;
    const areKisPresent = Array.isArray(kiOptions) && kiOptions.length > 0;
    const areThresholdValuesInvalid =
        areKisPresent && kiOptions.some((ki) => !!ki.threshold && isNaN(ki.threshold));

    // keep the save button disabled if definition is not changed or
    // definition is changed but key indicator group name is invalid or
    // definition is changed but any key indicator threshold value is invalid
    const isDisabled =
        !isDirty ||
        (isDirty &&
            isKIVizPresent &&
            (!kiVizOptions?.groupName || (areKisPresent && areThresholdValuesInvalid)));

    return (
        <SpacedItem>
            <Button
                data-test="save-button"
                data-clickable
                onClick={onClick}
                tooltip={_('Save')}
                label={_('Save')}
                appearance="primary"
                disabled={isDisabled}
            />
        </SpacedItem>
    );
};

SaveButton.propTypes = {
    onClick: propTypes.func,
    isDirty: propTypes.bool,
    definition: propTypes.shape(),
};

SaveButton.defaultProps = {
    onClick: () => {},
    isDirty: false,
    definition: {},
};

export default SaveButton;
