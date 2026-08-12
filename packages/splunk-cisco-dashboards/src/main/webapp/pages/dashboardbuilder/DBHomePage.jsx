import React, { useState, useEffect, useMemo } from "react";
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
import EnterprisePreset from "@splunk/dashboard-presets/EnterprisePreset";
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
import Toaster, {
  makeCreateToast,
} from "@splunk/react-toast-notifications/Toaster";
import { TOAST_TYPES } from "@splunk/react-toast-notifications/ToastConstants";
import ToastMessages from "@splunk/react-toast-notifications/ToastMessages";
import TextArea from "@splunk/react-ui/TextArea";
import Tooltip from "@splunk/react-ui/Tooltip";
import CollapsiblePanel from "@splunk/react-ui/CollapsiblePanel";
import Checkbox from "@splunk/react-ui/Checkbox";
import CustomTooltip from "../../common/components/CustomTooltip/CustomTooltip";
import ManagerPreviewModal from "../../common/components/ManagerPreviewModal";
import { actionMenus } from "../../common/udf/presets";
import createSEIIconRegistry from "../../common/udf/IconProviders/createSEIIconRegistry";
import Paginator from "@splunk/react-ui/Paginator";
import Table from "@splunk/react-ui/Table";
import WaitSpinner from "@splunk/react-ui/WaitSpinner";
import useSplunkTheme from "@splunk/themes/useSplunkTheme";

import FileCharts from "@splunk/react-icons/FileCharts";
import QuestionCircle from "@splunk/react-icons/QuestionCircle";
import Plus from "@splunk/react-icons/Plus";
import ArrowSquareTopRight from "@splunk/react-icons/ArrowSquareTopRight";
import Magnifier from "@splunk/react-icons/Magnifier";
import { initialDefinition } from "./DashboardStudioEditor";
import { INSIGHTS_APP_ID } from "../../common/lib/constants";

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
  },
};

const DASHBOARD_PAGE_SIZE = 20;
const DASHBOARD_CARD_TITLE_LIMIT = 35;
const DASHBOARD_CARD_DESCRIPTION_LIMIT = 140;
const MANAGER_SUBTITLE_LIMIT = 140;
const DASHBOARD_SCOPE_OPTIONS = [
  { id: "all", label: "All" },
  { id: "yours", label: "Yours" },
  { id: "app", label: "This App's" },
];

const truncateManagerSubtitle = (subtitle) => {
  if (!subtitle || subtitle.length <= MANAGER_SUBTITLE_LIMIT) {
    return subtitle;
  }

  return `${subtitle.slice(0, MANAGER_SUBTITLE_LIMIT - 3).trimEnd()}...`;
};

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

const normalizeDashboardFilterValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

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

const isTruthyFavoriteValue = (value) =>
  value === true ||
  value === 1 ||
  ["1", "true", "yes", "favorite", "favourite"].includes(
    normalizeDashboardFilterValue(value),
  );

