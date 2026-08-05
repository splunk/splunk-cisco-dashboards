/* eslint-disable react/prop-types */
/*
  Editable Dashboard code snippet referred from Dashboard framework example.
*/
import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react';
import { _ } from '@splunk/ui-utils/i18n';
import PropTypes from 'prop-types';
import { cloneDeep, isEqual } from 'lodash-es';
import Dashboard from '@splunk/dashboard';
import { DrilldownEditors } from '@splunk/dashboard-editors';
import { DashboardContextProvider } from '@splunk/dashboard-context';
import { serverTimezoneInfo, versionLabel } from '@splunk/splunk-utils/config';
import ItemGroup from '@splunk/dashboard-toolbar/ItemGroup';
import ExportDashboardButton from '@splunk/dashboard-toolbar/buttons/ExportDashboardButton';
import DashboardSourceEditor from '@splunk/dashboard/DashboardSourceEditor';
import EditorGroup from '@splunk/dashboard-toolbar/groups/EditorGroup';
import { testTileConfig } from '@splunk/visualization-context/MapContext';
import ModeSwitch from '@splunk/dashboard-toolbar/buttons/ModeSwitch';
import Button from '@splunk/react-ui/Button';
import Dropdown from '@splunk/react-ui/Dropdown';
import Menu from '@splunk/react-ui/Menu';
import SquaresLayered from '@splunk/react-icons/SquaresLayered';
import editableActions from './editableActions';
import actions from './actions';
import SaveButton from './SaveButton';
import InsightKpiButton from './InsightKpiButton';
import EventHandlerPresets from './presets/EventHandlerPresets';
import InsightKpiEditor from './InsightKpi/InsightKpiEditor';

import Layout from '@splunk/react-icons/Layout';
import FileCharts from '@splunk/react-icons/FileCharts';
import Plus from '@splunk/react-icons/Plus';
import PencilUnderline from '@splunk/react-icons/PencilUnderline';
import LayoutOverview from '@splunk/react-icons/LayoutOverview';

import { default as SplunkControlGroup } from '@splunk/react-ui/ControlGroup';
import Modal from '@splunk/react-ui/Modal';
import Tooltip from '@splunk/react-ui/Tooltip';
import Select from '@splunk/react-ui/Select';
import Text from '@splunk/react-ui/Text';
import TabLayout from '@splunk/react-ui/TabLayout';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Input from '@splunk/react-search/components/Input';
import defaultSPLSyntax from '@splunk/dashboard-utils/defaultSPLSyntax.json';
import {
    VisualizationGroup,
    ControlGroup,
    HistoryGroup,
    SidebarControlGroup,
    GridLineSwitch,
    IconGallery,
    Image,
    Markdown,
    Shapes,
} from '@splunk/dashboard-toolbar';
import Cog from '@splunk/react-icons/Cog';

import Card from '@splunk/react-ui/Card';
import {
    getDashboards,
    normalizeDashboardTheme,
    syncDashboardManagerNavigation,
} from '../../common/lib/splunk';
import { defaultFetchInit } from '@splunk/splunk-utils/fetch';
import { INSIGHTS_APP_ID } from '../../common/lib/constants';
import { getDashboard } from '../../common/lib/splunk';
import '../../common/styles/commonstyles.css';
import Toaster, { makeCreateToast } from '@splunk/react-toast-notifications/Toaster';
import { TOAST_TYPES } from '@splunk/react-toast-notifications/ToastConstants';
import ToastMessages from '@splunk/react-toast-notifications/ToastMessages';
import { addDash } from '../../common/lib/splunk';
import { SearchBaseDataSourcePanel } from './SearchBaseDataSourcePanel';
import { DataSourceEditors } from '@splunk/dashboard-editors';
import SelectSearchbaseSearchSidebar from './SelectSearchbaseSearchSidebar';
import { getSearchBaseConfStanza } from '../../common/lib/searchbase';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import CollapsiblePanel from '@splunk/react-ui/CollapsiblePanel';
import DOMPurify from 'dompurify';
import Link from '@splunk/react-ui/Link';
import ButtonGroup from '@splunk/react-ui/ButtonGroup';
import styled from 'styled-components';
import prismaDarkTheme from '@splunk/themes/prisma/dark';
import prismaLightTheme from '@splunk/themes/prisma/light';
import SplunkThemeProvider from '@splunk/themes/SplunkThemeProvider';
import useSplunkTheme from '@splunk/themes/useSplunkTheme';
import { isVersionLower, getServerInfo } from '../../common/lib/splunk';
import Paintbrush from '@splunk/react-icons/Paintbrush';
import BackgroundButton from './BackgroundButton';
import SpaceManagerButton from './SpaceManager/SpaceManagerButton';
import useDashboardStore from '../../common/state/dashboardStore';
import createSEIIconRegistry from '../../common/udf/IconProviders/createSEIIconRegistry';
import { resolveSearchbaseDefinitionForNativeStudio } from './searchbaseDefinitionUtils';
import { repairSearchbaseTimeQueryParameters } from './dashboardTimeUtils';

const ENABLE_EXPERIMENTAL_SPACE_MANAGER = false;

const StyledCardContent = styled.div`
    height: 160px;
    background: #ffffff;
`;

const EXPORT_TRACKED_DATA_SOURCE_TYPES = new Set(['ds.search', 'ds.searchbase', 'ds.savedSearch']);
const EXPORT_SEARCH_DISCOVERY_GRACE_MS = 4000;

const getDashboardDataSourceRegistry = (dashboardApi) => {
    if (dashboardApi?.getDataSourceRegistry) {
        return dashboardApi.getDataSourceRegistry();
    }

    return dashboardApi?.dataSourceRegistry;
};

const getControllerSearchJob = (controller) => {
    const candidates = [controller, controller?.dataSource, controller?.ds, controller?.source];

    for (const candidate of candidates) {
        if (candidate?.searchJob?.getProgress) {
            return candidate.searchJob;
        }
    }

    return undefined;
};

const getSearchProgressStatus = (progress) => {
    const content = progress?.content ?? {};
    const dispatchState = `${content.dispatchState ?? ''}`.toLowerCase();
    const isDone = Boolean(content.isDone) || dispatchState === 'done';

    return {
        dispatchState: dispatchState || (isDone ? 'done' : 'pending'),
        isDone,
        resultCount: content.resultCount ?? content.resultPreviewCount ?? 0,
        sid: content.sid,
    };
};

const toDashboardRecord = (dashboard) => {
    if (!dashboard) {
        return undefined;
    }

    if (typeof dashboard.data === 'string' && dashboard.data.trim().startsWith('{')) {
        return {
            data: dashboard.data,
            author: dashboard.author,
            app: dashboard.app,
            title: dashboard.title,
            label: dashboard.label,
            description: dashboard.description,
            tag: dashboard.tag,
            theme: normalizeDashboardTheme(dashboard.theme),
        };
    }

    const definition = dashboard.definition ?? dashboard.data;

    if (!definition) {
        return undefined;
    }

    return {
        data: typeof definition === 'string' ? definition : JSON.stringify(definition),
        author: dashboard.author,
        app: dashboard.app,
        title: dashboard.title,
        label: dashboard.label,
        description: dashboard.description,
        tag: dashboard.tag,
        theme: normalizeDashboardTheme(dashboard.theme),
    };
};

const escapeXml = (value = '') =>
    String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const DEFAULT_USER_ERROR_MESSAGE = 'An unexpected error occurred. Please try again.';

const getSafeErrorMessage = (error, fallback = DEFAULT_USER_ERROR_MESSAGE) => {
    if (!error) {
        return fallback;
    }

    if (typeof error === 'string') {
        const firstLine = error.split('\n')[0].trim();
        return firstLine || fallback;
    }

    if (error instanceof Error) {
        const message = error.message?.trim();
        return message ? message.split('\n')[0] : fallback;
    }

    return fallback;
};

const getSplunkResponseErrorMessage = (response, fallback = DEFAULT_USER_ERROR_MESSAGE) => {
    const messages = response?.messages;
    if (Array.isArray(messages) && messages.length > 0) {
        const text = messages
            .map((entry) => (typeof entry?.text === 'string' ? entry.text.trim() : ''))
            .filter(Boolean)
            .join(' ');

        if (text) {
            return text.split('\n')[0];
        }
    }

    if (typeof response?.status === 'number' && response.status >= 400) {
        return `Request failed with status ${response.status}.`;
    }

    return fallback;
};

export const initialDefinition = {
    visualizations: {},
    dataSources: {},
    defaults: {
        dataSources: {
            'ds.search': {
                options: {
                    queryParameters: {
                        latest: '$global_time.latest$',
                        earliest: '$global_time.earliest$',
                    },
                },
            },
        },
    },
    inputs: {
        input_global_trp: {
            type: 'input.timerange',
            options: {
                token: 'global_time',
                defaultValue: '-24h@h,now',
            },
            title: 'Global Time Range',
        },
    },
    layout: {
        type: 'absolute',
        options: {
            width: 2000,
            height: 960,
            display: 'auto',
        },
        structure: [],
        globalInputs: ['input_global_trp'],
    },
    description: '',
    title: '',
};

