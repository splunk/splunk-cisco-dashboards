import React, { useState, useEffect, useMemo, useRef } from "react";
import ColumnLayout from "@splunk/react-ui/ColumnLayout";

import "../../common/styles/commonstyles.css";
import { default as SplunkControlGroup } from "@splunk/react-ui/ControlGroup";
import Text from "@splunk/react-ui/Text";
import Card from "@splunk/react-ui/Card";
import CardLayout from "@splunk/react-ui/CardLayout";
import Button from "@splunk/react-ui/Button";
import Pencil from "@splunk/react-icons/Pencil";
import MagnifierPlus from "@splunk/react-icons/MagnifierPlus";
import TrashCanCross from "@splunk/react-icons/TrashCanCross";
import {
  getDashboards,
  deleteDashboard,
  updateDashMetadata,
  normalizeDashboardTheme,
  syncDashboardManagerNavigation,
} from "../../common/lib/splunk";
import { DashboardContextProvider } from "@splunk/dashboard-context";
import EnterprisePreset from "./dashboardPreset";
import SearchBaseDataSource from "./SearchBaseDataSource";
import SimpleTimePicker from "./custominput/SimpleTimePicker";
import VizKpi from "../../common/components/templatewizard/viz-kpi/VizKpi";
import VizOther from "../../common/components/templatewizard/viz-other/VizOther";
import SpaceManagerViz from "./SpaceManager/SpaceManagerViz";
import Modal from "@splunk/react-ui/Modal";
import { useNavigate } from "react-router-dom";
import DashboardStudioEditor from "./DashboardStudioEditor";
import { GridSVG, AbsolutSVG } from "./DashboardStudioEditor";
import { addDash } from "../../common/lib/splunk";

import { cloneDeep } from "lodash-es";
import Trash from "@splunk/react-icons/enterprise/Trash";
import { TOAST_TYPES } from "@splunk/react-toast-notifications/ToastConstants";
import { notifyDashboard, dashboardResponseMessage } from "./dashboardNotifications";
import TextArea from "@splunk/react-ui/TextArea";
import Select from "@splunk/react-ui/Select";
import Tooltip from "@splunk/react-ui/Tooltip";
import CustomTooltip from "../../common/components/CustomTooltip/CustomTooltip";
import ManagerPreviewModal from "../../common/components/ManagerPreviewModal";
import { actionMenus } from "../../common/udf/presets";
import createSEIIconRegistry from "../../common/udf/IconProviders/createSEIIconRegistry";
import Paginator from "@splunk/react-ui/Paginator";
import Table from "@splunk/react-ui/Table";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";
import Message from "@splunk/react-ui/Message";
import useSplunkTheme from "@splunk/themes/useSplunkTheme";

import FileCharts from "@splunk/react-icons/FileCharts";
import QuestionCircle from "@splunk/react-icons/QuestionCircle";
import Plus from "@splunk/react-icons/Plus";
import ArrowSquareTopRight from "@splunk/react-icons/ArrowSquareTopRight";
import Magnifier from "@splunk/react-icons/Magnifier";
import { initialDefinition } from "./DashboardStudioEditor";
import DrilldownActionViz from "./DrilldownActionViz";
import { INSIGHTS_APP_ID } from "../../common/lib/constants";
import {
  DASHBOARD_MANAGER_TAG,
  getDashboardManagerScope,
  matchesDashboardManagerScope,
  getDashboardNamespaceApp,
} from "../../common/config/managedStudioViews";

const featureFlags = {
  enableCollapsibleToolbar: true,
  enableGridLayoutCssScaling: false,
  enableSmartSourceDS: true,
  enableShowHide: true,
  visualizations_enableEventsViewerTags: true,
};

export const customPresets = {
  ...EnterprisePreset,
  dataSources: {
    ...EnterprisePreset.dataSources,
    "ds.searchbase": SearchBaseDataSource,
  },
  inputs: {
    ...EnterprisePreset.inputs,
    "input.simpleTimePicker": SimpleTimePicker,
  },
  visualizations: {
    ...EnterprisePreset.visualizations,
    "splunk.template_kpi": VizKpi,
    "splunk.template_other": VizOther,
    "splunk.cisco_spaces_space_manager": SpaceManagerViz,
    "splunk.cisco_drilldown_action": DrilldownActionViz,
  },
};

const DASHBOARD_PAGE_SIZE = 20;
const DASHBOARD_CARD_TITLE_LIMIT = 35;
const DASHBOARD_CARD_DESCRIPTION_LIMIT = 140;
const DASHBOARD_SCOPE_OPTIONS = [
  { id: "included", label: "Included" },
  { id: "yours", label: "Yours" },
  { id: "shared", label: "Shared" },
];

const truncateDashboardTitle = (title) => {
  const normalizedTitle = title || "";

  if (normalizedTitle.length <= DASHBOARD_CARD_TITLE_LIMIT) {
    return normalizedTitle;
  }

  return `${normalizedTitle.slice(0, DASHBOARD_CARD_TITLE_LIMIT).trimEnd()}...`;
};

const truncateDashboardDescription = (description) => {
  const normalizedDescription = description || "No description provided.";

  if (normalizedDescription.length <= DASHBOARD_CARD_DESCRIPTION_LIMIT) {
    return normalizedDescription;
  }

  return `${normalizedDescription.slice(0, DASHBOARD_CARD_DESCRIPTION_LIMIT).trimEnd()}...`;
};

const buildDashboardSearchText = (dashboard) =>
  [
    dashboard.title,
    dashboard.label,
    dashboard.description,
    dashboard.app,
    dashboard.contentApp,
    dashboard.owner,
    dashboard.author,
    dashboard.sharing,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const getBootstrapSplunkUsername = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const bootstrap = window.$C || {};
  const rawUsername =
    bootstrap.USERNAME ||
    bootstrap.username ||
    bootstrap.USER?.username ||
    bootstrap.USER?.name ||
    bootstrap.user?.username ||
    bootstrap.user?.name ||
    "";

  return typeof rawUsername === "string" ? rawUsername.trim() : "";
};

const getSplunkLocalePrefix = () => {
  if (typeof window === "undefined") {
    return "/en-US";
  }

  const match = window.location.pathname.match(/^\/[^/]+/);
  return match?.[0] || "/en-US";
};

