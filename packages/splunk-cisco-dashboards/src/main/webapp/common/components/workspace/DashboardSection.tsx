import React from "react";
import { variables } from "@splunk/themes";
import Button from "@splunk/react-ui/Button";
import CollapsiblePanel from "@splunk/react-ui/CollapsiblePanel";
import Dropdown from "@splunk/react-ui/Dropdown";
import Link from "@splunk/react-ui/Link";
import Menu from "@splunk/react-ui/Menu";
import Paginator from "@splunk/react-ui/Paginator";
import ScreenReaderContent from "@splunk/react-ui/ScreenReaderContent";
import styled from "styled-components";
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
import { TileActionEnvironmentContext } from "./TileActionMenu";

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

interface TilePagerControlConfig {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  showingAll: boolean;
  onPageChange: (next: number) => void;
  onToggleShowAll: () => void;
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
  tilePager?: TilePagerControlConfig;
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

const SectionHeaderActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  gap: ${variables.spacingSmall};
`;

const TileCountControl = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${variables.spacingSmall};
  color: ${variables.contentColorMuted};
  font-size: ${variables.fontSizeSmall};
  white-space: nowrap;
`;

const TileCountStepper = styled.div`
  display: inline-flex;
  align-items: stretch;
  border-radius: ${variables.borderRadius};
  background-color: ${variables.backgroundColorPopup};
`;

const TileCountValue = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: ${variables.spacingXLarge};
  padding: 0 ${variables.spacingSmall};
  border-top: ${variables.inputBorderWidth} solid ${variables.actionColorBorderSecondary};
  border-bottom: ${variables.inputBorderWidth} solid ${variables.actionColorBorderSecondary};
  border-left: ${variables.inputBorderWidth} solid ${variables.actionColorBorderSecondary};
  background-color: ${variables.backgroundColorPopup};
  color: ${variables.contentColorActive};
  font-size: ${variables.fontSizeSmall};
  font-weight: ${variables.fontWeightSemiBold};
  font-variant-numeric: tabular-nums;
`;

const ShowAllButton = styled(Button)`
  &&:not([disabled], [aria-disabled="true"]) {
    border-color: ${variables.actionColorBorderSecondary};
    background-color: ${variables.backgroundColorPopup};
    color: ${variables.actionColorContentStandalone};
  }

  &&:not([disabled], [aria-disabled="true"]):hover {
    border-color: ${variables.actionColorBorderSecondaryHover};
    background-color: ${variables.backgroundColorPopup};
    color: ${variables.actionColorContentStandaloneHover};
  }

  &&:not([disabled], [aria-disabled="true"]):active {
    border-color: ${variables.actionColorBorderSecondaryActive};
    background-color: ${variables.backgroundColorPopup};
    color: ${variables.actionColorContentStandaloneActive};
  }
`;

const TilePagerToolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 0;
  padding: ${variables.spacingXSmall} ${variables.spacingSmall};
  border-bottom: ${variables.inputBorderWidth} solid ${variables.borderColor};
`;

const TilePagerStatus = styled.span`
  color: ${variables.contentColorMuted};
  font-size: ${variables.fontSizeSmall};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  title,
  linkText,
  href,
  children,
  className,
  style,
  tileCount,
  tilePager,
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
  const [tileActionAnnouncement, setTileActionAnnouncement] = React.useState("");
  const runMenuAction = (action: () => void) => () => {
    action();
    window.requestAnimationFrame(() => actionToggleRef.current?.focus());
  };
  const effectiveTileCount = tileCount
    ? tilePager?.showingAll
      ? Math.min(tilePager.total, tileCount.max)
      : tileCount.value
    : 0;
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
              description={`${effectiveTileCount} shown`}
              descriptionPosition="right"
              disabled={effectiveTileCount <= tileCount.min}
              onClick={runMenuAction(() => tileCount.onChange(effectiveTileCount - 1))}
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
              description={`${effectiveTileCount} shown`}
              descriptionPosition="right"
              disabled={effectiveTileCount >= tileCount.max}
              onClick={runMenuAction(() => tileCount.onChange(effectiveTileCount + 1))}
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

  const tileCountControl = tileCount ? (
    <TileCountControl>
      <span>Visible tiles</span>
      <TileCountStepper
        aria-label={`${tileCount.label ?? "Tiles"}: ${effectiveTileCount} of ${tileCount.max}`}
        role="group"
      >
        <Button
          append
          appearance="secondary"
          disabled={effectiveTileCount <= tileCount.min}
          hideLabel
          icon={<Minus aria-hidden="true" />}
          label={`Show fewer ${(tileCount.label ?? "tiles").toLowerCase()}`}
          onClick={() => tileCount.onChange(effectiveTileCount - 1)}
        />
        <TileCountValue aria-hidden="true">{effectiveTileCount}</TileCountValue>
        <Button
          appearance="secondary"
          disabled={effectiveTileCount >= tileCount.max}
          hideLabel
          icon={<Plus aria-hidden="true" />}
          label={`Show more ${(tileCount.label ?? "tiles").toLowerCase()}`}
          onClick={() => tileCount.onChange(effectiveTileCount + 1)}
          prepend
        />
      </TileCountStepper>
      <ScreenReaderContent>
        <span role="status">
          {tileCount.label ?? "Tiles"}: {effectiveTileCount} of {tileCount.max} visible
        </span>
      </ScreenReaderContent>
    </TileCountControl>
  ) : null;

  const showAllControl = tilePager && tileCount && tilePager.total > tileCount.value ? (
    <ShowAllButton
      aria-label={
        tilePager.showingAll
          ? `Show ${tileCount.value} ${tileCount.label ?? "tiles"}`
          : `Show all ${tilePager.total} ${tileCount.label ?? "tiles"}`
      }
      aria-pressed={tilePager.showingAll}
      appearance="standalone"
      label={
        tilePager.showingAll
          ? `Show ${tileCount.value}`
          : `Show all ${tilePager.total}`
      }
      onClick={tilePager.onToggleShowAll}
    />
  ) : null;

  const actions = (
    <SectionHeaderActions>
      {tileCountControl}
      {showAllControl}
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
    </SectionHeaderActions>
  );

  const tilePagerToolbar = tilePager && tileCount && tilePager.total > tileCount.value ? (
    <TilePagerToolbar aria-atomic="true" aria-live="polite">
      {tilePager.showingAll ? (
        <TilePagerStatus>
          All {tilePager.total} configured tiles
        </TilePagerStatus>
      ) : (
        <Paginator.Compact
          aria-label={`${title} tile pages`}
          current={tilePager.page + 1}
          onChange={(_event, { page }) => {
            if (page !== undefined) {
              tilePager.onPageChange(page - 1);
            }
          }}
          renderLabel={() =>
            `${tilePager.start + 1}\u2013${tilePager.end} of ${tilePager.total} configured`
          }
          totalPages={tilePager.pageCount}
        />
      )}
    </TilePagerToolbar>
  ) : null;

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
      {tilePagerToolbar}
      <div
        className={cn(
          "flex flex-wrap",
          wrapTiles ? "gap-2" : "md:flex-nowrap",
        )}
      >
        <TileActionEnvironmentContext.Provider
          value={{
            announce: setTileActionAnnouncement,
            returnFocus: () => actionToggleRef.current?.focus(),
          }}
        >
          {children}
        </TileActionEnvironmentContext.Provider>
        <ScreenReaderContent>
          <span aria-live="polite" role="status">
            {tileActionAnnouncement}
          </span>
        </ScreenReaderContent>
      </div>
    </CollapsiblePanel>
  );
};
