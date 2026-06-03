import { PaddedContainer } from '@splunk/dashboard-ui';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Divider from '@splunk/react-ui/Divider';
import Message from '@splunk/react-ui/Message';
import RadioBar from '@splunk/react-ui/RadioBar';
import Scroll from '@splunk/react-ui/Scroll';
import Search from '@splunk/react-ui/Search';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import { variables } from '@splunk/themes';
import styled from 'styled-components';

export const StyledControlGroup = styled(ControlGroup)`
    label {
        font-weight: ${variables.fontWeightNormal};
        font-size: ${variables.fontSize};
        padding: 0;
    }
    width: 100%;
    margin: 0;
`;

export const StyledDivider = styled(Divider)`
    margin: 10px 0;
`;

export const StyledEmptyMessage = styled(Message)`
    width: 100%;
`;

export const StyledEmptySavedSearchMessage = styled(PaddedContainer)`
    display: flex;
    align-items: center;
    justify-content: center;
`;

export const StyledLoadingSpinner = styled(WaitSpinner)`
    display: flex;
    align-items: center;
    justify-content: center;
    height: ${(props: { moveToCenter: boolean }) => (props.moveToCenter ? '100%' : '26px')};
    overflow: hidden;
`;

export const StyledRadioBar = styled(RadioBar)`
    width: 100%;
`;

export const StyledScroll = styled(Scroll)`
    overflow: auto;
    &&& {
        span {
            overflow-x: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        button {
            padding-left: 20px;
        }
    }
    flex-grow: 1;
    width: 100%;
`;

export const StyledSearch = styled(Search)`
    width: 100%;
`;

export const StyledListBox = styled.div`
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 200px;
`;

export const StyledOptionsContainer = styled.div`
    display: flex;
    flex-direction: column;
    top: 0px;
`;

export const StyledSidebarPanel = styled.div`
    position: absolute;
    top: 0px;
    bottom: 0px;
    left: 0px;
    right: 0px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: ${variables.contentColorDefault};
`;

export const StyledMenuContainer = styled.div`
    display: flex;
    justify-content: space-around;
    position: sticky;
    bottom: 0px;
`;

export const StyledPanel = styled.div`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    overflow: auto;
`;

export const StyledPaddedContainer = styled(PaddedContainer)`
    display: flex;
    flex-direction: column;
    position: sticky;
    top: 0px;
`;