const buildAppStaticAssetUrl = (fileName, owner = "nobody") =>
  `${getSplunkLocalePrefix()}/splunkd/__raw/servicesNS/${encodeURIComponent(
    owner || "nobody",
  )}/${encodeURIComponent(INSIGHTS_APP_ID)}/static/${encodeURIComponent(fileName)}`;

const buildDashboardStudioPath = (dashboardId, mode = "view") => {
  const encodedDashboardId = encodeURIComponent(dashboardId);

  return mode === "edit"
    ? `/${encodedDashboardId}/edit`
    : `/${encodedDashboardId}`;
};

const buildDashboardStudioUrl = (dashboardId, mode = "view") =>
  `/app/splunk-cisco-dashboards/dashboard_manager#${buildDashboardStudioPath(
    dashboardId,
    mode,
  )}`;

export default function DBHomePage() {
  const splunkTheme = useSplunkTheme();
  const managerColorScheme =
    splunkTheme.colorScheme === "dark" ? "dark" : "light";
  const dashboardManagerThemeStyle = {
    "--dashboard-manager-background-page": splunkTheme.backgroundColorPage,
    "--dashboard-manager-background-section":
      splunkTheme.backgroundColorSection,
    "--dashboard-manager-background-popup": splunkTheme.backgroundColorPopup,
    "--dashboard-manager-background-sidebar":
      splunkTheme.backgroundColorSidebar,
    "--dashboard-manager-content-active": splunkTheme.contentColorActive,
    "--dashboard-manager-content-default": splunkTheme.contentColorDefault,
    "--dashboard-manager-content-inverted": splunkTheme.contentColorInverted,
    "--dashboard-manager-content-muted": splunkTheme.contentColorMuted,
    "--dashboard-manager-border": splunkTheme.borderColor,
    "--dashboard-manager-border-strong": splunkTheme.borderColorStrong,
    "--dashboard-manager-border-weak": splunkTheme.borderColorWeak,
    "--dashboard-manager-accent": splunkTheme.interactiveColorAccent,
    "--dashboard-manager-overlay-hover":
      splunkTheme.interactiveColorOverlayHover,
    "--dashboard-manager-overlay-selected":
      splunkTheme.interactiveColorOverlaySelected,
  };
  const dashboardBuilderModalThemeStyle = {
    "--dashboard-builder-modal-background": splunkTheme.backgroundColorPopup,
    "--dashboard-builder-modal-background-section":
      splunkTheme.backgroundColorSection,
    "--dashboard-builder-modal-content-active": splunkTheme.contentColorActive,
    "--dashboard-builder-modal-content-default":
      splunkTheme.contentColorDefault,
    "--dashboard-builder-modal-content-muted": splunkTheme.contentColorMuted,
    "--dashboard-builder-modal-border": splunkTheme.borderColor,
    "--dashboard-builder-modal-border-strong": splunkTheme.borderColorStrong,
    "--dashboard-builder-modal-border-weak": splunkTheme.borderColorWeak,
    "--dashboard-builder-modal-overlay-hover":
      splunkTheme.interactiveColorOverlayHover,
    "--dashboard-builder-modal-overlay-selected":
      splunkTheme.interactiveColorOverlaySelected,
  };
  const iconRegistry = useMemo(() => createSEIIconRegistry(), []);
  const [dashboards, setDashboards] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedDash, setSelectedDash] = useState();
  const [searchText, setSearchText] = useState("");
  const [openCreateDashboard, setOpenCreateDashboard] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState("");
  const [dashboardDescription, setDashboardDescription] = useState("");
  const [dashboardSharing, setDashboardSharing] = useState("user");
  const [isCreatingDashboard, setIsCreatingDashboard] = useState(false);
  const [dashboardCreateError, setDashboardCreateError] = useState("");
  const [createdDashboardId, setCreatedDashboardId] = useState("");
  const createInFlight = useRef(false);
  const [gridLayout, setGridLayout] = useState("absolute");
  const [openDeleteDashboard, setOpenDeleteDashboard] = useState(false);
  const [DashboardToDelete, setDashboardToDelete] = useState();
  const [pageNum, setPageNum] = useState(1);
  const [dashboardScope, setDashboardScope] = useState("yours");
  const [dashboardLibraryView, setDashboardLibraryView] = useState("cards");
  const [openDashboardMetadataEditor, setOpenDashboardMetadataEditor] =
    useState(false);
  const [dashboardMetadataTarget, setDashboardMetadataTarget] = useState();
  const [dashboardMetadataTitle, setDashboardMetadataTitle] = useState("");
  const [dashboardMetadataDescription, setDashboardMetadataDescription] =
    useState("");
  const [isSavingDashboardMetadata, setIsSavingDashboardMetadata] =
    useState(false);
  const [currentSplunkUser, setCurrentSplunkUser] = useState(
    getBootstrapSplunkUsername(),
  );

  const dashboardManagerSubtitle =
    "Dashboards in 60 Seconds combines Searchbase and Dashboard Studio so you can build Cisco dashboards from reusable searches and components without writing SPL or code. Dashboard Manager also adds guided drilldown wiring that is not available in Dashboard Studio alone.";
  const dashboardManagerIconSrc = useMemo(
    () => buildAppStaticAssetUrl("appIcon.png", currentSplunkUser),
    [currentSplunkUser],
  );
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "SSNE | Dashboard Manager";
  }, []);

  useEffect(() => {
    let cancelled = false;
    const bootstrapUsername = getBootstrapSplunkUsername();

    fetch(
      `${getSplunkLocalePrefix()}/splunkd/__raw/services/authentication/current-context?output_mode=json`,
      {
        credentials: "include",
        headers: { Accept: "application/json" },
      },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((json) => {
        if (cancelled) {
          return;
        }

        const content = json.entry?.[0]?.content || {};
        const rawUsername =
          content.username || content.user || content.name || bootstrapUsername;
        const username =
          typeof rawUsername === "string" ? rawUsername.trim() : "";
        setCurrentSplunkUser(username);
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentSplunkUser(bootstrapUsername);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePageChange = (event, { page }) => {
    setPageNum(page);
  };

  const managerDashboards = useMemo(
    () =>
      dashboards
        .filter((ds) => !ds.template)
        .filter((ds) => getDashboardManagerScope(ds, currentSplunkUser)),
    [currentSplunkUser, dashboards],
  );

  const filteredDashboards = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();

    return managerDashboards
      .filter(
        (ds) =>
          matchesDashboardManagerScope(ds, currentSplunkUser, dashboardScope),
      )
      .filter(
        (ds) =>
          normalizedSearchText === "" ||
          ds.searchText.includes(normalizedSearchText),
      );
  }, [
    currentSplunkUser,
    dashboardScope,
    managerDashboards,
    searchText,
  ]);

  const totalDashboardPages = Math.max(
    1,
    Math.ceil(filteredDashboards.length / DASHBOARD_PAGE_SIZE),
  );

  const visibleDashboards = useMemo(
    () =>
      filteredDashboards.slice(
        (pageNum - 1) * DASHBOARD_PAGE_SIZE,
        (pageNum - 1) * DASHBOARD_PAGE_SIZE + DASHBOARD_PAGE_SIZE,
      ),
    [filteredDashboards, pageNum],
  );

  useEffect(() => {
    if (pageNum > totalDashboardPages) {
      setPageNum(totalDashboardPages);
    }
  }, [pageNum, totalDashboardPages]);

  const handleOpenClick = async () => {
    if (createInFlight.current || createdDashboardId || !dashboardTitle.trim()) {
      return;
    }
    createInFlight.current = true;
    setIsCreatingDashboard(true);
    setDashboardCreateError("");
    const title = dashboardTitle.trim();
    const dashid = `scd_${title.replaceAll(" ", "_").replaceAll("#", "")}`;
    const jsonDefinition = cloneDeep(initialDefinition);
    jsonDefinition.title = title;
    jsonDefinition.description = dashboardDescription;
    jsonDefinition.layout.type = gridLayout;

    try {
      const response = await addDash(
        dashid,
        JSON.stringify(jsonDefinition),
        title,
        dashboardDescription,
        DASHBOARD_MANAGER_TAG,
        "dark",
        currentSplunkUser,
        dashboardSharing,
      );
      if (response.status >= 200 && response.status <= 299) {
        syncDashboardManagerNavigation([
          ...managerDashboards,
          {
            title: dashid,
            label: title,
            app: INSIGHTS_APP_ID,
            owner: currentSplunkUser,
            sharing: dashboardSharing,
            tag: DASHBOARD_MANAGER_TAG,
            definition: {
              title,
            },
          },
        ]).catch((error) => {
          console.warn("Unable to sync Dashboard Manager navigation.", error);
        });
        setOpenCreateDashboard(false);
        navigate(buildDashboardStudioPath(dashid, "edit"));
      } else {
        const detail = (Array.isArray(response.messages) ? response.messages : [])
          .map((message) => typeof message?.text === "string" ? message.text : "")
          .filter(Boolean)
          .join(" ")
          .slice(0, 500) || `Request failed (${response.status}).`;
        if (response.dashboardSaved) {
          setCreatedDashboardId(dashid);
          setDashboardCreateError(
            `The dashboard was saved, but sharing it in the app could not be completed. Open the saved dashboard to continue. ${detail}`,
          );
          refreshDashboards();
        } else {
          setDashboardCreateError(
            response.status === 409
              ? "A dashboard with this ID already exists. Choose a different title, or cancel and open the existing dashboard to edit it."
              : `Unable to create the dashboard. ${detail}`,
          );
        }
      }
    } catch {
      setDashboardCreateError(
        "The dashboard creation request could not be confirmed. Check the dashboard library before trying again.",
      );
    } finally {
      createInFlight.current = false;
      setIsCreatingDashboard(false);
    }
  };

  const refreshDashboards = () => {
    getDashboards().then((response) => {
      if (response.status >= 200 && response.status <= 299) {
        const { XMLParser } = require("fast-xml-parser");
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "",
        });

        const insightDash = response.entry
          .filter((c) => c.content.isDashboard && c.content.version == "2")
          .map((r) => {
            try {
              let jObj = parser.parse(r.content["eai:data"]);
              const data = JSON.parse(
                jObj.dashboard.definition.replace(/\n/g, "").startsWith("{{")
                  ? jObj.dashboard.definition
                      .replace(/\n/g, "")
                      .replace(/^\{\{/, "{")
                  : jObj.dashboard.definition.replace(/\n/g, ""),
              );

              const description = jObj.dashboard.description || "";
              const app = getDashboardNamespaceApp(r);
              const contentApp = r.content["eai:appName"];
              const author = r.content["eai:userName"];
              const owner = r.acl?.owner || author;
              const sharing = r.acl?.sharing || "app";
              const tag = jObj.dashboard.tag || r.content.tag || "";
              return {
                data: r.content["eai:data"],
                definition: data,
                author,
                app,
                contentApp,
                owner,
                sharing,
                tag,
                deleteLink: r.links?.remove || r.links?.edit,
                title: r.name,
                label: r.content["label"],
                description,
                theme: normalizeDashboardTheme(jObj.dashboard.theme),
                searchText: buildDashboardSearchText({
                  title: r.name,
                  label: r.content["label"],
                  description,
                  app,
                  contentApp,
                  owner,
                  author,
                  sharing,
                }),
                template: data.template ? data.template : false,
              };
            } catch (error) {
              return undefined;
            }
          })
          .filter((c) => c != undefined);

        setDashboards(insightDash);
      } else {
        notifyDashboard({
          message: `Unable to load dashboards. ${dashboardResponseMessage(response)}`,
          type: TOAST_TYPES.ERROR,
        });
      }
    }).catch(() => {
      notifyDashboard({
        message: "Unable to load dashboards. Check your connection and reload Dashboard Manager.",
        type: TOAST_TYPES.ERROR,
      });
    });
  };

  useEffect(() => {
    refreshDashboards();
  }, []);

  useEffect(() => {
    if (dashboards.length === 0) {
      return;
    }

    syncDashboardManagerNavigation(managerDashboards).catch((error) => {
      console.warn("Unable to sync Dashboard Manager navigation.", error);
    });
  }, [dashboards.length, managerDashboards]);

  const handleRequestClosePreview = () => {
    setPreviewOpen(false);
  };

  const handleCloseCreateDashboard = () => {
    if (createInFlight.current) {
      return;
    }
    // kh 2026-05-10: Reset builder metadata and mode-specific state so the next modal session starts from a clean default configuration.
    setOpenCreateDashboard(false);
    setDashboardTitle("");
    setDashboardDescription("");
    setDashboardSharing("user");
    setDashboardCreateError("");
    setCreatedDashboardId("");
    setGridLayout("absolute");
  };

  const handleDashboardScopeChange = (scope) => (event) => {
    stopDashboardPanelAction(event);
    setDashboardScope(scope);
    setPageNum(1);
  };

  const handleDashboardScopeKeyDown = (scope) => (event) => {
    if (event.key === "Enter" || event.key === " ") {
      handleDashboardScopeChange(scope)(event);
      return;
    }

    const currentIndex = DASHBOARD_SCOPE_OPTIONS.findIndex(
      (option) => option.id === scope,
    );
    const isPreviousKey = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const isNextKey = event.key === "ArrowRight" || event.key === "ArrowDown";

    if (
      !isPreviousKey &&
      !isNextKey &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();
    let nextIndex;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = DASHBOARD_SCOPE_OPTIONS.length - 1;
    } else {
      nextIndex =
        (currentIndex + (isPreviousKey ? -1 : 1) +
          DASHBOARD_SCOPE_OPTIONS.length) % DASHBOARD_SCOPE_OPTIONS.length;
    }
    const nextScope = DASHBOARD_SCOPE_OPTIONS[nextIndex].id;
    setDashboardScope(nextScope);
    setPageNum(1);
    document.getElementById(`dashboard-manager-scope-${nextScope}`)?.focus();
  };

  const stopDashboardPanelAction = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDashboardLibraryViewChange = (viewMode) => (event) => {
    stopDashboardPanelAction(event);
    setDashboardLibraryView(viewMode);
  };

  const handlePreviewDashboard = (dash) => {
    setPreviewOpen(true);
    setSelectedDash(dash);
  };

  const handleOpenDashboard = (dash) => {
    if (!dash?.title) {
      return;
    }

    window.open(
      buildDashboardStudioUrl(dash.title),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleEditDashboard = (dash) => {
    navigate(buildDashboardStudioPath(dash.title, "edit"));
  };

  const handleOpenDashboardMetadataEditor = (
    dash,
    { closePreview = false } = {},
  ) => {
    if (!dash) {
      return;
    }

    if (closePreview) {
      setPreviewOpen(false);
    }

    setDashboardMetadataTarget(dash);
    setDashboardMetadataTitle(dash.label || dash.title || "");
    setDashboardMetadataDescription(dash.description || "");
    setOpenDashboardMetadataEditor(true);
  };

  const handleCloseDashboardMetadataEditor = () => {
    setOpenDashboardMetadataEditor(false);
    setDashboardMetadataTarget(undefined);
    setDashboardMetadataTitle("");
    setDashboardMetadataDescription("");
    setIsSavingDashboardMetadata(false);
  };

  const handleSaveDashboardMetadata = () => {
    if (!dashboardMetadataTarget || !dashboardMetadataTitle.trim()) {
      notifyDashboard({
        message: "Title is required before saving dashboard metadata.",
        type: TOAST_TYPES.ERROR,
      });
      return;
    }

    setIsSavingDashboardMetadata(true);

    updateDashMetadata(
      dashboardMetadataTarget.title,
      dashboardMetadataTarget.definition,
      dashboardMetadataTitle.trim(),
      dashboardMetadataDescription.trim(),
      dashboardMetadataTarget.tag || DASHBOARD_MANAGER_TAG,
      dashboardMetadataTarget.theme,
      dashboardMetadataTarget.owner,
      dashboardMetadataTarget.sharing,
    ).then((response) => {
      if (response.status >= 200 && response.status <= 299) {
        notifyDashboard({
          message: `Metadata for ${dashboardMetadataTitle.trim()} was updated successfully.`,
          type: TOAST_TYPES.SUCCESS,
        });

        refreshDashboards();

        if (selectedDash?.title === dashboardMetadataTarget.title) {
          setSelectedDash((prev) =>
            prev
              ? {
                  ...prev,
                  label: dashboardMetadataTitle.trim(),
                  description: dashboardMetadataDescription.trim(),
                  definition: {
                    ...prev.definition,
                    title: dashboardMetadataTitle.trim(),
                    description: dashboardMetadataDescription.trim(),
                  },
                }
              : prev,
          );
        }

        handleCloseDashboardMetadataEditor();
      } else {
        setIsSavingDashboardMetadata(false);
        notifyDashboard({
          message: `Unable to update dashboard metadata. ${dashboardResponseMessage(response)}`,
          type: TOAST_TYPES.ERROR,
        });
      }
    }).catch(() => {
      setIsSavingDashboardMetadata(false);
      notifyDashboard({
        message: "The metadata save could not be confirmed. Check your connection and reload the dashboard before retrying.",
        type: TOAST_TYPES.ERROR,
      });
    });
  };

  const handleRequestDeleteDashboard = (dash) => {
    setDashboardToDelete(dash);
    setOpenDeleteDashboard(true);
  };

  const handleCloseDeleteDashboard = () => {
    setOpenDeleteDashboard(false);
  };

  const handleDeleteDashboard = () => {
    if (DashboardToDelete)
      deleteDashboard(
        DashboardToDelete.title,
        DashboardToDelete.app,
        DashboardToDelete.owner,
        DashboardToDelete.sharing,
        DashboardToDelete.deleteLink,
      ).then((response) => {
        if (response.status >= 200 && response.status <= 299) {
          notifyDashboard({
            message: `Dashboard deleted successfully...`,
            type: TOAST_TYPES.SUCCESS,
          });
          setDashboards((prev) =>
            prev.filter(
              (dashboard) => dashboard.title !== DashboardToDelete.title,
            ),
          );
          setSelectedDash((prev) =>
            prev?.title === DashboardToDelete.title ? undefined : prev,
          );
          setPreviewOpen((prev) =>
            selectedDash?.title === DashboardToDelete.title ? false : prev,
          );
          setOpenDeleteDashboard(false);
          setDashboardToDelete(undefined);
          refreshDashboards();
        } else {
          notifyDashboard({
            message: `Unable to delete the dashboard. ${dashboardResponseMessage(response)}`,
            type: TOAST_TYPES.ERROR,
          });
          setOpenDeleteDashboard(false);
          setDashboardToDelete(undefined);
        }
      }).catch(() => {
        notifyDashboard({
          message: "The delete request could not be confirmed. Reload Dashboard Manager to check whether the dashboard still exists.",
          type: TOAST_TYPES.ERROR,
        });
      });
  };

  return (
    <>
      <Modal
        open={openCreateDashboard}
        className={`dashboard-builder-create-modal dashboard-builder-themed-modal dashboard-builder-themed-modal-${managerColorScheme}`}
        style={dashboardBuilderModalThemeStyle}
        onRequestClose={handleCloseCreateDashboard}
      >
        <Modal.Header
          title="Cisco Dashboard Builder"
          subtitle="Create a new dashboard."
          icon={<FileCharts className="dashboard-builder-modal-icon" />}
        />

        <Modal.Body className="dashboard-builder-modal-body">
          <div className="dashboard-builder-modal-content">
            <div role="alert" aria-atomic="true">
              {dashboardCreateError && (
                <Message type="error">{dashboardCreateError}</Message>
              )}
            </div>
            <div role="status" aria-live="polite">
              {isCreatingDashboard ? "Creating dashboard…" : ""}
            </div>
            {/* The Cisco builder only needs a title to create a dashboard; description remains optional metadata. */}
            <div className="dashboard-builder-form-grid">
              <div className="dashboard-builder-form-group dashboard-builder-title-group">
                <SplunkControlGroup
                  label={
                    <span className="dashboard-builder-field-label">
                      <span>
                        Title
                        <span className="dashboard-builder-required-marker">
                          *
                        </span>
                      </span>
                      <Tooltip content="Enter the dashboard title.">
                        <span className="dashboard-builder-field-tooltip-trigger">
                          ?
                        </span>
                      </Tooltip>
                    </span>
                  }
                  labelPosition="top"
                >
                  <Text
                    value={dashboardTitle}
                    disabled={isCreatingDashboard || Boolean(createdDashboardId)}
                    onChange={(e, { value }) => {
                      setDashboardTitle(value);
                      setDashboardCreateError("");
                    }}
                  />
                </SplunkControlGroup>
              </div>
            </div>
            <div className="dashboard-builder-description-group">
              <SplunkControlGroup
                label={
                  <span className="dashboard-builder-field-label">
                    <span>Description</span>
                    <Tooltip content="Optionally enter a short description for the dashboard.">
                      <span className="dashboard-builder-field-tooltip-trigger">
                        ?
                      </span>
                    </Tooltip>
                  </span>
                }
                labelPosition="top"
              >
                <TextArea
                  value={dashboardDescription}
                  disabled={isCreatingDashboard || Boolean(createdDashboardId)}
                  onChange={(e, { value }) => {
                    setDashboardDescription(value);
                  }}
                ></TextArea>
              </SplunkControlGroup>
            </div>
            <SplunkControlGroup
              label={<span className="dashboard-builder-field-label">Permissions</span>}
              labelPosition="top"
              help={dashboardSharing === "app"
                ? "Sharing requires permission to publish dashboards in this app. Choose Private if you only need your own dashboard."
                : "Only you can see this dashboard. You can manage sharing later in Splunk Dashboards."}
            >
              <Select
                value={dashboardSharing}
                disabled={isCreatingDashboard || Boolean(createdDashboardId)}
                onChange={(event, { value }) => setDashboardSharing(value)}
              >
                <Select.Option label="Private — Visible only to you" value="user" />
                <Select.Option label="Shared in App — Visible to app users" value="app" />
              </Select>
            </SplunkControlGroup>
            <SplunkControlGroup
              className="dashboard-builder-mode-group"
              label={
                <span className="dashboard-builder-field-label">
                  <span>Layout Mode</span>
                  <Tooltip content="Choose the starting layout for the new dashboard.">
                    <span className="dashboard-builder-field-tooltip-trigger">
                      ?
                    </span>
                  </Tooltip>
                </span>
              }
              labelPosition="top"
            >
              <div className="dashboard-builder-layout-options">
                <Card
                  className="dashboard-builder-layout-card"
                  onClick={() => {
                    setGridLayout("absolute");
                  }}
                  selected={gridLayout == "absolute"}
                >
                  <Card.Body className="dashboard-builder-layout-card-body">
                    <div className="dashboard-builder-layout-card-content">
                      <div>
                        <b>Absolute</b>
                        <p className="dashboard-builder-layout-card-copy">
                          Full layout control
                        </p>
                      </div>
                      <AbsolutSVG></AbsolutSVG>
                    </div>
                  </Card.Body>
                </Card>
                <Card
                  className="dashboard-builder-layout-card"
                  onClick={() => {
                    setGridLayout("grid");
                  }}
                  selected={gridLayout == "grid"}
                >
                  <Card.Body className="dashboard-builder-layout-card-body">
                    <div className="dashboard-builder-layout-card-content">
                      <div>
                        <b>Grid</b>
                        <p className="dashboard-builder-layout-card-copy">
                          Quick organization
                        </p>
                      </div>
                      <GridSVG></GridSVG>
                    </div>
                  </Card.Body>
                </Card>
              </div>
            </SplunkControlGroup>
          </div>
        </Modal.Body>
        <Modal.Footer>
          {createdDashboardId ? (
            <Button
              appearance="primary"
              label="Open saved dashboard"
              onClick={() => navigate(buildDashboardStudioPath(createdDashboardId, "edit"))}
            />
          ) : (
            <Button
              appearance="primary"
              label={isCreatingDashboard ? "Creating…" : "Create"}
              disabled={!dashboardTitle.trim() || isCreatingDashboard}
              onClick={handleOpenClick}
            />
          )}

          <Button
            appearance="secondary"
            label="Cancel"
            disabled={isCreatingDashboard}
            onClick={handleCloseCreateDashboard}
          />
        </Modal.Footer>
      </Modal>
      <Modal
        open={openDeleteDashboard}
        className={`dashboard-builder-themed-modal dashboard-builder-themed-modal-${managerColorScheme}`}
        style={{
          width: "500px",
          zIndex: 99999,
          ...dashboardBuilderModalThemeStyle,
        }}
        onRequestClose={handleCloseDeleteDashboard}
      >
        <Modal.Header
          title="Delete Confirmation"
          icon={<Trash style={{ width: 30, height: 30 }}></Trash>}
        />

        <Modal.Body>
          Are you sure you want to delete the dashboard :{" "}
          <b>{DashboardToDelete?.label}</b> ?
          <br />
          This action cannot be undone.
        </Modal.Body>
        <Modal.Footer>
          <Button
            label="Delete"
            appearance="primary"
            onClick={() => {
              handleDeleteDashboard();
            }}
          ></Button>
          <Button
            label="Cancel"
            onClick={() => {
              setOpenDeleteDashboard(false);
            }}
          ></Button>
        </Modal.Footer>
      </Modal>

      <Modal
        open={openDashboardMetadataEditor}
        className={`dashboard-builder-metadata-modal dashboard-builder-themed-modal dashboard-builder-themed-modal-${managerColorScheme}`}
        style={dashboardBuilderModalThemeStyle}
        onRequestClose={handleCloseDashboardMetadataEditor}
      >
        <Modal.Header
          title="Edit Dashboard Metadata"
          subtitle="Update the dashboard title and optional description without opening Dashboard Studio."
          icon={<FileCharts className="dashboard-builder-modal-icon" />}
        />
        <Modal.Body className="dashboard-builder-modal-body">
          <div className="dashboard-builder-modal-content">
            <div className="dashboard-builder-form-grid">
              <div className="dashboard-builder-form-group dashboard-builder-title-group">
                <SplunkControlGroup
                  label={
                    <span className="dashboard-builder-field-label">
                      <span>
                        Title
                        <span className="dashboard-builder-required-marker">
                          *
                        </span>
                      </span>
                      <Tooltip content="Enter the dashboard title.">
                        <span className="dashboard-builder-field-tooltip-trigger">
                          ?
                        </span>
                      </Tooltip>
                    </span>
                  }
                  labelPosition="top"
                >
                  <Text
                    value={dashboardMetadataTitle}
                    onChange={(e, { value }) => {
                      setDashboardMetadataTitle(value);
                    }}
                  />
                </SplunkControlGroup>
              </div>
            </div>
            <div className="dashboard-builder-description-group">
              <SplunkControlGroup
                label={
                  <span className="dashboard-builder-field-label">
                    <span>Description</span>
                    <Tooltip content="Optionally enter a short description for the dashboard.">
                      <span className="dashboard-builder-field-tooltip-trigger">
                        ?
                      </span>
                    </Tooltip>
                  </span>
                }
                labelPosition="top"
              >
                <TextArea
                  value={dashboardMetadataDescription}
                  onChange={(e, { value }) => {
                    setDashboardMetadataDescription(value);
                  }}
                ></TextArea>
              </SplunkControlGroup>
            </div>
            <div className="dashboard-builder-metadata-note">
              This matches the metadata editor pattern used in Presentation
              Manager.
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            appearance="primary"
            label={isSavingDashboardMetadata ? "Saving..." : "Save Metadata"}
            onClick={handleSaveDashboardMetadata}
            disabled={
              isSavingDashboardMetadata || !dashboardMetadataTitle.trim()
            }
          />
          <Button
            appearance="secondary"
            label="Cancel"
            onClick={handleCloseDashboardMetadataEditor}
          />
        </Modal.Footer>
      </Modal>

      <ManagerPreviewModal
        open={previewOpen}
        onRequestClose={handleRequestClosePreview}
        title="Dashboard Preview"
        initialWidth={1100}
        initialHeight={720}
        footerContent={
          <>
            {selectedDash && (
              <Button
                label="Open Dashboard"
                appearance="primary"
                icon={<ArrowSquareTopRight />}
                onClick={() => {
                  handleOpenDashboard(selectedDash);
                }}
              />
            )}
            {selectedDash && (
              <Button
                label="Edit Dashboard"
                appearance="primary"
                icon={<Pencil />}
                onClick={() => handleEditDashboard(selectedDash)}
              />
            )}
            {selectedDash && (
              <Button
                label="Edit Metadata"
                appearance="secondary"
                icon={<FileCharts />}
                onClick={() => {
                  handleOpenDashboardMetadataEditor(selectedDash, {
                    closePreview: true,
                  });
                }}
              />
            )}
            <Button
              label="Close"
              appearance="destructive"
              onClick={handleRequestClosePreview}
            />
          </>
        }
      >
        {selectedDash && (
          <DashboardContextProvider
            //preset={EnterpriseViewOnlyPreset}
            preset={customPresets}
            featureFlags={featureFlags}
            initialDefinition={selectedDash.definition}
            iconRegistry={iconRegistry}
          >
            <DashboardStudioEditor
              openID={selectedDash.title}
              initialDashboard={selectedDash}
              actionMenus={actionMenus}
              preset={customPresets}
              embededMode={true}
              readOnly={true}
            />
          </DashboardContextProvider>
        )}
      </ManagerPreviewModal>
      <ColumnLayout
        id="collection_container"
        className={`dashboard-manager-page dashboard-manager-page-${managerColorScheme}`}
        style={dashboardManagerThemeStyle}
      >
        <ColumnLayout.Row className="fix-margin">
          <ColumnLayout.Column span={12}>
            <div id="hdr_block">
              <div id="custom_collection_header">
                <div className="col2">
                  <div className="float-l">
                    <div className="title">Dashboard Manager</div>
                    <div className="tooltip-description float-l">
                      <Tooltip
                        id="collection_description"
                        content={
                          <div className="default-tooltip-content">
                            <p>
                              <strong>What it is:</strong> Dashboard Manager adds
                              a custom preset and editor integration to Dashboard
                              Studio.
                            </p>
                            <p>
                              <strong>Why it exists:</strong>{" "}
                              <em>Dashboards in 60 Seconds</em> combines
                              Searchbase and Dashboard Studio. Builders use
                              reusable searches and Cisco components without
                              writing SPL or code.
                            </p>
                            <p>
                              <strong>What it adds:</strong> Dashboard Manager
                              wires dashboard content to drilldown views, adding
                              a workflow that is not available in Dashboard
                              Studio alone.
                            </p>
                            <p>
                              <strong>How it works:</strong> Dashboards remain
                              Studio definitions, but opening them here loads the
                              extensions and keeps shared SPL synchronized.
                              Definitions that need those extensions are hidden
                              from Splunk&apos;s standard Dashboards listing;
                              native-only definitions remain available in
                              regular Dashboard Studio.
                            </p>
                          </div>
                        }
                      ></Tooltip>
                    </div>
                  </div>
                  <div className="sub-title">{dashboardManagerSubtitle}</div>
                </div>
                <div className="col3">
                  <img
                    className="icn-collection"
                    alt="Splunk Secure Networking Essentials"
                    src={dashboardManagerIconSrc}
                    onError={(event) => {
                      const fallbackSrc = buildAppStaticAssetUrl("appIcon.png");
                      const currentSrc =
                        event.currentTarget.getAttribute("src");
                      if (currentSrc !== fallbackSrc) {
                        event.currentTarget.src = fallbackSrc;
                      }
                    }}
                  />
                </div>
                <div className="manager-header-actions">
                  <Button
                    className="manager-header-primary-button"
                    label={"Create New"}
                    appearance="primary"
                    icon={<Plus></Plus>}
                    onClick={() => {
                      setOpenCreateDashboard(true);
                    }}
                  ></Button>
                </div>
              </div>
            </div>
          </ColumnLayout.Column>
        </ColumnLayout.Row>

        <div className="dashboard-manager-panel-shell">
          <section
            id="dashboard_manager_dashboards"
            className="dashboard-manager-library-panel"
            aria-labelledby="dashboard-manager-library-title"
          >
            <header className="dashboard-manager-library-panel-header">
              <div className="dashboard-manager-panel-title">
                <div className="dashboard-manager-panel-title-main">
                  <h2 id="dashboard-manager-library-title">
                    {`Dashboard Manager Library (${filteredDashboards.length})`}
                  </h2>
                  <div className="dashboard-manager-panel-tooltip">
                    <CustomTooltip
                      width={410}
                      height={285}
                      delay={200}
                      placement="right"
                      persistent
                      type="card"
                      title="Dashboard Manager basics"
                      description={
                        <span>
                          <p>
                            <em>Dashboards in 60 Seconds</em> combines Searchbase
                            and Dashboard Studio so you can build from reusable
                            searches without writing SPL or code.
                          </p>
                          <ul>
                            <li>
                              <strong>Included</strong> shows supported dashboards
                              shipped with the app. <strong>Yours</strong> shows
                              managed dashboards owned by you.
                              <strong> Shared</strong> shows managed dashboards
                              shared in the app that you can access, including
                              those created by other users.
                            </li>
                            <li>
                              Use <strong>Create New</strong>, or a dashboard card
                              action, to open the extended Studio editor, add
                              Cisco components, and wire drilldowns.
                            </li>
                            <li>
                              Reopen managed dashboards from this library so
                              their Searchbase and Cisco components load
                              correctly. Ordinary Studio dashboards are
                              intentionally not listed here. Manager-dependent
                              definitions are kept out of Splunk&apos;s standard
                              Dashboards listing to prevent unsupported opens;
                              native-only dashboards remain available there.
                            </li>
                          </ul>
                        </span>
                      }
                    >
                      <button
                        type="button"
                        className="custom-tooltip-block dashboard-manager-tooltip-trigger"
                        aria-label="Dashboard Manager help"
                      >
                        <QuestionCircle
                          className="icn-tooltip"
                          variant="filled"
                        />
                      </button>
                    </CustomTooltip>
                  </div>
                </div>
              </div>
              <div className="dashboard-manager-panel-switcher-slot">
                <div
                  className="dashboard-manager-view-switcher"
                  role="group"
                  aria-label="Dashboard Manager library view"
                >
                  <button
                    type="button"
                    aria-pressed={dashboardLibraryView === "cards"}
                    className={`dashboard-manager-view-switcher-option ${
                      dashboardLibraryView === "cards"
                        ? "dashboard-manager-view-switcher-option-active"
                        : ""
                    }`}
                    onClick={handleDashboardLibraryViewChange("cards")}
                  >
                    Card View
                  </button>
                  <button
                    type="button"
                    aria-pressed={dashboardLibraryView === "table"}
                    className={`dashboard-manager-view-switcher-option ${
                      dashboardLibraryView === "table"
                        ? "dashboard-manager-view-switcher-option-active"
                        : ""
                    }`}
                    onClick={handleDashboardLibraryViewChange("table")}
                  >
                    Table View
                  </button>
                </div>
              </div>
            </header>
            <ColumnLayout.Row className="dashboard-manager-library-row">
              <ColumnLayout.Column
                className="manager-search-dialog-container"
                span={12}
              >
                <div className="dashboard-manager-library-filters">
                  <div
                    className="dashboard-manager-scope-filter"
                    role="tablist"
                    aria-label="Dashboard Manager library scope"
                  >
                    {DASHBOARD_SCOPE_OPTIONS.map((option) => (
                      <span
                        key={option.id}
                        id={`dashboard-manager-scope-${option.id}`}
                        role="tab"
                        tabIndex={dashboardScope === option.id ? 0 : -1}
                        aria-selected={dashboardScope === option.id}
                        aria-controls="dashboard-manager-library-results"
                        className={`dashboard-manager-scope-filter-option ${
                          dashboardScope === option.id
                            ? "dashboard-manager-scope-filter-option-active"
                            : ""
                        }`}
                        onClick={handleDashboardScopeChange(option.id)}
                        onKeyDown={handleDashboardScopeKeyDown(option.id)}
                      >
                        {option.label}
                      </span>
                    ))}
                  </div>
                  <div className="dashboard-manager-library-search-field">
                    <Text
                      className="dashboard-manager-library-search"
                      canClear
                      aria-label="Filter Dashboard Manager library"
                      placeholder="Filter dashboards in this tab"
                      value={searchText}
                      onChange={(e, { value }) => {
                        setSearchText(value);
                        setPageNum(1);
                      }}
                      endAdornment={
                        <Magnifier className="dashboard-manager-search-icon" />
                      }
                      inline
                    ></Text>
                  </div>
                </div>
              </ColumnLayout.Column>
            </ColumnLayout.Row>

            <ColumnLayout.Row>
              <ColumnLayout.Column span={12}>
                <Paginator
                  className="dashboard-manager-paginator"
                  onChange={handlePageChange}
                  current={pageNum}
                  alwaysShowLastPageLink
                  totalPages={totalDashboardPages}
                />
              </ColumnLayout.Column>
            </ColumnLayout.Row>

            <ColumnLayout.Row
              id="dashboard-manager-library-results"
              role="tabpanel"
              aria-labelledby={`dashboard-manager-scope-${dashboardScope}`}
            >
              <ColumnLayout.Column>
                {dashboards.length == 0 && (
                  <WaitSpinner
                    size="large"
                    style={{ margin: 30 }}
                  ></WaitSpinner>
                )}
                <div
                  className="dashboard-manager-library-status"
                  role="status"
                  aria-live="polite"
                >
                  {dashboards.length > 0 && filteredDashboards.length === 0
                    ? "No dashboards match the current filters."
                    : ""}
                </div>
                {filteredDashboards.length > 0 &&
                dashboardLibraryView === "cards" ? (
                  <CardLayout
                    gutterSize={20}
                    cardMaxWidth={350}
                    cardMinWidth={350}
                    cardWidth={350}
                  >
                    {visibleDashboards.map((dash) => (
                      <Card
                        key={dash.title}
                        className="dashboard-manager-library-card"
                        onClick={() => {
                          handlePreviewDashboard(dash);
                        }}
                      >
                        <Card.Header className="dashboard-manager-library-card-header">
                          <div className="dashboard-manager-library-card-header-copy">
                            <div className="dashboard-manager-library-card-title-row">
                              <span
                                className="dashboard-manager-library-card-title"
                                title={dash.label || dash.title}
                              >
                                {truncateDashboardTitle(
                                  dash.label || dash.title,
                                )}
                              </span>
                              <FileCharts className="dashboard-manager-library-card-title-icon" />
                            </div>
                            <div
                              className="dashboard-manager-library-card-name"
                              title={dash.title}
                            >
                              {dash.title}
                            </div>
                          </div>
                        </Card.Header>
                        <Card.Body className="dashboard-manager-library-card-body">
                          <b>Author:</b> {dash.author || "Unknown"}
                          <br />
                          <b>Description:</b>{" "}
                          <div
                            className="dashboard-manager-library-card-description"
                            title={
                              dash.description || "No description provided."
                            }
                          >
                            {truncateDashboardDescription(dash.description)}
                          </div>
                        </Card.Body>

                        <Card.Footer className="dashboard-manager-library-card-footer">
                          <div className="dashboard-manager-card-footer-content">
                            <div className="dashboard-manager-card-footer-row">
                              <div className="dashboard-manager-library-card-actions">
                                <Tooltip content="Edit dashboard metadata">
                                  <Button
                                    appearance="subtle"
                                    icon={<FileCharts />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDashboardMetadataEditor(dash);
                                    }}
                                  />
                                </Tooltip>
                                <Tooltip content="Edit dashboard">
                                  <Button
                                    appearance="primary"
                                    icon={<Pencil />}
                                    label="Edit"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditDashboard(dash);
                                    }}
                                  />
                                </Tooltip>

                                <Tooltip content="Delete dashboard">
                                  <Button
                                    appearance="subtle"
                                    icon={<TrashCanCross />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRequestDeleteDashboard(dash);
                                    }}
                                  />
                                </Tooltip>
                                <Tooltip content="Preview Dashboard">
                                  <Button
                                    appearance="subtle"
                                    icon={<MagnifierPlus />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePreviewDashboard(dash);
                                    }}
                                  />
                                </Tooltip>
                                <Tooltip content="Open dashboard">
                                  <Button
                                    appearance="subtle"
                                    icon={<ArrowSquareTopRight />}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenDashboard(dash);
                                    }}
                                  />
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </Card.Footer>
                      </Card>
                    ))}
                  </CardLayout>
                ) : filteredDashboards.length > 0 ? (
                  <div className="dashboard-manager-library-table-wrapper">
                    <Table className="dashboard-manager-library-table">
                      <Table.Head>
                        <Table.HeadCell width={220}>Label</Table.HeadCell>
                        <Table.HeadCell width={220}>Name</Table.HeadCell>
                        <Table.HeadCell width={140}>Author</Table.HeadCell>
                        <Table.HeadCell width={140}>App</Table.HeadCell>
                        <Table.HeadCell>Description</Table.HeadCell>
                        <Table.HeadCell width={320}>Actions</Table.HeadCell>
                      </Table.Head>
                      <Table.Body>
                        {visibleDashboards.map((dash) => (
                          <Table.Row key={`${dash.title}-table-row`}>
                            <Table.Cell>{dash.label}</Table.Cell>
                            <Table.Cell>{dash.title}</Table.Cell>
                            <Table.Cell>{dash.author}</Table.Cell>
                            <Table.Cell>{dash.app}</Table.Cell>
                            <Table.Cell>
                              <span
                                className="dashboard-manager-library-table-description"
                                title={dash.description || ""}
                              >
                                {dash.description}
                              </span>
                            </Table.Cell>
                            <Table.Cell>
                              <div className="dashboard-manager-library-table-actions">
                                <Button
                                  appearance="primary"
                                  icon={<ArrowSquareTopRight />}
                                  label="Open"
                                  onClick={() => handleOpenDashboard(dash)}
                                />
                                <Button
                                  appearance="subtle"
                                  icon={<MagnifierPlus />}
                                  label="Preview"
                                  onClick={() => handlePreviewDashboard(dash)}
                                />
                                <Button
                                  appearance="secondary"
                                  icon={<FileCharts />}
                                  label="Metadata"
                                  onClick={() =>
                                    handleOpenDashboardMetadataEditor(dash)
                                  }
                                />
                                <Button
                                  appearance="secondary"
                                  icon={<Pencil />}
                                  label="Edit"
                                  onClick={() => handleEditDashboard(dash)}
                                />
                                <Button
                                  appearance="subtle"
                                  icon={<TrashCanCross />}
                                  label="Delete"
                                  onClick={() =>
                                    handleRequestDeleteDashboard(dash)
                                  }
                                />
                              </div>
                            </Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  </div>
                ) : null}
              </ColumnLayout.Column>
            </ColumnLayout.Row>
          </section>
        </div>
      </ColumnLayout>
    </>
  );
}
