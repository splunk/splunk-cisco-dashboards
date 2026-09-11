import React from "react";
import Menu from "@splunk/react-ui/Menu";

import { Moon, Sun } from "@/common/icons/SuiIcon";
import {
  type AppColorScheme,
  useAppThemeControls,
} from "@/common/theme/AppThemeProvider";

interface AppearanceMenuItemsProps {
  onSelect?: (colorScheme: AppColorScheme) => void;
}

/** Shared light/dark choices for app-owned page action menus. */
export default function AppearanceMenuItems({
  onSelect,
}: AppearanceMenuItemsProps): JSX.Element | null {
  const { canChooseColorScheme, colorScheme, setColorScheme } =
    useAppThemeControls();

  if (!canChooseColorScheme) {
    return null;
  }

  const selectColorScheme = (next: AppColorScheme): void => {
    setColorScheme(next);
    onSelect?.(next);
  };

  return (
    <>
      <Menu.Heading>Appearance</Menu.Heading>
      <Menu.Item
        onClick={() => selectColorScheme("light")}
        selectable
        selected={colorScheme === "light"}
        startAdornment={<Sun aria-hidden="true" />}
      >
        Light
      </Menu.Item>
      <Menu.Item
        onClick={() => selectColorScheme("dark")}
        selectable
        selected={colorScheme === "dark"}
        startAdornment={<Moon aria-hidden="true" />}
      >
        Dark
      </Menu.Item>
    </>
  );
}
