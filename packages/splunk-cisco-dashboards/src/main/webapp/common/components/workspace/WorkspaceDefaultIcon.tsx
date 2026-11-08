import React from 'react';
import Briefcase from '@splunk/react-icons/Briefcase';
import ShieldKeyhole from '@splunk/react-icons/ShieldKeyhole';
import Shield from '@splunk/react-icons/Shield';
import FingerprintNodes from '@splunk/react-icons/FingerprintNodes';
import Pulse from '@splunk/react-icons/Pulse';
import NetworkDevices from '@splunk/react-icons/NetworkDevices';
import RobotFaceSparkle from '@splunk/react-icons/RobotFaceSparkle';
import type { InsightsWorkspace } from '@/common/config/insightsWorkspaces';

export const workspaceIconName = (workspace: Pick<InsightsWorkspace, 'id' | 'sourceWorkspace'>) => {
    if (workspace.sourceWorkspace === 'dc_networking') return 'network';
    if (workspace.id.includes('zero_trust')) return 'access';
    if (workspace.id.includes('resilience')) return 'pulse';
    if (workspace.sourceWorkspace === 'agentic_soc') return 'soc';
    if (workspace.id.includes('security_operations')) return 'security';
    if (workspace.sourceWorkspace === 'secure_networking') return 'secure';
    return 'executive';
};

const icons = { network: NetworkDevices, access: FingerprintNodes, pulse: Pulse,
    soc: RobotFaceSparkle, security: Shield, secure: ShieldKeyhole, executive: Briefcase };

export default function WorkspaceDefaultIcon({ workspace }: { workspace: Pick<InsightsWorkspace, 'id' | 'sourceWorkspace'> }) {
    const Icon = icons[workspaceIconName(workspace)];
    return <Icon aria-hidden="true" width="100%" height="100%" />;
}
