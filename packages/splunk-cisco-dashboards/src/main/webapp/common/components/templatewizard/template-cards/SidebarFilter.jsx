import React from 'react';
import Multiselect from '@splunk/react-ui/Multiselect';
import P from '@splunk/react-ui/Paragraph';
import Typography from '@splunk/react-ui/Typography';

function SidebarFilter({ availableTags, selectedTags, onFilterChange }) {
    const handleTagChange = (e, { values }) => {
        onFilterChange(values); // Update selected filters
    };

    return (
        <div style={{
            width: '200px', 
            height: '100vh',
            padding: '15px',
            background: '#fafafa', // Light grey background for visibility
            borderRight: '1px solid #ccc', // Subtle separation
            overflowY: 'auto', // Allow scrolling if content overflows
            color: '#000' // Sets all text inside the sidebar to black
        }}>

            <Typography as="h4" variant="title3" style={{ marginBottom: '15px' }}>
            Filter Dashboards
            </Typography>

            <Multiselect values={selectedTags} onChange={handleTagChange} inline>
                {availableTags.map(tag => (
                    <Multiselect.Option key={tag} label={tag} value={tag} />
                ))}
            </Multiselect>
        </div>
    );
}

export default SidebarFilter;
