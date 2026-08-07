import React, { useState, useRef, useEffect } from 'react';
import CardLayout from '@splunk/react-ui/CardLayout';
import Card from '@splunk/react-ui/Card';
import P from '@splunk/react-ui/Paragraph';
import Button from '@splunk/react-ui/Button';
import Modal from '@splunk/react-ui/Modal';
import { SplunkThemeProvider } from '@splunk/themes';
import Chip from '@splunk/react-ui/Chip';
import Tag from '@splunk/react-icons/Tag';
import SidebarFilter from './SidebarFilter'; // Import Sidebar Component

// Import images
import exec from './images/exec.png';
import kpi from './images/kpi.png';
import generic from './images/generic.png';
import extra from './images/extra.png';

import { StyledContainer } from './styles.js';
import Heading from '@splunk/react-ui/Heading';

// Centralized Dashboard Data
const dashboards = [
    {
        id: 'exec-dark',
        title: 'Executive Dashboard',
        subtitle: 'A high level overview of a topic',
        image: exec,
        tags: ['Executive', 'Variety'],
    },
];

// Extract Unique Tags
const uniqueTags = [...new Set(dashboards.flatMap((d) => d.tags))];

function TemplateCards() {
    const minWidth = 300;
    const [cardWidth, setCardWidth] = useState(undefined);
    const [selectedTags, setSelectedTags] = useState([]); // Stores active filters

    const modalToggle = useRef(null);
    const [open, setOpen] = useState(false);
    const [selectedCardId, setSelectedCardId] = useState(null);

    // Handle window resizing to adjust card layout dynamically
    useEffect(() => {
        const handleResize = () => {
            setCardWidth(window.innerWidth >= 960 ? (window.innerWidth - 450) / 3 : undefined);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Open modal with selected card ID
    const handlePreviewClick = (id) => {
        setSelectedCardId(id);
        setOpen(true);
    };

    // Close modal
    const handleRequestClose = () => {
        setOpen(false);
        setSelectedCardId(null);
    };

    // button direction
    const navigateToDashboard = (id) => {
        window.location.href = `/en-US/app/splunk-cisco-dashboards/templatewizard?dashboardId=${id}`;
    };

    // Get selected card details from dashboards array
    const selectedCard = dashboards.find((d) => d.id === selectedCardId);

    // 🚀 Filter dashboards based on selected tags
    const filteredDashboards =
        selectedTags.length > 0
            ? dashboards.filter((d) => d.tags.some((tag) => selectedTags.includes(tag)))
            : dashboards;

    return (
        <SplunkThemeProvider density="compact">
            <div
                style={{
                    display: 'flex',
                    height: '100vh',
                    overflow: 'hidden',
                    backgroundColor: 'var(--sui-background-page)',
                }}
            >
                {/* Sidebar - Always visible */}
                <SidebarFilter
                    availableTags={uniqueTags}
                    selectedTags={selectedTags}
                    onFilterChange={setSelectedTags}
                />

                {/* Main Content Area */}
                <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
                    <StyledContainer>
                        <Heading level={1}>Template library</Heading>
                    </StyledContainer>
                    {/* Dashboard Cards */}
                    <CardLayout cardMinWidth={minWidth} cardWidth={cardWidth}>
                        {filteredDashboards.map(({ id, title, subtitle, image, tags }) => (
                            <Card key={id} style={{ height: 'auto' }}>
                                <Card.Header title={title} subtitle={subtitle} />
                                <Card.Body inset={false} style={{ textAlign: 'center' }}>
                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <img
                                            src={image}
                                            alt={title}
                                            style={{
                                                width: '80%',
                                                height: 'auto',
                                                cursor: 'pointer',
                                            }}
                                            onClick={() => handlePreviewClick(id)}
                                        />
                                        <div
                                            style={{
                                                display: 'flex',
                                                gap: '10px',
                                                marginTop: '10px',
                                            }}
                                        >
                                            {tags.map((tag) => (
                                                <Chip key={tag} icon={<Tag />}>
                                                    {tag}
                                                </Chip>
                                            ))}
                                        </div>
                                    </div>
                                </Card.Body>
                                <Card.Footer>
                                    <Button
                                        onClick={() => handlePreviewClick(id)}
                                        label="Preview"
                                    />
                                    <Button
                                        label="Select"
                                        appearance="primary"
                                        onClick={() => navigateToDashboard(id)}
                                        style={{ backgroundColor: '#228B22' }}
                                    />
                                </Card.Footer>
                            </Card>
                        ))}
                    </CardLayout>
                </div>

                {/* Modal for Preview */}
                <Modal
                    onRequestClose={handleRequestClose}
                    open={open}
                    returnFocus={modalToggle}
                    style={{ width: '1400px' }}
                >
                    <Modal.Header
                        onRequestClose={handleRequestClose}
                        title={selectedCard?.title || ''}
                        subtitle={selectedCard?.subtitle || ''}
                    />
                    <Modal.Body>
                        <P>
                            {selectedCard ? (
                                <img
                                    src={selectedCard.image}
                                    alt={selectedCard.title}
                                    style={{
                                        width: '80%',
                                        height: 'auto',
                                        display: 'block',
                                        margin: '0 auto',
                                    }}
                                />
                            ) : (
                                'No preview available.'
                            )}
                        </P>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button onClick={handleRequestClose} label="Close" />
                        {/*<Button label="Select" appearance="primary" onClick={() => navigateToDashboard(id)} style={{ backgroundColor: '#228B22' }} />*/}
                    </Modal.Footer>
                </Modal>
            </div>
        </SplunkThemeProvider>
    );
}

export default TemplateCards;
