import React from "react";
import { createGlobalStyle } from "styled-components";
import ToastMessages from "@splunk/react-toast-notifications/ToastMessages";

// SUI portals notifications outside the page root. Raise both the toast and
// its Layer stacking context above the Manager's create and preview dialogs.
const ForegroundNotificationStyles = createGlobalStyle`
  [data-test='layer']:has([data-test='toast-messages']) {
    position: relative;
    isolation: isolate;
    z-index: 1000001;
  }

  [data-test='toast-messages'] {
    z-index: 1000001;
  }
`;

export default function DashboardManagerNotifications() {
  return (
    <>
      <ForegroundNotificationStyles />
      <ToastMessages />
    </>
  );
}