async function updateDash(
    dashName,
    jsonDefinition,
    app,
    owner,
    description,
    label,
    tag = '',
    theme = 'light',
) {
    const dashboardTheme = normalizeDashboardTheme(theme, 'light');
    let definition = `<dashboard version="2" theme="${dashboardTheme}">
    <label>${escapeXml(label)}</label>
    <description>${escapeXml(description)}</description>
    <tag>${escapeXml(tag)}</tag>
   <definition><![CDATA[${jsonDefinition}]]></definition>
   
   <meta type="hiddenElements"><![CDATA[
        {
        "hideEdit": true,
        "hideOpenInSearch": false,
        "hideExport": false
        }
   ]]></meta>
</dashboard>`;

    let body = `eai:data=${encodeURIComponent(definition)}`;

    const fetchInit = defaultFetchInit; // from splunk-utils API
    fetchInit.method = 'POST';
    const response = await fetch(
        `/en-US/splunkd/__raw/servicesNS/${owner}/${app}/data/ui/views/${dashName}?output_mode=json`,
        {
            ...fetchInit,
            body: body,
        },
    );
    const data = await response.json();
    data.status = response.status;
    return data;
}

const getDefinitionTextValue = (definition, key, fallback = '') => {
    const value = definition?.[key];
    if (typeof value !== 'string') {
        return fallback;
    }

    const trimmedValue = value.trim();
    return trimmedValue || fallback;
};

const formatSasnDashboardTitle = (title) => {
    const dashboardName = String(title || 'Dashboard Manager')
        .replace(/^(?:SASN\s*\|\s*)+/i, '')
        .replace(/\s*\|\s*Splunk(?:\s+Enterprise)?\s+[\w.-]+\s*$/i, '')
        .trim();

    return `SASN | ${dashboardName || 'Dashboard Manager'}`;
};

