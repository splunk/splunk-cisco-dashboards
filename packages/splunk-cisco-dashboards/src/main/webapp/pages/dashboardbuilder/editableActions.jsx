import React from 'react';
import { LayerButton, DeleteButton } from '@splunk/dashboard-action-buttons';

// Action menu in Editable mode
const layerButton = <LayerButton key="layer" />;
const deleteButton = <DeleteButton key="delete" />;

export default [
    layerButton, // does not work for grid layout
    deleteButton,
];
