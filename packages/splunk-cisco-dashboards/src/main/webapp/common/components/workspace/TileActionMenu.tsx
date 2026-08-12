import React, { createContext, useContext } from 'react';
import Button from '@splunk/react-ui/Button';
import Dropdown from '@splunk/react-ui/Dropdown';
import Menu from '@splunk/react-ui/Menu';
import {
    ExternalLink,
    Maximize2,
    MoreVertical,
    PanelRightOpen,
    Settings2,
    EyeOff,
    Trash2,
} from '@/common/icons/SuiIcon';

export interface TileRemovalAction {
    kind: 'hide' | 'remove';
    label: string;
    onClick: () => void;
}

export const TileRemovalActionContext = createContext<TileRemovalAction | null>(null);

interface TileActionEnvironment {
    announce: (message: string) => void;
    returnFocus: () => void;
}

export const TileActionEnvironmentContext = createContext<TileActionEnvironment | null>(null);

interface TileActionMenuProps {
    label: string;
    onOpenInSearch?: () => void;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    onExpand?: () => void;
    onConfigure?: (returnFocus?: HTMLElement | null) => void;
    isCustomized?: boolean;
}

const ActionIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
        {children}
    </span>
);

export const TileActionMenu: React.FC<TileActionMenuProps> = ({
    label,
    onOpenInSearch,
    onOpenDetailTable,
    detailTableTitle,
    onExpand,
    onConfigure,
    isCustomized = false,
}) => {
    const toggleRef = React.useRef<HTMLAnchorElement | HTMLButtonElement>(null);
    const removalAction = useContext(TileRemovalActionContext);
    const actionEnvironment = useContext(TileActionEnvironmentContext);
    if (!onOpenInSearch && !onOpenDetailTable && !onExpand && !onConfigure && !removalAction) {
        return null;
    }

    const openInSearch = () => {
        onOpenInSearch?.();
        window.requestAnimationFrame(() => toggleRef.current?.focus());
    };

    const configure = () => onConfigure?.(toggleRef.current);

    const removeOrHide = () => {
        if (!removalAction) return;
        removalAction.onClick();
        actionEnvironment?.announce(`${removalAction.label}.`);
        window.requestAnimationFrame(() => actionEnvironment?.returnFocus());
    };

    return (
        <Dropdown
            focusToggleReasons={["escapeKey", "tabKey", "toggleClick"]}
            toggle={
                <Button
                    appearance="subtle"
                    data-tile-control="true"
                    elementRef={toggleRef}
                    hideLabel
                    icon={<MoreVertical aria-hidden="true" />}
                    label={`Actions for ${label}`}
                />
            }
        >
            <Menu>
                <Menu.Heading title>Tile actions</Menu.Heading>
                {onOpenInSearch && (
                    <Menu.Item
                        description="Opens new window"
                        onClick={openInSearch}
                        startAdornment={
                            <ActionIcon>
                                <ExternalLink />
                            </ActionIcon>
                        }
                    >
                        Open in Search
                    </Menu.Item>
                )}
                {onOpenDetailTable && (
                    <Menu.Item
                        description={detailTableTitle}
                        onClick={onOpenDetailTable}
                        startAdornment={
                            <ActionIcon>
                                <PanelRightOpen />
                            </ActionIcon>
                        }
                    >
                        Open details
                    </Menu.Item>
                )}
                {onExpand && (
                    <Menu.Item
                        onClick={onExpand}
                        startAdornment={
                            <ActionIcon>
                                <Maximize2 />
                            </ActionIcon>
                        }
                    >
                        Expand visualization
                    </Menu.Item>
                )}
                {onConfigure && (
                    <Menu.Item
                        description={isCustomized ? "Customized" : undefined}
                        onClick={configure}
                        startAdornment={
                            <ActionIcon>
                                <Settings2 />
                            </ActionIcon>
                        }
                    >
                        Configure tile
                    </Menu.Item>
                )}
                {removalAction && (
                    <Menu.Item
                        onClick={removeOrHide}
                        startAdornment={
                            <ActionIcon>
                                {removalAction.kind === 'hide' ? <EyeOff /> : <Trash2 />}
                            </ActionIcon>
                        }
                    >
                        {removalAction.label}
                    </Menu.Item>
                )}
            </Menu>
        </Dropdown>
    );
};