export const AbsolutSVG = () => {
    return (
        <svg
            width="90"
            height="52"
            viewBox="0 0 90 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g clip-path="url(#clip0)">
                <path d="M0 0H89.9167V52H0V0Z" fill="white"></path>
                <path d="M3.08714 -27.5804L2.5835 84.9253" stroke="#E1E6EB"></path>
                <path d="M7.08714 -27.5629L6.5835 84.9428" stroke="#E1E6EB"></path>
                <path d="M11.0871 -27.5448L10.5835 84.9609" stroke="#E1E6EB"></path>
                <path d="M15.0871 -27.5267L14.5835 84.979" stroke="#E1E6EB"></path>
                <path d="M19.0871 -27.5092L18.5835 84.9965" stroke="#E1E6EB"></path>
                <path d="M23.0871 -27.4911L22.5835 85.0146" stroke="#E1E6EB"></path>
                <path d="M27.0871 -27.473L26.5835 85.0327" stroke="#E1E6EB"></path>
                <path d="M31.0871 -27.4554L30.5835 85.0503" stroke="#E1E6EB"></path>
                <path d="M35.0871 -27.4375L34.5835 85.0682" stroke="#E1E6EB"></path>
                <path d="M39.0871 -27.4193L38.5835 85.0864" stroke="#E1E6EB"></path>
                <path d="M43.0861 -27.4017L42.5825 85.104" stroke="#E1E6EB"></path>
                <path d="M47.0861 -27.3837L46.5825 85.122" stroke="#E1E6EB"></path>
                <path d="M51.0861 -27.3656L50.5825 85.1401" stroke="#E1E6EB"></path>
                <path d="M55.0861 -27.348L54.5825 85.1577" stroke="#E1E6EB"></path>
                <path d="M59.0861 -27.33L58.5825 85.1757" stroke="#E1E6EB"></path>
                <path d="M63.0861 -27.3119L62.5825 85.1938" stroke="#E1E6EB"></path>
                <path d="M67.0861 -27.2943L66.5825 85.2114" stroke="#E1E6EB"></path>
                <path d="M71.0861 -27.2762L70.5825 85.2295" stroke="#E1E6EB"></path>
                <path d="M75.0861 -27.2583L74.5825 85.2474" stroke="#E1E6EB"></path>
                <path d="M79.0861 -27.2406L78.5825 85.2651" stroke="#E1E6EB"></path>
                <path d="M83.0861 -27.2225L82.5825 85.2832" stroke="#E1E6EB"></path>
                <path d="M87.0861 -27.2045L86.5825 85.3012" stroke="#E1E6EB"></path>
                <path d="M100.952 3.35839L-11.5537 2.85913" stroke="#E1E6EB"></path>
                <path d="M100.933 7.35839L-11.5723 6.85913" stroke="#E1E6EB"></path>
                <path d="M100.916 11.3584L-11.5898 10.8591" stroke="#E1E6EB"></path>
                <path d="M100.898 15.3584L-11.6074 14.8591" stroke="#E1E6EB"></path>
                <path d="M100.881 19.3584L-11.625 18.8591" stroke="#E1E6EB"></path>
                <path d="M100.863 23.3584L-11.6426 22.8591" stroke="#E1E6EB"></path>
                <path d="M100.846 27.3584L-11.6602 26.8591" stroke="#E1E6EB"></path>
                <path d="M100.827 31.3584L-11.6787 30.8591" stroke="#E1E6EB"></path>
                <path d="M100.809 35.3584L-11.6963 34.8591" stroke="#E1E6EB"></path>
                <path d="M100.792 39.3584L-11.7139 38.8591" stroke="#E1E6EB"></path>
                <path d="M100.774 43.3582L-11.7314 42.8589" stroke="#E1E6EB"></path>
                <path d="M100.757 47.3582L-11.749 46.8589" stroke="#E1E6EB"></path>
                <path d="M100.738 51.3582L-11.7676 50.8589" stroke="#E1E6EB"></path>
                <path
                    d="M51.557 17.2144H27.9482V40.3573H51.557V17.2144Z"
                    stroke="#00A4FD"
                    stroke-dasharray="2 2"
                ></path>
                <path d="M61.9682 11.6431H38.3594V34.786H61.9682V11.6431Z" fill="#C3CBD4"></path>
                <path
                    d="M63.3594 10.1431H61.3594C61.0832 10.1431 60.8594 10.3669 60.8594 10.6431V12.6431C60.8594 12.9192 61.0832 13.1431 61.3594 13.1431H63.3594C63.6355 13.1431 63.8594 12.9192 63.8594 12.6431V10.6431C63.8594 10.3669 63.6355 10.1431 63.3594 10.1431Z"
                    fill="#00A4FD"
                ></path>
                <path
                    d="M63.3594 33.1431H61.3594C61.0832 33.1431 60.8594 33.3669 60.8594 33.6431V35.6431C60.8594 35.9192 61.0832 36.1431 61.3594 36.1431H63.3594C63.6355 36.1431 63.8594 35.9192 63.8594 35.6431V33.6431C63.8594 33.3669 63.6355 33.1431 63.3594 33.1431Z"
                    fill="#00A4FD"
                ></path>
                <path
                    d="M39.3594 33.1431H37.3594C37.0832 33.1431 36.8594 33.3669 36.8594 33.6431V35.6431C36.8594 35.9192 37.0832 36.1431 37.3594 36.1431H39.3594C39.6355 36.1431 39.8594 35.9192 39.8594 35.6431V33.6431C39.8594 33.3669 39.6355 33.1431 39.3594 33.1431Z"
                    fill="#00A4FD"
                ></path>
                <path
                    d="M39.3594 10.1431H37.3594C37.0832 10.1431 36.8594 10.3669 36.8594 10.6431V12.6431C36.8594 12.9192 37.0832 13.1431 37.3594 13.1431H39.3594C39.6355 13.1431 39.8594 12.9192 39.8594 12.6431V10.6431C39.8594 10.3669 39.6355 10.1431 39.3594 10.1431Z"
                    fill="#00A4FD"
                ></path>
                <path d="M61.9682 11.6431H38.3594V34.786H61.9682V11.6431Z" stroke="#00A4FD"></path>
                <path
                    d="M52.6809 26.0151L55.5383 36.5367C55.7168 37.1938 56.6101 37.2999 56.9287 36.7017L58.9211 32.9615L62.7323 31.9653C63.375 31.7973 63.4908 30.9402 62.9167 30.5996L53.7875 25.1835C53.2068 24.839 52.5048 25.3666 52.6809 26.0151Z"
                    fill="#171D21"
                    stroke="white"
                ></path>
                <path
                    d="M-0.00011003 1.20401e-05V-0.887085H-0.887207V1.20401e-05H-0.00011003ZM89.9166 1.20401e-05H90.8037V-0.887085H89.9166V1.20401e-05ZM89.9166 52V52.8871H90.8037V52H89.9166ZM-0.00011003 52H-0.887207V52.8871H-0.00011003V52ZM-0.00011003 0.887109H89.9166V-0.887085H-0.00011003V0.887109ZM89.0295 1.20401e-05V52H90.8037V1.20401e-05H89.0295ZM89.9166 51.1129H-0.00011003V52.8871H89.9166V51.1129ZM0.886987 52V1.20401e-05H-0.887207V52H0.886987Z"
                    fill="#818D99"
                ></path>
            </g>
            <defs>
                <clipPath id="clip0">
                    <rect width="90" height="52" fill="white"></rect>
                </clipPath>
            </defs>
        </svg>
    );
};

export const GridSVG = () => {
    return (
        <svg
            width="90"
            height="52"
            viewBox="0 0 90 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <g clip-path="url(#clip0)">
                <path
                    d="M21.7502 27.402C21.7502 27.1406 21.3473 26.9287 20.8502 26.9287C20.3531 26.9287 19.9502 27.1406 19.9502 27.402V51.5269C19.9502 51.7882 20.3531 52.0001 20.8502 52.0001C21.3473 52.0001 21.7502 51.7882 21.7502 51.5269V27.402Z"
                    fill="#00A4FD"
                ></path>
                <path
                    d="M58.1825 0.5H0.5V23.6429H58.1825V0.5Z"
                    fill="#818D99"
                    stroke="#C3CBD4"
                ></path>
                <path
                    d="M89.4162 0.5H62.0215V23.6429H89.4162V0.5Z"
                    fill="#818D99"
                    stroke="#C3CBD4"
                ></path>
                <path
                    d="M89.4167 27.4287H23.2158V51.5001H89.4167V27.4287Z"
                    fill="#818D99"
                    stroke="#C3CBD4"
                ></path>
                <path
                    d="M18.4298 27.4287H0.5V37.5716H18.4298V27.4287Z"
                    fill="#818D99"
                    stroke="#C3CBD4"
                ></path>
                <path
                    d="M18.4298 41.3572H0.5V51.5001H18.4298V41.3572Z"
                    fill="#818D99"
                    stroke="#C3CBD4"
                ></path>
                <mask
                    id="mask0"
                    mask-type="alpha"
                    maskUnits="userSpaceOnUse"
                    x="17"
                    y="32"
                    width="16"
                    height="15"
                >
                    <path d="M32.9521 32.9722H17.9521V46.9722H32.9521V32.9722Z" fill="white"></path>
                    <path
                        d="M24.8989 33.9722C24.6227 33.9722 24.3989 34.196 24.3989 34.4722V39.4812H22.5059V38.5479C22.5059 38.353 22.2929 38.2331 22.1263 38.3341L19.0725 40.1856C18.912 40.2829 18.912 40.5158 19.0725 40.6131L22.1263 42.4646C22.2929 42.5656 22.5059 42.4457 22.5059 42.2508V41.3175H24.3989V45.4083C24.3989 45.6845 24.6227 45.9083 24.8989 45.9083H25.7919C26.068 45.9083 26.2919 45.6845 26.2919 45.4083V41.3175H28.1849V42.2508C28.1849 42.4457 28.3979 42.5656 28.5645 42.4646L31.6182 40.6131C31.7787 40.5158 31.7787 40.2829 31.6182 40.1856L28.5645 38.3341C28.3979 38.2331 28.1849 38.353 28.1849 38.5479V39.4812H26.2919V34.4722C26.2919 34.196 26.068 33.9722 25.7919 33.9722H24.8989Z"
                        fill="black"
                    ></path>
                </mask>
                <g mask="url(#mask0)">
                    <path
                        d="M24.3989 39.4812V40.4812H25.3989V39.4812H24.3989ZM22.5059 39.4812H21.5059V40.4812H22.5059V39.4812ZM22.1263 38.3341L21.6078 37.479L22.1263 38.3341ZM19.0725 40.1856L19.591 41.0407L19.0725 40.1856ZM19.0725 40.6131L19.591 39.758L19.0725 40.6131ZM22.1263 42.4646L21.6078 43.3197L22.1263 42.4646ZM22.5059 41.3175V40.3175H21.5059V41.3175H22.5059ZM24.3989 41.3175H25.3989V40.3175H24.3989V41.3175ZM26.2919 41.3175V40.3175H25.2919V41.3175H26.2919ZM28.1849 41.3175H29.1849V40.3175H28.1849V41.3175ZM28.5645 42.4646L29.0829 43.3197L28.5645 42.4646ZM31.6182 40.6131L31.0998 39.758L31.6182 40.6131ZM31.6182 40.1856L31.0998 41.0407L31.6182 40.1856ZM28.5645 38.3341L29.0829 37.479L28.5645 38.3341ZM28.1849 39.4812V40.4812H29.1849V39.4812H28.1849ZM26.2919 39.4812H25.2919V40.4812H26.2919V39.4812ZM25.3989 34.4722C25.3989 34.7483 25.175 34.9722 24.8989 34.9722V32.9722C24.0705 32.9722 23.3989 33.6437 23.3989 34.4722H25.3989ZM25.3989 39.4812V34.4722H23.3989V39.4812H25.3989ZM22.5059 40.4812H24.3989V38.4812H22.5059V40.4812ZM23.5059 39.4812V38.5479H21.5059V39.4812H23.5059ZM23.5059 38.5479C23.5059 37.5736 22.4409 36.9739 21.6078 37.479L22.6447 39.1892C22.1449 39.4922 21.5059 39.1324 21.5059 38.5479H23.5059ZM21.6078 37.479L18.5541 39.3305L19.591 41.0407L22.6447 39.1892L21.6078 37.479ZM18.5541 39.3304C17.7515 39.8171 17.7515 40.9816 18.5541 41.4682L19.591 39.758C20.0725 40.05 20.0725 40.7487 19.591 41.0407L18.5541 39.3304ZM18.5541 41.4682L21.6078 43.3197L22.6447 41.6095L19.591 39.758L18.5541 41.4682ZM21.6078 43.3197C22.4409 43.8248 23.5059 43.225 23.5059 42.2508H21.5059C21.5059 41.6663 22.1449 41.3064 22.6447 41.6095L21.6078 43.3197ZM23.5059 42.2508V41.3175H21.5059V42.2508H23.5059ZM24.3989 40.3175H22.5059V42.3175H24.3989V40.3175ZM25.3989 45.4083V41.3175H23.3989V45.4083H25.3989ZM24.8989 44.9083C25.175 44.9083 25.3989 45.1322 25.3989 45.4083H23.3989C23.3989 46.2368 24.0705 46.9083 24.8989 46.9083V44.9083ZM25.7919 44.9083H24.8989V46.9083H25.7919V44.9083ZM25.2919 45.4083C25.2919 45.1322 25.5157 44.9083 25.7919 44.9083V46.9083C26.6203 46.9083 27.2919 46.2368 27.2919 45.4083H25.2919ZM25.2919 41.3175V45.4083H27.2919V41.3175H25.2919ZM28.1849 40.3175H26.2919V42.3175H28.1849V40.3175ZM29.1849 42.2508V41.3175H27.1849V42.2508H29.1849ZM28.046 41.6095C28.5458 41.3064 29.1849 41.6663 29.1849 42.2508H27.1849C27.1849 43.225 28.2499 43.8248 29.0829 43.3197L28.046 41.6095ZM31.0998 39.758L28.046 41.6095L29.0829 43.3197L32.1367 41.4682L31.0998 39.758ZM31.0998 41.0407C30.6182 40.7487 30.6182 40.05 31.0998 39.758L32.1367 41.4682C32.9393 40.9816 32.9393 39.8171 32.1367 39.3305L31.0998 41.0407ZM28.046 39.1892L31.0998 41.0407L32.1367 39.3305L29.0829 37.479L28.046 39.1892ZM29.1849 38.5479C29.1849 39.1324 28.5458 39.4922 28.046 39.1892L29.0829 37.479C28.2499 36.9739 27.1849 37.5736 27.1849 38.5479H29.1849ZM29.1849 39.4812V38.5479H27.1849V39.4812H29.1849ZM26.2919 40.4812H28.1849V38.4812H26.2919V40.4812ZM25.2919 34.4722V39.4812H27.2919V34.4722H25.2919ZM25.7919 34.9722C25.5157 34.9722 25.2919 34.7483 25.2919 34.4722H27.2919C27.2919 33.6437 26.6203 32.9722 25.7919 32.9722V34.9722ZM24.8989 34.9722H25.7919V32.9722H24.8989V34.9722Z"
                        fill="white"
                    ></path>
                    <path
                        d="M24.8989 33.9722C24.6227 33.9722 24.3989 34.196 24.3989 34.4722V39.4812H22.5059V38.5479C22.5059 38.353 22.2929 38.2331 22.1263 38.3341L19.0725 40.1856C18.912 40.2829 18.912 40.5158 19.0725 40.6131L22.1263 42.4646C22.2929 42.5656 22.5059 42.4457 22.5059 42.2508V41.3175H24.3989V45.4083C24.3989 45.6845 24.6227 45.9083 24.8989 45.9083H25.7919C26.068 45.9083 26.2919 45.6845 26.2919 45.4083V41.3175H28.1849V42.2508C28.1849 42.4457 28.3979 42.5656 28.5645 42.4646L31.6182 40.6131C31.7787 40.5158 31.7787 40.2829 31.6182 40.1856L28.5645 38.3341C28.3979 38.2331 28.1849 38.353 28.1849 38.5479V39.4812H26.2919V34.4722C26.2919 34.196 26.068 33.9722 25.7919 33.9722H24.8989Z"
                        fill="#171D21"
                    ></path>
                </g>
            </g>
            <defs>
                <clipPath id="clip0">
                    <rect width="90" height="52" fill="white"></rect>
                </clipPath>
            </defs>
        </svg>
    );
};

const featureFlags = {
    enableCollapsibleToolbar: true,
    enableGridLayoutCssScaling: false,
    enableSmartSourceDS: true,
    enableShowHide: true,
    visualizations_enableEventsViewerTags: true,
};

const timezone = { serializedTimezone: serverTimezoneInfo };

const formatJSON = (val = {}) => {
    try {
        const res = JSON.parse(val);
        return JSON.stringify(res, null, 4);
    } catch {
        return JSON.stringify({ error: 'Invalid JSON definition.' }, null, 4);
    }
};

const IsJsonString = (str) => {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
};

const SearchbaseDataSourceEditor = (props) => {
    const { onOptionsChange, options, dashboardApi } = props;
    const [search, setSearch] = useState();

    const [timeRange, setTimeRange] = useState(
        props.options.queryParameters == undefined
            ? { mode: 'input', earliest: '', latest: '', token: undefined }
            : !props.options.queryParameters.earliest || !props.options.queryParameters.earliest
              ? { mode: 'input', earliest: '', latest: '', token: undefined }
              : props.options.queryParameters.earliest[0] == '$'
                ? {
                      mode: 'input',
                      earliest: '',
                      latest: '',
                      token: props.options.queryParameters.earliest
                          .replaceAll('$', '')
                          .split('.')[0],
                  }
                : { mode: 'default', earliest: '', latest: '', token: undefined },
    );

    const timeRangeInputs = Object.entries(dashboardApi.getDefinition().inputs)
        .filter(
            ([_, input]) =>
                input.type === 'input.timerange' || input.type === 'input.simpleTimePicker',
        )
        .map(([key, input]) => ({
            id: key,
            title: input.title,
            defaultValue: input.options.defaultValue,
            token: input.options.token,
        }));

    useEffect(() => {
        if (options.ref) {
            const getSearchDefinition = async () => {
                const data = await getSearchBaseConfStanza(options.ref, options.ownerApp);
                setSearch(data.entry[0]);
            };
            getSearchDefinition();
        }
    }, []);

    useEffect(() => {
        if (timeRange.earliest && timeRange.latest) {
            onOptionsChange({
                ...options,
                queryParameters: {
                    earliest: timeRange.earliest,
                    latest: timeRange.latest,
                },
            });
        }
    }, [timeRange]);

    return (
        <>
            {search ? (
                <>
                    <CollapsiblePanel
                        defaultOpen={true}
                        title={
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    width: 310,
                                }}
                            >
                                <span>SPL query</span>
                                <Link
                                    openInNewContext
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(
                                            `/app/searchbase/start#/edit/${encodeURIComponent(
                                                `${search?.name}`,
                                            )}/search-spl`,
                                            '_blank',
                                        );
                                    }}
                                >
                                    Edit in Searchbase
                                </Link>
                            </div>
                        }
                    >
                        <div style={{ margin: 15 }}>
                            <Input
                                append
                                syntax={defaultSPLSyntax}
                                minLines={5}
                                style={{ width: '100%', margin: 15 }}
                                value={search.content.search}
                                enabled={false}
                            />
                        </div>
                        <div style={{ display: 'grid', margin: 15 }}>
                            <span style={{ fontWeight: 'bold', marginBottom: 10 }}>Time range</span>
                            <ButtonGroup>
                                <Button
                                    selected={timeRange.mode == 'input'}
                                    onClick={() =>
                                        setTimeRange((prev) => ({
                                            ...prev,
                                            mode: 'input',
                                            earliest: undefined,
                                            latest: undefined,
                                        }))
                                    }
                                >
                                    Input
                                </Button>

                                <Button
                                    selected={timeRange.mode == 'default'}
                                    onClick={() =>
                                        setTimeRange((prev) => ({
                                            ...prev,
                                            mode: 'default',
                                            earliest: search.content.dispatch_earliest_time,
                                            latest: search.content.dispatch_latest_time,
                                        }))
                                    }
                                >
                                    Default
                                </Button>
                            </ButtonGroup>
                            <div
                                style={{
                                    margin: 0,
                                }}
                            >
                                {timeRange.mode == 'default' ? (
                                    <span style={{ color: '#666', fontSize: 11 }}>
                                        Default dispatch earliest and latest time set in the search
                                        definition (searchbase.conf)
                                        <br />
                                        <b>Earliest: </b>
                                        {search.content.dispatch_earliest_time}
                                        <br />
                                        <b>Latest: </b>
                                        {search.content.dispatch_latest_time}
                                    </span>
                                ) : (
                                    <Select
                                        style={{ minWidth: 329, marginTop: 10 }}
                                        onChange={(e, { value }) =>
                                            setTimeRange((prev) => ({
                                                ...prev,
                                                earliest: `$${value}.earliest$`,
                                                latest: `$${value}.latest$`,
                                                token: value,
                                            }))
                                        }
                                        defaultValue={
                                            timeRange.token
                                                ? timeRange.token
                                                : timeRangeInputs && timeRangeInputs.length > 0
                                                  ? timeRangeInputs[0].token
                                                  : undefined
                                        }
                                    >
                                        {timeRangeInputs.map((tr) => (
                                            <Select.Option
                                                label={`${tr.title} (${tr.token})`}
                                                value={tr.token}
                                            ></Select.Option>
                                        ))}
                                    </Select>
                                )}
                            </div>
                        </div>
                    </CollapsiblePanel>
                    <CollapsiblePanel defaultOpen={false} title="Description">
                        <div
                            style={{ margin: 15 }}
                            dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(search.content.description, {
                                    USE_PROFILES: { html: true },
                                }),
                            }}
                        ></div>
                    </CollapsiblePanel>
                    <CollapsiblePanel defaultOpen={false} title="Related Information">
                        <div
                            style={{ margin: 15 }}
                            dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(search.content.related_info, {
                                    USE_PROFILES: { html: true },
                                }),
                            }}
                        ></div>
                    </CollapsiblePanel>
                </>
            ) : (
                <WaitSpinner size="large" style={{ margin: 15 }}></WaitSpinner>
            )}
        </>
    ); //<div style={{ minHeight: 100, background: '#FF0000' }}>SearchBase Editor</div>;
};

