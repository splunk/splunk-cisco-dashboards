import React from 'react';

import { WorkspaceModalShell } from './WorkspaceModalShell';

interface ChartFocusDialogProps {
    isOpen: boolean;
    label: string;
    subLabel?: string;
    onClose: () => void;
    onOpenInSearch?: () => void;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    children: React.ReactNode;
}

/**
 * Explicit, accessible focus view for compact categorical charts.
 *
 * This deliberately mirrors MetricItem's established expand interaction:
 * charts enlarge only after the user activates the Maximize button, never on
 * pointer hover. Keeping the interaction deliberate prevents a chart from
 * unexpectedly covering neighbouring tiles while an operator is scanning a
 * dense workspace.
 */
export const ChartFocusDialog: React.FC<ChartFocusDialogProps> = ({
    isOpen,
    label,
    subLabel,
    onClose,
    onOpenInSearch,
    onOpenDetailTable,
    detailTableTitle,
    children,
}) => {
    return (
        <WorkspaceModalShell
            isOpen={isOpen}
            variant="chart"
            title={label}
            subtitle={subLabel}
            onClose={onClose}
            onOpenInSearch={onOpenInSearch}
            onOpenDetailTable={onOpenDetailTable}
            detailTableTitle={detailTableTitle}
            contentClassName="overflow-y-auto sui-bg-section p-5"
        >
            {children}
        </WorkspaceModalShell>
    );
};
