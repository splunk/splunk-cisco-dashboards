import Toaster from "@splunk/react-toast-notifications/Toaster";
import { TOAST_TYPES } from "@splunk/react-toast-notifications/ToastConstants";

export const notifyDashboard = (notification) => {
  const isError = notification.type === TOAST_TYPES.ERROR;
  Toaster.create({
    ...notification,
    autoDismiss: isError ? false : (notification.autoDismiss ?? true),
    role: isError ? "alert" : "status",
  });
};

export const dashboardResponseMessage = (response) => {
  const messages = Array.isArray(response?.messages) ? response.messages : [];
  return messages
    .map((message) => typeof message?.text === "string" ? message.text : "")
    .filter(Boolean)
    .join(" ")
    .split("\n")[0]
    .slice(0, 500) || `Request failed (${response?.status || "unknown status"}).`;
};
