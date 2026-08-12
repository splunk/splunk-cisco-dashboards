import React from 'react';
import Button from '@splunk/react-ui/Button';
import Dropdown from '@splunk/react-ui/Dropdown';
import Menu from '@splunk/react-ui/Menu';
import {
    ExternalLink,
    Maximize2,
    MoreVertical,
    PanelRightOpen,
    Settings2,
} from '@/common/icons/SuiIcon';

interface TileActionMenuProps {
    label: string;
    onOpenInSearch?: () => void;
    onOpenDetailTable?: () => void;
    detailTableTitle?: string;
    onExpand?: () => void;
    onConfigure?: () => void;
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
    if (!onOpenInSearch && !onOpenDetailTable && !onExpand && !onConfigure) return null;

    const openInSearch = () => {
        onOpenInSearch?.();
        window.requestAnimationFrame(() => toggleRef.current?.focus());
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
                        onClick={onConfigure}
                        startAdornment={
                            <ActionIcon>
                                <Settings2 />
                            </ActionIcon>
                        }
                    >
                        Configure tile
                    </Menu.Item>
                )}
            </Menu>
        </Dropdown>
    );
};
