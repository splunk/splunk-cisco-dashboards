import React from "react";
import Button from "@splunk/react-ui/Button";
import CollapsiblePanel from "@splunk/react-ui/CollapsiblePanel";
import Dropdown from "@splunk/react-ui/Dropdown";
import Link from "@splunk/react-ui/Link";
import Menu from "@splunk/react-ui/Menu";
import ScreenReaderContent from "@splunk/react-ui/ScreenReaderContent";
import {
  ArrowUpDown,
  Maximize2,
  Minimize2,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
} from "@/common/icons/SuiIcon";
import { cn } from "@/common/lib/utils";

interface TileCountControlConfig {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  label?: string;
}

interface HeightControlConfig {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
  label?: string;
}

interface HeaderActionConfig {
  onClick: (returnFocus: HTMLElement | null) => void;
  label: string;
  title?: string;
  disabled?: boolean;
}

interface DashboardSectionProps {
  title: string;
  linkText: string;
  href?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  tileCount?: TileCountControlConfig;
  height?: HeightControlConfig;
  wrapTiles?: boolean;
  compactHeight?: boolean;
  addTileAction?: HeaderActionConfig;
  onEditTitle?: () => void;
  collapsed?: boolean;
  focused?: boolean;
  onToggleCollapsed: () => void;
  onToggleFocus?: () => void;
}

const ActionIcon: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center">
    {children}
  </span>
);

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  linkText,
  href,
  children,
  className,
  style,
  tileCount,
  height,
  wrapTiles = false,
  compactHeight = false,
  addTileAction,
  onEditTitle,
  collapsed = false,
  focused = false,
  onToggleCollapsed,
  onToggleFocus,
}) => {
  const actionToggleRef = React.useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const runMenuAction = (action: () => void) => () => {
    action();
    window.requestAnimationFrame(() => actionToggleRef.current?.focus());
  };
  const hasMenuActions = Boolean(
    addTileAction || onEditTitle || onToggleFocus || height || tileCount,
  );

  const actionMenu = hasMenuActions ? (
    <Dropdown
      focusToggleReasons={["escapeKey", "tabKey", "toggleClick"]}
      toggle={
        <Button
          appearance="subtle"
          elementRef={actionToggleRef}
          hideLabel
          icon={<MoreVertical aria-hidden="true" />}
          label={`Actions for ${title}`}
        />
      }
    >
      <Menu style={{ minWidth: 220 }}>
        <Menu.Heading title>Section actions</Menu.Heading>
        {addTileAction && (
          <Menu.Item
            disabled={addTileAction.disabled}
            onClick={() => addTileAction.onClick(actionToggleRef.current)}
            startAdornment={
              <ActionIcon>
                <Plus />
              </ActionIcon>
            }
          >
            {addTileAction.label}
          </Menu.Item>
        )}
        {onEditTitle && (
          <Menu.Item
            onClick={onEditTitle}
            startAdornment={
              <ActionIcon>
                <Pencil />
              </ActionIcon>
            }
          >
            Edit section titles
          </Menu.Item>
        )}
        {onToggleFocus && (
          <Menu.Item
            onClick={runMenuAction(onToggleFocus)}
            startAdornment={
              <ActionIcon>
                {focused ? <Minimize2 /> : <Maximize2 />}
              </ActionIcon>
            }
          >
            {focused ? "Exit focus view" : "Focus this section"}
          </Menu.Item>
        )}
        {(height || tileCount) && <Menu.Heading>Layout</Menu.Heading>}
        {height && [
            <Menu.Item
              key="decrease-height"
              description={`H${height.value}`}
              descriptionPosition="right"
              disabled={height.value <= height.min}
              onClick={runMenuAction(() => height.onChange(height.value - 1))}
              startAdornment={
                <ActionIcon>
                  <Minus />
                </ActionIcon>
              }
            >
              Decrease height
            </Menu.Item>,
            <Menu.Item
              key="increase-height"
              description={`H${height.value}`}
              descriptionPosition="right"
              disabled={height.value >= height.max}
              onClick={runMenuAction(() => height.onChange(height.value + 1))}
              startAdornment={
                <ActionIcon>
                  <ArrowUpDown />
                </ActionIcon>
              }
            >
              Increase height
            </Menu.Item>,
          ]}
        {tileCount && [
            <Menu.Item
              key="show-fewer-tiles"
              description={`${tileCount.value} shown`}
              descriptionPosition="right"
              disabled={tileCount.value <= tileCount.min}
              onClick={runMenuAction(() => tileCount.onChange(tileCount.value - 1))}
              startAdornment={
                <ActionIcon>
                  <Minus />
                </ActionIcon>
              }
            >
              Show fewer tiles
            </Menu.Item>,
            <Menu.Item
              key="show-more-tiles"
              description={`${tileCount.value} shown`}
              descriptionPosition="right"
              disabled={tileCount.value >= tileCount.max}
              onClick={runMenuAction(() => tileCount.onChange(tileCount.value + 1))}
              startAdornment={
                <ActionIcon>
                  <Plus />
                </ActionIcon>
              }
            >
              Show more tiles
            </Menu.Item>,
          ]}
      </Menu>
    </Dropdown>
  ) : null;

  const actions = (
    <>
      {href && (
        <Link
          appearance="standalone"
          openInNewContext
          to={href}
        >
          <ScreenReaderContent>{linkText}</ScreenReaderContent>
        </Link>
      )}
      {actionMenu}
    </>
  );

  let sectionState = "expanded";
  if (collapsed) {
    sectionState = "collapsed";
  }
  if (focused) {
    sectionState = "focused";
  }
  return (
    <CollapsiblePanel
      actions={actions}
      className={cn("min-w-0 flex-shrink-0", className)}
      data-section-density={compactHeight ? "compact" : "standard"}
      data-section-state={sectionState}
      headingLevel={2}
      inset={false}
      onChange={onToggleCollapsed}
      open={!collapsed}
      style={collapsed ? { ...style, minHeight: 0 } : style}
      title={
        <span
          style={{
            alignSelf: "center",
            alignItems: "center",
            display: "inline-flex",
          }}
        >
          {title}
        </span>
      }
    >
      <div
        className={cn(
          "flex flex-wrap",
          wrapTiles ? "gap-2" : "md:flex-nowrap",
        )}
      >
        {children}
      </div>
    </CollapsiblePanel>
  );
};
