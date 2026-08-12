import styled from 'styled-components';
import Tooltip from '@splunk/react-ui/Tooltip';
import Text from '@splunk/react-ui/Text';
import Message from '@splunk/react-ui/Message';
import FormRows from '@splunk/react-ui/FormRows';
import { pick, variables } from '@splunk/themes';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import ControlGroup from '@splunk/react-ui/ControlGroup';

/** Insight KPIs styles */
export const Loading = styled(WaitSpinner)`
    align-items: center;
    justify-content: center;
    display: flex;
    height: 60px;
`;

export const KIPanel = styled.li`
    float: left;
    list-style: none;
    margin: 10px;
    margin-top: 8px;
    max-width: 250px;
`;

export const KITitle = styled.div`
    font-size: 14px;
    font-weight: 600;
    color: ${pick({
        enterprise: {
            light: variables.textColor,
            dark: variables.textColor,
        },
        prisma: variables.contentColorActive,
    })};
    white-space: nowrap;
    line-height: 16px;
`;

export const KISubTitle = styled.div`
    font-size: 12px;
    color: ${pick({
        enterprise: {
            light: variables.textColor,
            dark: variables.textColor,
        },
        prisma: variables.contentColorActive,
    })};
    line-height: 16px;
    min-height: 16px;
`;

export const SingleValueContainer = styled.div`
    display: flex;
    position: relative;
    [data-test='overflowWrapper'] {
        justify-content: left;
        padding: 0;
        &::before,
        &::after {
            background: none;
            width: 0px;
        }
        > div div:nth-child(2) {
            justify-content: left;
        }
    }
    [data-test='visualization-message'] [data-test='content'] {
        font-size: 12px;
    }
`;

export const ErrorTooltip = styled(Tooltip)`
    position: absolute;
    right: 0;
    bottom: 0;
`;

/** KeyIndicatorError styles */
export const ErrorMessage = styled.p`
    color: ${pick({
        enterprise: {
            light: variables.textColor,
            dark: variables.textColor,
        },
        prisma: variables.contentColorActive,
    })};
    margin: 5px 0;
`;

export const LinkToNewPage = styled.a`
    line-height: 14px;
    display: block;
    color: ${pick({
        enterprise: variables.linkColor,
        prisma: variables.interactiveColorAccent,
    })};
`;

export const KeyIndicatorErrorWrapper = styled.div`
    overflow-y: auto;
    height: 60px;
`;

/** InsightKpiViz styles */
export const KIVizContainer = styled.div`
    height: 100%;
    overflow: auto;
    background-color: ${pick({
        enterprise: {
            light: variables.backgroundColor,
            dark: variables.black,
        },
        prisma: variables.backgroundColorSidebar,
    })};
`;

export const KIHeading = styled.h2`
    font-size: 14px;
    font-weight: 600;
    padding: 6px 10px;
    margin: 0;
    color: ${pick({
        enterprise: {
            light: variables.textColor,
            dark: variables.textColor,
        },
        prisma: variables.contentColorActive,
    })};
`;

export const KIWrapper = styled.ul`
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    > li + li {
        padding-left: 10px;
        border-left: 2px solid
            ${pick({
                enterprise: {
                    light: variables.borderColor,
                    dark: variables.borderColor,
                },
                prisma: variables.neutral400,
            })};
    }
`;

export const KIErrorMsg = styled.span`
    font-size: 12px;
    padding: 10px;
`;

/** InsightKpiEditor styles */
export const KeyIndicatorLabel = styled.div`
    height: 32px;
    line-height: 32px;
    padding-left: 5px;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
`;

export const StyledControlGroup = styled(ControlGroup)`
    margin-bottom: 8px;
    width: 100%;
    padding-left: 15px;
    padding-right: 15px;
`;

export const StyledThresholdControlGroup = styled(ControlGroup)`
    margin-bottom: 0px;
    padding-left: 5px;

    div:first-child {
        width: 70px !important;
        justify-content: flex-start;

        label {
            text-align: left;
            margin-bottom: 0;
        }
    }

    [data-test='controls'] {
        margin-left: 70px !important;
    }

    &[aria-invalid='true'] {
        [data-test='controls'] {
            > div,
            > div > span {
                margin-bottom: 0;
            }
        }
    }

    [data-test='help'] {
        margin-left: 75px !important;
    }
`;

export const ThresholdInput = styled(Text)`
    margin-bottom: 5px;
    padding-left: 5px;
    &[data-inline] {
        width: 150px;
    }
`;

export const EditorErrorMessage = styled(Message)`
    padding-right: 15px;
    word-break: break-word;
    span {
        margin-left: 15px;
    }
    div {
        display: inline-block;
        padding-left: 5px;
    }
`;

export const SortableFormRow = styled(FormRows)`
    padding: 10px 15px !important;

    [data-test='drag-handle'] {
        inset: 4px 0px 3px;
        height: initial;
    }
`;