const getDashboardAppFromServiceUri = (uri) => {
  if (!uri || typeof uri !== "string") {
    return "";
  }

  try {
    const pathname = /^https?:\/\//i.test(uri) ? new URL(uri).pathname : uri;
    const match = pathname.match(/\/servicesNS\/[^/]+\/([^/]+)\//);
    return match?.[1] ? decodeURIComponent(match[1]) : "";
  } catch (error) {
    return "";
  }
};

const getDashboardNamespaceApp = (entry) =>
  entry?.acl?.app ||
  entry?.content?.["eai:acl.app"] ||
  getDashboardAppFromServiceUri(entry?.id) ||
  getDashboardAppFromServiceUri(entry?.links?.alternate) ||
  entry?.content?.["eai:appName"] ||
  "";

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
    "--dashboard-builder-modal-content-active":
      splunkTheme.contentColorActive,
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
  const [gridLayout, setGridLayout] = useState("absolute");
  const [openDeleteDashboard, setOpenDeleteDashboard] = useState(false);
  const [DashboardToDelete, setDashboardToDelete] = useState();
  const [pageNum, setPageNum] = useState(1);
  const [dashboardScope, setDashboardScope] = useState("all");
  const [showOnlyFavoriteDashboards, setShowOnlyFavoriteDashboards] =
    useState(false);
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
    "Turn predefined Cisco KPIs into actionable insights in seconds using the custom dashboard manager.";
  const dashboardManagerIconSrc = useMemo(
    () => buildAppStaticAssetUrl("appIcon.png", currentSplunkUser),
    [currentSplunkUser],
  );
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "SASN | Dashboard Manager";
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

  const filteredDashboards = useMemo(() => {
    const normalizedSearchText = searchText.trim().toLowerCase();
    const normalizedCurrentUser =
      normalizeDashboardFilterValue(currentSplunkUser);
    const normalizedAppId = normalizeDashboardFilterValue(INSIGHTS_APP_ID);

    return dashboards
      .filter((ds) => !ds.template)
      .filter((ds) => {
        if (dashboardScope === "app") {
          return normalizeDashboardFilterValue(ds.app) === normalizedAppId;
        }

        if (dashboardScope === "yours") {
          if (!normalizedCurrentUser) {
            return true;
          }

          return [ds.owner, ds.author]
            .map(normalizeDashboardFilterValue)
            .some((owner) => owner === normalizedCurrentUser);
        }

        return true;
      })
      .filter((ds) => !showOnlyFavoriteDashboards || ds.isFavorite)
      .filter(
        (ds) =>
          normalizedSearchText === "" ||
          ds.searchText.includes(normalizedSearchText),
      );
  }, [
    currentSplunkUser,
    dashboards,
    dashboardScope,
    searchText,
    showOnlyFavoriteDashboards,
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

  const handleOpenClick = () => {
    const dashid = `scd_${dashboardTitle.replaceAll(" ", "_").replaceAll("#", "")}`;
    const jsonDefinition = cloneDeep(initialDefinition);
    jsonDefinition.title = dashboardTitle;
    jsonDefinition.description = dashboardDescription;
    jsonDefinition.layout.type = gridLayout;

    addDash(
      dashid,
      JSON.stringify(jsonDefinition),
      dashboardTitle,
      dashboardDescription,
      "",
      "dark",
    ).then((response) => {
      if (response.status >= 200 && response.status <= 299) {
        console.log(response);
        syncDashboardManagerNavigation([
          ...dashboards,
          {
            title: dashid,
            label: dashboardTitle,
            definition: {
              title: dashboardTitle,
            },
          },
        ]).catch((error) => {
          console.warn("Unable to sync Dashboard Manager navigation.", error);
        });
        setOpenCreateDashboard(false);
        setTimeout(() => {
          //navigate(`/${dashid}/edit`, { replace: true });
          window.open(buildDashboardStudioUrl(dashid, "edit"), "_self");
        }, 500);
      } else {
        console.log(response);
        makeCreateToast(Toaster)({
          message: `An error occured while creating the new dashboard... ${JSON.stringify(
            response,
          )}`,
          type: TOAST_TYPES.ERROR,
        });
      }
    });
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
              const isFavorite = [
                r.content.isFavorite,
                r.content.is_favorite,
                r.content.favorite,
                r.content["eai:favorite"],
              ].some(isTruthyFavoriteValue);

              return {
                data: r.content["eai:data"],
                definition: data,
                author,
                app,
                contentApp,
                owner,
                sharing,
                deleteLink: r.links?.remove || r.links?.edit,
                title: r.name,
                label: r.content["label"],
                description,
                theme: normalizeDashboardTheme(jObj.dashboard.theme),
                isFavorite,
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
        syncDashboardManagerNavigation(insightDash).catch((error) => {
          console.warn("Unable to sync Dashboard Manager navigation.", error);
        });
      } else {
      }
    });
  };

  useEffect(() => {
    refreshDashboards();
  }, []);

  const handleRequestClosePreview = () => {
    setPreviewOpen(false);
  };

  const handleCloseCreateDashboard = () => {
    // kh 2026-05-10: Reset builder metadata and mode-specific state so the next modal session starts from a clean default configuration.
    setOpenCreateDashboard(false);
    setDashboardTitle("");
    setDashboardDescription("");
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
    }
  };

  const handleFavoriteDashboardFilterChange = (event, { checked }) => {
    setShowOnlyFavoriteDashboards(checked);
    setPageNum(1);
  };

  const stopDashboardPanelAction = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDashboardLibraryViewChange = (viewMode) => (event) => {
    stopDashboardPanelAction(event);
    setDashboardLibraryView(viewMode);
  };

  const handleDashboardLibraryViewKeyDown = (viewMode) => (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      stopDashboardPanelAction(event);
      setDashboardLibraryView(viewMode);
    }
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
      makeCreateToast(Toaster)({
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
      "",
      dashboardMetadataTarget.theme,
    ).then((response) => {
      if (response.status >= 200 && response.status <= 299) {
        makeCreateToast(Toaster)({
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
        makeCreateToast(Toaster)({
          message: `An error occured while updating dashboard metadata... ${JSON.stringify(
            response,
          )}`,
          type: TOAST_TYPES.ERROR,
        });
      }
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
          makeCreateToast(Toaster)({
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
          makeCreateToast(Toaster)({
            message: `An error occured while deleting the dashboard... ${JSON.stringify(
              response,
            )}`,
            type: TOAST_TYPES.ERROR,
          });
          setOpenDeleteDashboard(false);
          setDashboardToDelete(undefined);
        }
      });
  };

  return (
    <>
      <ToastMessages></ToastMessages>
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
                    onChange={(e, { value }) => {
                      setDashboardTitle(value);
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
                  onChange={(e, { value }) => {
                    setDashboardDescription(value);
                  }}
                ></TextArea>
              </SplunkControlGroup>
            </div>
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
          <Button
            appearance="primary"
            label="Create"
            disabled={!dashboardTitle.trim()}
            onClick={handleOpenClick}
          />

          <Button
            appearance="secondary"
            label="Cancel"
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
                              The <strong>Dashboard Manager</strong> helps you
                              create, preview, organize, and edit the dashboards
                              you build in Cisco Executive Insights.
                            </p>
                            <p>
                              It is a <strong>custom component</strong>{" "}
                              integrated into <strong>Dashboard Studio</strong>,
                              giving you a guided way to turn your KPIs into
                              dashboards while still using the flexibility of
                              Splunk Dashboard Studio.
                            </p>
                            <p>
                              Any dashboard you create here remains a normal
                              Dashboard Studio definition in this Splunk app.
                            </p>
                          </div>
                        }
                      ></Tooltip>
                    </div>
                  </div>
                  <div className="sub-title" title={dashboardManagerSubtitle}>
                    {truncateManagerSubtitle(dashboardManagerSubtitle)}
                  </div>
                </div>
                <div className="col3">
                  <img
                    className="icn-collection"
                    alt="Splunk App for Secure Networking"
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
          <div className="dashboard-manager-panel-switcher-slot">
            <div
              className="dashboard-manager-view-switcher"
              onMouseDown={stopDashboardPanelAction}
              onClick={stopDashboardPanelAction}
            >
              <span
                role="button"
                tabIndex={0}
                className={`dashboard-manager-view-switcher-option ${
                  dashboardLibraryView === "cards"
                    ? "dashboard-manager-view-switcher-option-active"
                    : ""
                }`}
                onClick={handleDashboardLibraryViewChange("cards")}
                onKeyDown={handleDashboardLibraryViewKeyDown("cards")}
              >
                Card View
              </span>
              <span
                role="button"
                tabIndex={0}
                className={`dashboard-manager-view-switcher-option ${
                  dashboardLibraryView === "table"
                    ? "dashboard-manager-view-switcher-option-active"
                    : ""
                }`}
                onClick={handleDashboardLibraryViewChange("table")}
                onKeyDown={handleDashboardLibraryViewKeyDown("table")}
              >
                Table View
              </span>
            </div>
          </div>
          <CollapsiblePanel
            defaultOpen
            open={true}
            id="dashboard_manager_dashboards"
            title={
              <div className="dashboard-manager-panel-title">
                <div className="dashboard-manager-panel-title-main">
                  <span>{`Dashboards (${filteredDashboards.length})`}</span>
                  <div className="dashboard-manager-panel-tooltip">
                    <CustomTooltip
                      width={450}
                      height={430}
                      delay="300"
                      placement="right"
                      persistent
                      type="card"
                      title="How Do I Use The Dashboard Manager?"
                      description={
                        <span>
                          <p>
                            Use Dashboard Manager to create, find, edit, and
                            refine Cisco dashboards.
                          </p>
                          <ul>
                            <li>
                              Click <strong>Create New</strong>, enter a
                              <strong> Dashboard Title</strong>, then choose a
                              layout mode.
                            </li>
                            <li>
                              Use the <strong>Search</strong>, favorites, and
                              ownership filters to narrow the list. Keep the
                              existing cards for visual browsing, or switch to
                              <strong> Table View</strong> when you need more
                              list density.
                            </li>
                            <li>
                              In Dashboard Studio, use the
                              <strong> Cisco KPI Picker</strong> in the tools
                              menu. It is the <strong>eyeball icon</strong>, and
                              it lets you add Cisco KPI-based content to your
                              dashboard.
                            </li>
                            <li>
                              You can use KPIs shipped with Splunk, plus custom
                              KPIs backed by your own Searchbase searches. If
                              you want to build from custom KPIs, you will need
                              Searchbase:{" "}
                              <a
                                href="https://splunkbase.splunk.com/app/7188"
                                target="_blank"
                              >
                                Searchbase on Splunkbase
                              </a>
                              .
                            </li>
                            <li>
                              You can also style dashboards with
                              <strong> custom Splunk icons</strong> and
                              <strong> backgrounds</strong>. These options
                              appear as additional tools in the Dashboard Studio
                              ribbon.
                            </li>
                          </ul>
                        </span>
                      }
                    >
                      <span className="custom-tooltip-block dashboard-manager-tooltip-trigger">
                        <QuestionCircle
                          className="icn-tooltip"
                          variant="filled"
                        />
                      </span>
                    </CustomTooltip>
                  </div>
                </div>
              </div>
            }
          >
            <ColumnLayout.Row className="dashboard-manager-library-row">
              <ColumnLayout.Column
                className="manager-search-dialog-container"
                span={12}
              >
                <div className="dashboard-manager-library-filters">
                  <Checkbox
                    className="dashboard-manager-favorite-filter"
                    checked={showOnlyFavoriteDashboards}
                    onChange={handleFavoriteDashboardFilterChange}
                  >
                    Show only favorites
                  </Checkbox>
                  <div
                    className="dashboard-manager-scope-filter"
                    role="tablist"
                    aria-label="Dashboard ownership filter"
                  >
                    {DASHBOARD_SCOPE_OPTIONS.map((option) => (
                      <span
                        key={option.id}
                        role="tab"
                        tabIndex={0}
                        aria-selected={dashboardScope === option.id}
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
                      placeholder="Filter dashboards, owners, or apps"
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

            <ColumnLayout.Row>
              <ColumnLayout.Column>
                {dashboards.length == 0 && (
                  <WaitSpinner
                    size="large"
                    style={{ margin: 30 }}
                  ></WaitSpinner>
                )}
                {dashboardLibraryView === "cards" ? (
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
                                    appearance="subtle"
                                    icon={<Pencil />}
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
                ) : (
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
                )}
              </ColumnLayout.Column>
            </ColumnLayout.Row>
          </CollapsiblePanel>
        </div>
      </ColumnLayout>
    </>
  );
}
