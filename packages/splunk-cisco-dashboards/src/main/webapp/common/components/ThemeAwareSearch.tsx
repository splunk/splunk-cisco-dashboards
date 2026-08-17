import Search from '@splunk/react-ui/Search';
import { variables } from '@splunk/themes';
import styled from 'styled-components';

/**
 * SUI Search with the legacy Splunk Web input background neutralized.
 *
 * Splunk Web still applies a global white background to search inputs. The
 * extra specificity keeps the native SUI surface in control in both Prisma
 * color schemes without introducing a dashboard-specific color.
 */
const ThemeAwareSearch = styled(Search)`
    display: block;
    width: 100%;

    && input[role='searchbox'] {
        background-color: ${variables.transparent};
    }
`;

export default ThemeAwareSearch;