// code snippet referred from dashboard framework examples
const DashboardStudioEditor = ({
    tokens,
    confirmLeaveDirtyPage,
    actionMenus: actionMenusOptions,
    eventActions,
    fieldActions,
    preset,
    onDashboardEvent,
    openID,
    embededMode = false,
    onDashboardSaved,
    readOnly = false,
    initialDashboard,
    skipDashboardListLoad = false,
    skipServerInfoLoad = false,
    showClose = true,
    onSearchStatusChange,
    //hasCloneSharingPermission,
}) => {
    const navigate = useNavigate();
    const splunkTheme = useSplunkTheme();
    const dashboardBuilderColorScheme =
        splunkTheme.colorScheme === 'dark' ? 'dark' : 'light';

    const [isCodeEditable, setIsCodeEditable] = useState(false);

    const dashboardApiElem = useRef(null);
    const [apiRef, setApiRef] = useState();
    const repairedTimeDefinitionRef = useRef();

    const [isDashboardMounted, setIsDashboardMounted] = useState(false);

    const [editedDefinition, setEditedDefinition] = useState(undefined);

    const [definitionInSourceEditor, setDefinitionInSourceEditor] = useState(null);

    const [validEditorJson, setValidEditorJson] = useState(true);

    const [unsavedDefinition, setUnsavedDefinition] = useState(false);

    const [dashboardHeightDifference, setDashboardHeightDifference] = useState('79');

    const [openCloneModal, setOpenCloneModal] = useState(false);

    const cloneModalToggle = useRef();
    const [openDashboardModal, setOpenDashboardModal] = useState(false);
    const [openConvertModal, setOpenConvertModal] = useState(false);
    const [openBackToManagerModal, setOpenBackToManagerModal] = useState(false);
    const [activeModeId, setActiveModeId] = useState('create');
    const [gridLayout, setGridLayout] = useState('absolute');
    const [dashboardTitle, setDashboardTitle] = useState('');
    const [selectedOpenDashboard, setSelectedOpenDashboard] = useState('');

    const [dashboards, setDashboards] = useState([]);
    const [currentDashboard, setCurrentDashboard] = useState(() =>
        toDashboardRecord(initialDashboard),
    );
    const dashboardColorScheme = normalizeDashboardTheme(
        currentDashboard?.theme,
        dashboardBuilderColorScheme,
    );
    const hasThemedPortalModal =
        openConvertModal || openBackToManagerModal || openDashboardModal;

    // Splunk React UI mounts modal backdrops in a portal outside the Dashboard
    // Studio root. Mark the document while one of our dialogs is open so the
    // portal uses the dashboard theme rather than the surrounding Splunk shell.
    useEffect(() => {
        const portalThemeClasses = [
            'dashboard-builder-modal-portal-light',
            'dashboard-builder-modal-portal-dark',
        ];
        const activePortalThemeClass = `dashboard-builder-modal-portal-${dashboardColorScheme}`;

        document.body.classList.remove(...portalThemeClasses);
        if (!hasThemedPortalModal) {
            return undefined;
        }

        document.body.classList.add(activePortalThemeClass);
        return () => document.body.classList.remove(activePortalThemeClass);
    }, [dashboardColorScheme, hasThemedPortalModal]);

    const editorTheme =
        dashboardColorScheme === 'dark' ? prismaDarkTheme : prismaLightTheme;
    const dashboardBuilderThemeStyle = {
        '--dashboard-builder-background-page': editorTheme.backgroundColorPage,
        '--dashboard-builder-background-section': editorTheme.backgroundColorSection,
        '--dashboard-builder-background-popup': editorTheme.backgroundColorPopup,
        '--dashboard-builder-background-sidebar': editorTheme.backgroundColorSidebar,
        '--dashboard-builder-content-active': editorTheme.contentColorActive,
        '--dashboard-builder-content-default': editorTheme.contentColorDefault,
        '--dashboard-builder-content-inverted': editorTheme.contentColorInverted,
        '--dashboard-builder-content-muted': editorTheme.contentColorMuted,
        '--dashboard-builder-border': editorTheme.borderColor,
        '--dashboard-builder-border-strong': editorTheme.borderColorStrong,
        '--dashboard-builder-border-weak': editorTheme.borderColorWeak,
        '--dashboard-builder-accent': editorTheme.interactiveColorPrimary,
        '--dashboard-builder-overlay-hover': editorTheme.interactiveColorOverlayHover,
        '--dashboard-builder-overlay-selected': editorTheme.interactiveColorOverlaySelected,
    };
    const dashboardBuilderModalThemeStyle = {
        '--dashboard-builder-modal-background': editorTheme.backgroundColorPopup,
        '--dashboard-builder-modal-background-section': editorTheme.backgroundColorSection,
        '--dashboard-builder-modal-content-active': editorTheme.contentColorActive,
        '--dashboard-builder-modal-content-default': editorTheme.contentColorDefault,
        '--dashboard-builder-modal-content-muted': editorTheme.contentColorMuted,
        '--dashboard-builder-modal-border': editorTheme.borderColor,
        '--dashboard-builder-modal-border-strong': editorTheme.borderColorStrong,
        '--dashboard-builder-modal-border-weak': editorTheme.borderColorWeak,
        '--dashboard-builder-modal-overlay-hover': editorTheme.interactiveColorOverlayHover,
        '--dashboard-builder-modal-overlay-selected': editorTheme.interactiveColorOverlaySelected,
    };
    const [dashID, setDashID] = useState(openID);
    const [dashMode, setDashMode] = useState(readOnly ? 'view' : openID ? 'edit' : 'view');
    const [serverInfo, setServerInfo] = useState();

    // This fix was provided by UDF team.
    delete self.requirejs;
    delete self.require;
    const mapTileConfig = { defaultTileConfig: testTileConfig };

    const { dashboardid, currentmode } = useParams();

    useEffect(() => {
        const activeDashboardTitle = getDefinitionTextValue(
            editedDefinition,
            'title',
            currentDashboard?.label || dashID || 'Dashboard Manager',
        );
        document.title = formatSasnDashboardTitle(activeDashboardTitle);
    }, [currentDashboard?.label, dashID, editedDefinition]);

    useEffect(() => {
        if (!openID && !readOnly) setDashMode(currentmode);
    }, [currentmode]);

    useEffect(() => {
        setDashID((prev) => {
            return openID ?? dashboardid;
        });
    }, [openID, dashboardid]);

    useEffect(() => {
        if (!skipDashboardListLoad) {
            getDashboards().then((response) => {
                if (response.status >= 200 && response.status <= 299) {
                    const insightDash = response.entry
                        .filter((c) => c.content.isDashboard && c.content.version == '2')
                        .map((r) => {
                            const { XMLParser } = require('fast-xml-parser');
                            const parser = new XMLParser({
                                ignoreAttributes: false,
                                attributeNamePrefix: '',
                            });
                            try {
                                let jObj = parser.parse(r.content['eai:data']);
                                const normalizedDefinition = jObj.dashboard.definition.replace(/\n/g, '');
                                const data = JSON.parse(
                                    normalizedDefinition.startsWith('{{')
                                        ? normalizedDefinition.replace(/^\{/, '')
                                        : normalizedDefinition,
                                );

                                return {
                                    data: r.content['eai:data'],
                                    definition: data,
                                    author: r.content['eai:userName'],
                                    app: r.content['eai:appName'],
                                    title: r.name,
                                    label: r.content['label'],
                                    tag: jObj.dashboard.tag || r.content['tag'] || '',
                                    theme: normalizeDashboardTheme(jObj.dashboard.theme),
                                    template: data.template ? data.template : false,
                                };
                            } catch (error) {
                                return undefined;
                            }
                        })
                        .filter((c) => c != undefined);

                    setDashboards(insightDash);
                    syncDashboardManagerNavigation(insightDash).catch((error) => {
                        console.warn('Unable to sync Dashboard Manager navigation.', error);
                    });
                } else {
                }
            });
        }

        if (!skipServerInfoLoad && !serverInfo) {
            getServerInfo().then((response) => {
                setServerInfo({
                    serverName: response.entry[0].content['serverName'],
                    isSplunkCloud: Object.keys(response.entry[0].content).includes('instance_type')
                        ? response.entry[0].content['instance_type'] != ''
                        : false,
                });
            });
        }
    }, [serverInfo, skipDashboardListLoad, skipServerInfoLoad]);

    useEffect(() => {
        if (initialDashboard) {
            setCurrentDashboard(toDashboardRecord(initialDashboard));
        }
    }, [initialDashboard]);

    useEffect(() => {
        if (!dashID && (openID || dashboardid)) return;
        if (initialDashboard) return;
        if (dashID == undefined) {
            setOpenDashboardModal(true);
        } else {
            getDashboard(dashID).then((response) => {
                if (response.status >= 200 && response.status <= 299) {
                    const { XMLParser } = require('fast-xml-parser');
                    const parser = new XMLParser({
                        ignoreAttributes: false,
                        attributeNamePrefix: '',
                    });
                    let jObj = parser.parse(response.entry[0].content['eai:data']);

                    try {
                        setEditedDefinition(
                            JSON.parse(
                                jObj.dashboard.definition.replace(/\n/g, '').startsWith('{{')
                                    ? jObj.dashboard.definition.replace(/\n/g, '').replace(/^\{\{/, '{')
                                    : jObj.dashboard.definition.replace(/\n/g, ''),
                            ),
                        );
                        setCurrentDashboard({
                            data: JSON.stringify(
                                JSON.parse(
                                    jObj.dashboard.definition.replace(/\n/g, '').startsWith('{{')
                                        ? jObj.dashboard.definition
                                              .replace(/\n/g, '')
                                              .replace(/^\{\{/, '{')
                                        : jObj.dashboard.definition.replace(/\n/g, ''),
                                ),
                            ),
                            author: response.entry[0].content['eai:userName'],
                            app: response.entry[0].content['eai:appName'],
                            title: response.entry[0].name,
                            label: response.entry[0].content['label'],
                            description: response.entry[0].content['description'],
                            tag: jObj.dashboard.tag || response.entry[0].content['tag'] || '',
                            theme: normalizeDashboardTheme(jObj.dashboard.theme),
                        });
                    } catch (e) {
                        console.error(e);
                    }
                } else {
                }
            });
        }
    }, [dashID, dashboardid, initialDashboard, openID]);

    const isDirty = useMemo(
        () => !isEqual(currentDashboard ? JSON.parse(currentDashboard.data) : {}, editedDefinition),
        [currentDashboard, editedDefinition],
    );
    const hasPendingDashboardChanges = isDirty || unsavedDefinition;

    const source = useMemo(() => {
        return editedDefinition;
    }, [editedDefinition]);

    const setSource = useCallback(
        (newSource) => {
            // set definition which is shown in sourceeditor
            setDefinitionInSourceEditor(newSource);
            if (!IsJsonString(newSource)) {
                // set flag to false and return
                setValidEditorJson(false);
                return;
            }
            setUnsavedDefinition(true);
            setValidEditorJson(true);
        },
        [setDefinitionInSourceEditor, setValidEditorJson],
    );

    const handleSaveClick = useCallback(() => {
        const saveDashboard = async () => {
            const definitionToSave = cloneDeep(editedDefinition);
            const dashboardLabel = getDefinitionTextValue(
                definitionToSave,
                'title',
                currentDashboard.label || dashID,
            );
            const dashboardDescription =
                typeof definitionToSave?.description === 'string'
                    ? definitionToSave.description
                    : currentDashboard.description || '';

            const response = await updateDash(
                dashID,
                JSON.stringify(definitionToSave, null, 4),
                currentDashboard.app,
                currentDashboard.author,
                dashboardDescription,
                dashboardLabel,
                currentDashboard.tag,
                dashboardColorScheme,
            );

            if (response.status >= 200 && response.status <= 299) {
                console.log(response);
                makeCreateToast(Toaster)({
                    message: `Dashboard saved successfully...`,
                    type: TOAST_TYPES.SUCCESS,
                });
                setUnsavedDefinition(false);
                setCurrentDashboard((prev) => {
                    let newDs = cloneDeep(prev);
                    newDs.data = JSON.stringify(definitionToSave);
                    newDs.label = dashboardLabel;
                    newDs.description = dashboardDescription;
                    return newDs;
                });
                if (onDashboardSaved) onDashboardSaved();
            } else {
                console.log(response);
                makeCreateToast(Toaster)({
                    message: `An error occurred while saving the dashboard. ${getSplunkResponseErrorMessage(
                        response,
                    )}`,
                    type: TOAST_TYPES.ERROR,
                });
            }
        };

        saveDashboard().catch((error) => {
            console.error(error);
            makeCreateToast(Toaster)({
                message: `An error occurred while saving the dashboard. ${getSafeErrorMessage(error)}`,
                type: TOAST_TYPES.ERROR,
            });
        });
    }, [
        currentDashboard,
        dashboardColorScheme,
        dashID,
        editedDefinition,
        onDashboardSaved,
    ]);

    const handleModeChange = useCallback(
        (newMode) => {
            if (readOnly) return;
            if (!embededMode) {
                const dashboardName = openID ?? dashboardid;
                if (!dashID) {
                    setDashID(openID ?? dashboardid);
                }

                if (newMode === 'edit') {
                    //setMode(newMode);
                    navigate(`/${dashboardName}/${newMode}`);
                } else {
                    navigate(`/${dashboardName}`);
                }
            } else {
                setDashMode(newMode);
            }

            if (newMode === 'view' && unsavedDefinition === true) {
                makeCreateToast({
                    type: TOAST_TYPES.WARNING,
                    message: 'This dashboard has unsaved changes.',
                    autoDismiss: true,
                    action: {
                        label: 'Save now',
                        callback: () => {
                            handleSaveClick();
                        },
                    },
                });
            }
        },
        [unsavedDefinition],
    );

    const returnToDashboardManager = useCallback(() => {
        setOpenBackToManagerModal(false);
        navigate('/');
    }, [navigate]);

    const handleBackToManagerClick = useCallback(() => {
        setOpenBackToManagerModal(true);
    }, []);

    const handleDefinitionChange = useCallback((newDefinition) => {
        if (serverInfo?.isSplunkCloud) {
            setEditedDefinition(newDefinition);
        } else if (
            isVersionLower(versionLabel, '15.0.0') &&
            newDefinition.layout.layoutDefinitions
        ) {
            if (newDefinition.layout.globalInputs && newDefinition.layout.options)
                setEditedDefinition((prev) => {
                    return {
                        ...newDefinition,
                        layout: {
                            ...Object.values(newDefinition.layout.layoutDefinitions)[0],
                            globalInputs: newDefinition.layout.globalInputs,
                            options: {
                                ...Object.values(newDefinition.layout.layoutDefinitions)[0].options,
                                ...newDefinition.layout.options,
                            },
                        },
                    };
                });
            else if (newDefinition.layout.options)
                setEditedDefinition((prev) => {
                    return {
                        ...newDefinition,
                        layout: {
                            ...Object.values(newDefinition.layout.layoutDefinitions)[0],
                            options: {
                                ...Object.values(newDefinition.layout.layoutDefinitions)[0].options,
                                ...newDefinition.layout.options,
                            },
                        },
                    };
                });
            else if (newDefinition.layout.globalInputs)
                setEditedDefinition((prev) => {
                    return {
                        ...newDefinition,
                        layout: {
                            ...Object.values(newDefinition.layout.layoutDefinitions)[0],
                            globalInputs: newDefinition.layout.globalInputs,
                        },
                    };
                });
            else
                setEditedDefinition({
                    ...newDefinition,
                    layout: Object.values(newDefinition.layout.layoutDefinitions)[0],
                });
        } else setEditedDefinition(newDefinition);
        setUnsavedDefinition(true);
    }, []);

    const handleEnterSourceMode = useCallback(() => {
        setDefinitionInSourceEditor(formatJSON(JSON.stringify(editedDefinition)));
        setIsCodeEditable(true);
    }, [editedDefinition, setDefinitionInSourceEditor, setIsCodeEditable]);

    const handleExitSourceMode = useCallback(() => {
        /*if (!validEditorJson) {
            // show Error toast if definition in sourceEditor is invalid.

            makeCreateToast(Toaster)({
                message: 'Invalid JSON, Please enter valid',
                type: TOAST_TYPES.ERROR,
            });
            return;
        }

        // close SourceEditor only if definitionInSourceEditor is valid
        setEditedDefinition(JSON.parse(definitionInSourceEditor)); // set definitionInSourceEditor in definition*/
        setIsCodeEditable(false);
    }, [validEditorJson, definitionInSourceEditor, setEditedDefinition, setIsCodeEditable]);

    const iconRegistry = useMemo(() => createSEIIconRegistry(), []);

    useEffect(() => {
        // Handler to call on window resize
        const handleResize = () => {
            const dashboardPosition = document
                .querySelector('div[role="main"]')
                ?.getBoundingClientRect();
            if (dashboardPosition && dashboardPosition?.y) {
                setDashboardHeightDifference(`${parseInt(dashboardPosition.y, 10)}`);
            }
        };

        // Add event listener
        window.addEventListener('resize', handleResize);
        // Call handler right away so state gets updated with initial window size
        handleResize();
        // Remove event listener on cleanup
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const { dashboardCoreApi, setDashboardCoreApi } = useDashboardStore();
    useEffect(() => {
        if (isDashboardMounted && tokens?.default && dashboardApiElem?.current?.setTokenBindings) {
            const tokenModel = {
                tokenBindings: tokens.default,
                namespace: 'default',
            };
            // updating token
            dashboardApiElem.current.setTokenBindings(tokenModel);
        }
    }, [tokens, dashboardApiElem]);

    useEffect(() => {
        if (dashboardCoreApi == null && apiRef) setDashboardCoreApi(apiRef);
    }, [apiRef]);

    useEffect(() => {
        const dashboardApi = dashboardApiElem.current ?? apiRef;
        const definition = dashboardApi?.getDefinition?.();

        if (!definition) {
            return;
        }

        const repairedDefinition = repairSearchbaseTimeQueryParameters(definition);
        if (repairedDefinition === definition || repairedTimeDefinitionRef.current === definition) {
            return;
        }

        repairedTimeDefinitionRef.current = repairedDefinition;
        dashboardApi.updateDefinition?.(repairedDefinition);
    }, [apiRef, isDashboardMounted]);

    const toggleButton = (
        <Button data-test="clone-dashboard-toolbar-button" label={_('Actions')} isMenu />
    );

    useEffect(() => {
        if (currentDashboard && currentDashboard.data) {
            setEditedDefinition(JSON.parse(currentDashboard.data));
        }
    }, [currentDashboard]);

    const toolbarMenus = useMemo(
        () => ({
            viewReadOnly: [],
            view: [
                <ControlGroup key="controlGroup" />,

                <ItemGroup key="sideToolbar" align="right">
                    <ExportDashboardButton key="export-dashboard" />
                    <ModeSwitch key="modeSwitch" />
                </ItemGroup>,
            ],
            edit: [
                <HistoryGroup key="historyGroup" />,
                <VisualizationGroup key="visualization" />,
                <SidebarControlGroup key="sidebarControlGroup" />,
                <EditorGroup key="editorGroup" sourceButtonOnClick={handleEnterSourceMode} />,
                <ItemGroup key="customExtensionToolbar" borders={false}>
                    <span
                        className="dashboardbuilder-custom-toolbar-separator"
                        aria-hidden="true"
                    />
                    <BackgroundButton key="backgroundButton" iconColor="#26afac" />
                    <InsightKpiButton key="insightKpi" />
                    {ENABLE_EXPERIMENTAL_SPACE_MANAGER && (
                        <SpaceManagerButton key="spaceManager" />
                    )}
                </ItemGroup>,
                <ItemGroup key="sideToolbar" align="right" borders={false}>
                    <ModeSwitch key="modeSwitch" />
                    <SaveButton key="save" onClick={handleSaveClick} isDirty={isDirty} />
                    {showClose && (
                        <Tooltip
                            key="backToManagerTooltip"
                            content="Return to Dashboard Manager"
                        >
                            <Button
                                style={{ marginLeft: 5 }}
                                label="Back to Manager"
                                appearance="default"
                                aria-label="Back to Manager"
                                onClick={handleBackToManagerClick}
                            ></Button>
                        </Tooltip>
                    )}
                </ItemGroup>,
            ],
            editconvert: [
                <HistoryGroup key="historyGroup" />,
                <VisualizationGroup key="visualization" />,
                <SidebarControlGroup key="sidebarControlGroup" />,
                <EditorGroup key="editorGroup" sourceButtonOnClick={handleEnterSourceMode} />,
                <ItemGroup key="customExtensionToolbar" borders={false}>
                    <span
                        className="dashboardbuilder-custom-toolbar-separator"
                        aria-hidden="true"
                    />
                    <BackgroundButton key="backgroundButton" iconColor="#26afac" />
                    <InsightKpiButton key="insightKpi" />
                    {ENABLE_EXPERIMENTAL_SPACE_MANAGER && (
                        <SpaceManagerButton key="spaceManager" />
                    )}
                </ItemGroup>,
                <ItemGroup key="sideToolbar" align="right" borders={false}>
                    <Button
                        style={{ marginRight: 10 }}
                        label="Convert"
                        onClick={() => setOpenConvertModal(true)}
                    ></Button>
                    <ModeSwitch key="modeSwitch" />
                    <SaveButton key="save" onClick={handleSaveClick} isDirty={isDirty} />
                    <Tooltip key="backToManagerTooltip" content="Return to Dashboard Manager">
                        <Button
                            style={{ marginLeft: 5 }}
                            label="Back to Manager"
                            appearance="default"
                            aria-label="Back to Manager"
                            onClick={handleBackToManagerClick}
                        ></Button>
                    </Tooltip>
                </ItemGroup>,
            ],
        }),
        [
            currentDashboard,
            editedDefinition,
            handleBackToManagerClick,
            handleEnterSourceMode,
            handleSaveClick,
            isDirty,
            setIsCodeEditable,
            showClose,
        ],
    );

    /*
      Action menu buttons
    */
    const actionMenus = useMemo(
        () => ({
            view: actionMenusOptions.view,
            edit: actionMenusOptions.edit,
        }),
        [],
    );

    const handleDashboardInitialization = useCallback(() => {
        setIsDashboardMounted(true);
    }, []);

    const handleDashboardEvent = useCallback(
        (lifecycleEvent) => {
            onDashboardEvent(lifecycleEvent, true);
        },
        [onDashboardEvent],
    );

    const dashboardCorePlugin = {
        onInitialize: handleDashboardInitialization,
        onEventTrigger: handleDashboardEvent,
    };

    useEffect(() => {
        if (
            typeof onSearchStatusChange !== 'function' ||
            !embededMode ||
            !readOnly ||
            !isDashboardMounted ||
            !(dashboardApiElem.current ?? apiRef)
        ) {
            return undefined;
        }

        let isDisposed = false;
        const discoveryStartedAt = Date.now();
        const subscriptions = new Map();
        const searchStatuses = new Map();
        const trackedDataSourceIds = new Set();

        const emitSearchStatus = () => {
            if (isDisposed) {
                return;
            }

            const statuses = Array.from(searchStatuses.values());
            const hasError = statuses.some((status) => Boolean(status.error));
            const pendingStatuses = statuses.filter((status) => !status.isDone && !status.error);
            const unresolvedDataSourceIds = Array.from(trackedDataSourceIds).filter(
                (dataSourceId) => !searchStatuses.has(dataSourceId),
            );
            const isDiscovering =
                unresolvedDataSourceIds.length > 0 &&
                Date.now() - discoveryStartedAt < EXPORT_SEARCH_DISCOVERY_GRACE_MS;

            onSearchStatusChange({
                hasError,
                isDiscovering,
                isReady:
                    !isDiscovering &&
                    (statuses.length === 0 || (!hasError && pendingStatuses.length === 0)),
                attachedCount: statuses.length,
                pendingCount: pendingStatuses.length,
                statuses,
                unresolvedDataSourceIds,
            });
        };

        const attachSearchSubscriptions = () => {
            const dashboardApi = dashboardApiElem.current ?? apiRef;
            const dataSourceRegistry = getDashboardDataSourceRegistry(dashboardApi);
            const dataSourceEntries = Object.entries(
                dataSourceRegistry?.definition ?? dashboardApi?.getDefinition?.().dataSources ?? {},
            ).filter(([, dataSource]) => EXPORT_TRACKED_DATA_SOURCE_TYPES.has(dataSource.type));

            trackedDataSourceIds.clear();
            dataSourceEntries.forEach(([dataSourceId]) => trackedDataSourceIds.add(dataSourceId));

            if (dataSourceEntries.length === 0) {
                onSearchStatusChange({
                    hasError: false,
                    isDiscovering: false,
                    isReady: true,
                    attachedCount: 0,
                    pendingCount: 0,
                    statuses: [],
                    unresolvedDataSourceIds: [],
                });
                return;
            }

            dataSourceEntries.forEach(([dataSourceId, dataSource]) => {
                if (subscriptions.has(dataSourceId)) {
                    return;
                }

                const controller = dataSourceRegistry?.getDataSourceController?.(dataSourceId);
                const searchJob = getControllerSearchJob(controller);

                if (!searchJob?.getProgress) {
                    return;
                }

                const subscription = searchJob.getProgress().subscribe({
                    next: (progress) => {
                        searchStatuses.set(dataSourceId, {
                            dataSourceId,
                            error: undefined,
                            type: dataSource.type,
                            ...getSearchProgressStatus(progress),
                        });
                        emitSearchStatus();
                    },
                    error: (error) => {
                        searchStatuses.set(dataSourceId, {
                            dataSourceId,
                            dispatchState: 'error',
                            error: getSafeErrorMessage(
                                error,
                                'Failed to read dashboard search progress.',
                            ),
                            isDone: false,
                            resultCount: 0,
                            sid: undefined,
                            type: dataSource.type,
                        });
                        emitSearchStatus();
                    },
                });

                subscriptions.set(dataSourceId, subscription);
            });

            emitSearchStatus();
        };

        // kh 2026-05-16 17:29:17 EDT: Embedded export consumers now receive live search-job progress so exports can wait for real search completion instead of DOM-only stability.
        attachSearchSubscriptions();
        const attachInterval = window.setInterval(attachSearchSubscriptions, 500);

        return () => {
            isDisposed = true;
            window.clearInterval(attachInterval);
            subscriptions.forEach((subscription) => subscription.unsubscribe());
        };
    }, [apiRef, embededMode, isDashboardMounted, onSearchStatusChange, readOnly]);

    const embeddedDashboardHeight = embededMode ? '100%' : '1200';

    const sourceEditorPanel = useMemo(() => {
        return isCodeEditable ? (
            <DashboardSourceEditor
                key="DashboardStudioEditor"
                title={editedDefinition.title}
                height="1200" //{`calc(100vh - ${dashboardHeightDifference}px)`}
                width="100%"
                onSourceChange={setSource}
                onExit={handleExitSourceMode}
            />
        ) : null;
    }, [
        isCodeEditable,
        editedDefinition,
        definitionInSourceEditor,
        setSource,
        handleExitSourceMode,
    ]);

    const handlePageLeave = useCallback(
        (e) => {
            if (!dashID) return true;
            if (confirmLeaveDirtyPage && isDirty) {
                // Cancel the event
                e.preventDefault();
                // Chrome requires returnValue to be set
                const msg = 'Leave Dashboard Builder without saving?';
                e.returnValue = msg;
                return msg;
            }

            return true;
        },
        [isDirty, confirmLeaveDirtyPage],
    );

    useEffect(() => {
        window.addEventListener('beforeunload', handlePageLeave);
        return () => {
            window.removeEventListener('beforeunload', handlePageLeave);
        };
    }, [handlePageLeave]);

    const additionalSidebars = {
        searchbaseChooser: {
            title: _('Select a searchbase search'),
            key: 'searchbase-search-selector',
            panel: SelectSearchbaseSearchSidebar,
            requiredSelectedViz: false,
            enableCloseButton: false,
        },
    };

    const uiEditorPanel = useMemo(() => {
        return isCodeEditable ? null : (
            <div>
                <Dashboard
                    key="DashboardStudioEditorUi"
                    width="100%"
                    height={embeddedDashboardHeight}
                    toolbarItems={
                        readOnly
                            ? []
                            : toolbarMenus[
                                  dashMode
	                                      ? dashboardApiElem.current
	                                          ? Object.values(
	                                                dashboardApiElem.current.getDefinition()
	                                                    .dataSources,
	                                            ).some((ds) => ds.type === 'ds.searchbase')
	                                              ? `editconvert`
	                                              : dashMode
	                                          : dashMode
	                                      : 'view'
	                              ]
                    }
                    actionMenus={actionMenus[dashMode ? dashMode : 'view']}
                    dashboardApiRef={(apiRef) => {
                        dashboardApiElem.current = apiRef; // referencing dashboardApi
                        //if (dashboardCoreApi == null) setDashboardCoreApi(apiRef);
                        setApiRef(apiRef);
                    }}
                    visualizationEditors={
                        {
                            /*'splunk.template_kpi': templateVizEditor,
                        'splunk.template_other': templateVizEditor,*/
                        }
                    }
                    dataSourceEditors={{
                        ...DataSourceEditors,
                        'ds.searchbase': SearchbaseDataSourceEditor,
                    }}
                    sidebars={additionalSidebars}
                    dataSourcesPanel={SearchBaseDataSourcePanel}
                />
            </div>
        );
    }, [
        isCodeEditable,
        dashMode,
        handleModeChange,
        handleDefinitionChange,
        toolbarMenus,
        tokens,
        source,
        actionMenus,
        dashboardCorePlugin,
    ]);

    const handleRequestClickAway = ({ reason }) => {
        if (reason === 'escapeKey') {
            setOpenDashboardModal(false);
        }
    };

    const handleOpenClick = () => {
        if (activeModeId == 'create') {
            // create a new dashboard and then open it

            const dashid = `scd_${dashboardTitle.replaceAll(' ', '_').replaceAll('#', '')}`;
            let jsonDefinition = cloneDeep(initialDefinition);
            jsonDefinition.title = dashboardTitle;
            jsonDefinition.layout.type = gridLayout;

            addDash(dashid, JSON.stringify(jsonDefinition), dashboardTitle).then((response) => {
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
                        console.warn('Unable to sync Dashboard Manager navigation.', error);
                    });
                    setOpenDashboardModal(false);
                    setTimeout(() => {
                        //navigate(`/${dashid}/edit`, { replace: true });
                        window.open(
                            `/app/splunk-cisco-dashboards/dashboardbuilder#/${dashid}/edit`,
                            '_self',
                        );
                    }, 500);
                } else {
                    console.log(response);
                    makeCreateToast(Toaster)({
                        message: `An error occurred while creating the new dashboard. ${getSplunkResponseErrorMessage(
                            response,
                        )}`,
                        type: TOAST_TYPES.ERROR,
                    });
                }
            });
        } else {
            // open existing dashboard
            setOpenDashboardModal(false);
            window.open(
                `/app/splunk-cisco-dashboards/dashboardbuilder#/${selectedOpenDashboard}/edit`,
                '_self',
            );
            //navigate(`/${selectedOpenDashboard}/edit`, { replace: true });
        }
    };

    const convertDashboard = async () => {
        try {
            const { definition: def } = await resolveSearchbaseDefinitionForNativeStudio(
                dashboardApiElem.current.getDefinition(),
            );

            dashboardApiElem.current.updateDefinition(def);

            setOpenConvertModal(false);
            makeCreateToast(Toaster)({
                message: `The dashboard has been migrated, and all custom items have been converted to standard Splunk Studio items. Please review the changes and save the dashboard to apply them.`,
                type: TOAST_TYPES.SUCCESS,
            });
        } catch (error) {
            console.error(error);
            makeCreateToast(Toaster)({
                message: `An error occurred while converting the dashboard. ${getSafeErrorMessage(error)}`,
                type: TOAST_TYPES.ERROR,
            });
        }
    };

    const goBackOrClose = () => {
        if (window.history.length > 1) {
            window.history.back();
        } else {
            window.close();
        }
    };

    useEffect(() => {
        const usesDarkSurface = (element) => {
            let ancestor = element.parentElement;

            while (ancestor) {
                const background = window.getComputedStyle(ancestor).backgroundColor;
                const values = background.match(
                    /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
                );
                const opacity = values?.[4] == null ? 1 : Number(values[4]);

                if (values && opacity > 0) {
                    const [, red, green, blue] = values;
                    return (
                        Number(red) * 0.2126 +
                            Number(green) * 0.7152 +
                            Number(blue) * 0.0722 <
                        140
                    );
                }

                ancestor = ancestor.parentElement;
            }

            return false;
        };

        const replaceGenericEmptyState = (root = document) => {
            const elements = [
                ...(root instanceof Element ? [root] : []),
                ...root.querySelectorAll('*'),
            ];

            elements.forEach((element) => {
                if (
                    element.children.length > 0 ||
                    element.dataset.scdContextualEmptyState === 'true' ||
                    element.textContent?.trim() !== 'No search results returned'
                ) {
                    return;
                }

                element.textContent =
                    'No matching telemetry was found in the selected time range. The condition this panel detects may not have occurred; confirm its data source is onboarded, or widen the time range.';
                element.style.setProperty(
                    'color',
                    usesDarkSurface(element) ? '#e2e8f0' : '#334155',
                    'important',
                );
                element.style.lineHeight = '1.4';
                element.style.maxWidth = '32rem';
                element.setAttribute('aria-label', 'No matching telemetry was found');
                element.dataset.scdContextualEmptyState = 'true';
            });
        };

        replaceGenericEmptyState();
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target instanceof Element) {
                    replaceGenericEmptyState(mutation.target);
                }
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        replaceGenericEmptyState(node);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    return (
        <>
            <ToastMessages />
            <SplunkThemeProvider
                family="prisma"
                density="comfortable"
                colorScheme={dashboardColorScheme}
            >
            <Modal
                open={openConvertModal}
                className={`dashboard-builder-themed-modal dashboard-builder-themed-modal-${dashboardColorScheme}`}
                style={{ width: '600px', ...dashboardBuilderModalThemeStyle }}
            >
                <Modal.Header title="Convert dashboard definition" icon={<Cog width="30px" />} />
                <Modal.Body>
                    This dashboard contains custom data sources that work{' '}
                    <b>exclusively within the Cisco dashboards application context.</b> <br />
                    These custom data sources ensure a{' '}
                    <b>seamless and transparent synchronization</b> with the search SPL definitions
                    defined in the search base, eliminating the need for manual synchronization.
                    <br />
                    However, if you want this dashboard to function in Dashboard Studio without
                    custom data sources, you can click "Convert" button to standardize its
                    definition. Once converted, you will be able to open it in Dashboard Studio from
                    any context,{' '}
                    <b>
                        but you will lose automatic synchronization with the search base
                        definitions.
                    </b>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        appearance="default"
                        label="Cancel"
                        onClick={() => setOpenConvertModal(false)}
                    />
                    <Button appearance="primary" label="Convert" onClick={convertDashboard} />
                </Modal.Footer>
            </Modal>
            <Modal
                open={openBackToManagerModal}
                className={`dashboard-builder-themed-modal dashboard-builder-themed-modal-${dashboardColorScheme}`}
                style={{ width: '460px', ...dashboardBuilderModalThemeStyle }}
                onRequestClose={() => setOpenBackToManagerModal(false)}
            >
                <Modal.Header title="Back to Dashboard Manager?" />
                <Modal.Body>
                    {hasPendingDashboardChanges
                        ? 'This will return you to Dashboard Manager. Unsaved changes may be lost.'
                        : 'This will return you to Dashboard Manager.'}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        appearance="secondary"
                        label="Stay"
                        onClick={() => setOpenBackToManagerModal(false)}
                    />
                    <Button
                        appearance="destructive"
                        label="Back to Manager"
                        onClick={returnToDashboardManager}
                    />
                </Modal.Footer>
            </Modal>
            <Modal
                open={openDashboardModal}
                className={`dashboard-builder-themed-modal dashboard-builder-themed-modal-${dashboardColorScheme}`}
                style={{ width: '700px', ...dashboardBuilderModalThemeStyle }}
                onRequestClose={goBackOrClose}
            >
                <Modal.Header
                    title="Cisco Dashboard Builder"
                    subtitle="Create a new dashboard or select an existing one to edit..."
                    icon={<FileCharts width="30px" style={{ width: 30 }} />}
                />

                <Modal.Body style={{ padding: 0 }}>
                    <TabLayout
                        className="dashboard-builder-tablayout"
                        defaultActivePanelId="create"
                        onChange={(e, { activePanelId: panelId }) => {
                            setActiveModeId(panelId);
                        }}
                        style={{ marginLeft: 10, marginRight: 10, marginTop: 10 }}
                    >
                        <TabLayout.Panel label="Create New" panelId="create" icon={<Plus></Plus>}>
                            <SplunkControlGroup label="Dashboard Title">
                                <Text
                                    value={dashboardTitle}
                                    error={dashboardTitle == ''}
                                    onChange={(e, { value }) => {
                                        setDashboardTitle(value);
                                    }}
                                />
                            </SplunkControlGroup>
                            <SplunkControlGroup
                                label="Layout Mode"
                                style={{ marginTop: 60 }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Card
                                        onClick={() => {
                                            setGridLayout('absolute');
                                        }}
                                        selected={gridLayout == 'absolute'}
                                        style={{
                                            marginRight: 10,
                                            borderRadius: 4,
                                            maxHeight: 130,
                                        }}
                                    >
                                        <Card.Body style={{ padding: 10 }}>
                                            <div
                                                style={{
                                                    width: 150,
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                }}
                                            >
                                                <div>
                                                    <b>Absolute</b>
                                                    <p
                                                        style={{
                                                            fontSize: 12,
                                                            marginTop: 0,
                                                        }}
                                                    >
                                                        Full layout control
                                                    </p>
                                                </div>
                                                <AbsolutSVG></AbsolutSVG>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                    <Card
                                        onClick={() => {
                                            setGridLayout('grid');
                                        }}
                                        selected={gridLayout == 'grid'}
                                        style={{
                                            marginLeft: 10,
                                            borderRadius: 4,
                                            maxHeight: 130,
                                        }}
                                    >
                                        <Card.Body style={{ padding: 10 }}>
                                            <div
                                                style={{
                                                    width: 150,
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                }}
                                            >
                                                <div>
                                                    <b>Grid</b>
                                                    <p
                                                        style={{
                                                            fontSize: 12,
                                                            marginTop: 0,
                                                        }}
                                                    >
                                                        Quick organization
                                                    </p>
                                                </div>
                                                <GridSVG></GridSVG>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                </div>
                            </SplunkControlGroup>
                        </TabLayout.Panel>
                        <TabLayout.Panel
                            label="Edit Existing"
                            panelId="open"
                            icon={<PencilUnderline></PencilUnderline>}
                        >
                            <SplunkControlGroup label="Dashboard Title">
                                <Select
                                    value={selectedOpenDashboard}
                                    error={selectedOpenDashboard == ''}
                                    onChange={(e, { value }) => {
                                        setSelectedOpenDashboard(value);
                                    }}
                                    filter
                                >
                                    {dashboards
                                        .filter((c) => c.template == false)
                                        .map((dashboard) => (
                                            <Select.Option
                                                value={dashboard.title}
                                                label={dashboard.label}
                                            ></Select.Option>
                                        ))}
                                </Select>
                            </SplunkControlGroup>
                        </TabLayout.Panel>
                    </TabLayout>
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        appearance="primary"
                        label={activeModeId == 'create' ? 'Create' : 'Open'}
                        disabled={
                            (activeModeId == 'create' && dashboardTitle == '') ||
                            (activeModeId == 'open' && selectedOpenDashboard == '')
                        }
                        onClick={handleOpenClick}
                    />

                    <Button appearance="secondary" label="Cancel" onClick={goBackOrClose} />
                </Modal.Footer>
            </Modal>
            </SplunkThemeProvider>
            {currentDashboard == undefined ? (
                <></>
            ) : (
                <div
                    className={
                        serverInfo?.isSplunkCloud
                            ? `dashboardbuilderview dashboardbuilderview-${dashboardColorScheme}`
                            : isVersionLower(versionLabel, '9.4.0')
                              ? `dashboardbuilderview dashboardbuilderview-${dashboardColorScheme} hidetabs`
                              : `dashboardbuilderview dashboardbuilderview-${dashboardColorScheme}`
                    }
                    style={{ minHeight: '100%', ...dashboardBuilderThemeStyle }}
                    id="collection_container"
                >
                    <SplunkThemeProvider
                        family="prisma"
                        density="comfortable"
                        colorScheme={dashboardColorScheme}
                    >
                        <DashboardContextProvider
                            key="DashboardStudioEditorContext"
                            iconRegistry={iconRegistry}
                            featureFlags={featureFlags}
                            timezone={timezone}
                            preset={preset}
                            mapTileConfig={mapTileConfig}
                            initialDefinition={JSON.parse(currentDashboard.data)} // definition with attached handler
                            onDefinitionChange={handleDefinitionChange}
                            initialMode={dashMode ? dashMode : 'view'}
                            initialTokenBinding={tokens} // takes initial token
                            onModeChange={handleModeChange}
                            dashboardPlugin={dashboardCorePlugin}
                            eventsConfig={{
                                eventActions: eventActions,
                                fieldActions: fieldActions,
                                isSplunkWebAvailable: true,
                            }}
                        >
                            {sourceEditorPanel}
                            {uiEditorPanel}
                        </DashboardContextProvider>
                    </SplunkThemeProvider>
                </div>
            )}
        </>
    );
};

DashboardStudioEditor.defaultProps = {
    onDashboardEvent: (event) => {
        if (event.type === 'cell.click') {
            if (event.payload) {
                if (event.payload['row._search.value']) {
                    window.open(
                        `/app/splunk-cisco-dashboards/search?q=${encodeURIComponent(
                            event.payload['row._search.value'],
                        )}&earliest=-7d%40h&latest=now`,
                        '_blank',
                    );
                }
            }
        }
    },
    dashboardMode: 'view',
    confirmLeaveDirtyPage: true,
    tokens: {
        default: {},
    },
    actionMenus: actions,
    onSearchStatusChange: undefined,
};

DashboardStudioEditor.propTypes = {
    onDashboardEvent: PropTypes.func,
    definition: PropTypes.shape({
        title: PropTypes.string.isRequired,
        layout: PropTypes.shape().isRequired,
        visualizations: PropTypes.shape().isRequired,
        dataSources: PropTypes.shape().isRequired,
        inputs: PropTypes.shape().isRequired,
    }).isRequired,
    dashboardMode: PropTypes.string,
    confirmLeaveDirtyPage: PropTypes.bool,
    tokens: PropTypes.shape({
        default: PropTypes.shape(),
    }),
    actionMenus: PropTypes.arrayOf(PropTypes.node.isRequired),
    onSearchStatusChange: PropTypes.func,
    pageName: PropTypes.string.isRequired,
    //hasCloneSharingPermission: PropTypes.bool.isRequired,
};

export default DashboardStudioEditor;
