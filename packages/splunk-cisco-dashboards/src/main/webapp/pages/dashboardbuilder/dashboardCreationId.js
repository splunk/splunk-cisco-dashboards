// Match Splunk's native nameFromString guesser for the trimmed dashboard title.
// null means automatic; even an empty string is an explicit manual override.
export const getNewDashboardId = (title, override = null) =>
  override !== null
    ? override.toLowerCase()
    : title.trim().toLowerCase().replace(/\s/g, "_").replace(/\W/g, "");

// Matches the view-name rules exposed by Splunk's native dashboard dialog.
export const getDashboardIdError = (id) => {
  if (!id) return "Dashboard ID is required.";
  if (/[^A-Za-z0-9_-]/.test(id)) {
    return "Dashboard ID can contain only letters, numbers, hyphens, and underscores. Spaces and periods are not allowed. Edit the ID to continue.";
  }
  return "";
};
