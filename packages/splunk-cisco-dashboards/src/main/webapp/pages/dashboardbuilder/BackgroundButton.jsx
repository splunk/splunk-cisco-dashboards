import React, { useCallback, useState, useEffect } from 'react';
import Button from '@splunk/react-ui/Button';
import Paintbrush from '@splunk/react-icons/Paintbrush';
import Palette from '@splunk/react-icons/Palette';
import Tooltip from '@splunk/react-ui/Tooltip';
import Modal from '@splunk/react-ui/Modal';
import Picture from '@splunk/react-icons/Picture';
import '../../common/styles/commonstyles.css';
import { getBackgrounds, addBackgrounds } from '../../common/lib/splunk';
import CardLayout from '@splunk/react-ui/CardLayout';
import Card from '@splunk/react-ui/Card';
import { cloneDeep, isEqual } from 'lodash-es';

const STATIC_APP_ROOT = '/static/app/splunk-cisco-dashboards';

const DEFAULT_BACKGROUND_THEMES = [
    { id: 'sei-generic-1', name: 'SEI Generic Bkd 1', file: 'bkd-sei-generic-1.svg' },
    { id: 'sei-generic-3', name: 'SEI Generic Bkd 3', file: 'bkd-sei-generic-3.svg' },
    { id: 'sei-generic-4', name: 'SEI Generic Bkd 4', file: 'bkd-sei-generic-4.svg' },
    { id: 'sei-generic-7', name: 'SEI Generic Bkd 7', file: 'bkd-sei-generic-7.svg' },
    { id: 'sei-generic-8', name: 'SEI Generic Bkd 8', file: 'bkd-sei-generic-8.svg' },
    { id: 'sei-generic-9', name: 'SEI Generic Bkd 9', file: 'bkd-sei-generic-9.svg' },
    { id: 'sei-generic-10', name: 'SEI Generic Bkd 10', file: 'bkd-sei-generic-10.svg' },
    { id: 'sei-generic-11', name: 'SEI Generic Bkd 11', file: 'bkd-sei-generic-11.svg' },
    { id: 'sei-generic-12', name: 'SEI Generic Bkd 12', file: 'bkd-sei-generic-12.svg' },
    {
        id: 'sei-needs-activation',
        name: 'SEI Needs Activation',
        file: 'bkd-sei-needs-activation.svg',
    },
].map(({ id, name, file }) => ({
    name: `background://${id}`,
    content: {
        name,
        data: `${STATIC_APP_ROOT}/${file}`,
    },
}));

const mergeBackgroundThemes = (entries = []) => {
    const themesByName = new Map(DEFAULT_BACKGROUND_THEMES.map((theme) => [theme.name, theme]));

    entries.forEach((entry) => {
        if (entry?.name) {
            themesByName.set(entry.name, entry);
        }
    });

    return Array.from(themesByName.values());
};

export function ImageBase64Encoder({ setNewBG }) {
    const [base64, setBase64] = useState(undefined);
    const [dragActive, setDragActive] = useState(false);

    // --- Encode file to Base64 ---
    const encodeToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // --- Handle file upload ---
    const handleFiles = async (files) => {
        const file = files[0];
        if (file) {
            const encoded = await encodeToBase64(file);
            setBase64(encoded);
            setNewBG(encoded);
        }
    };

    // --- Drag and Drop Handlers ---
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
        else if (e.type === 'dragleave') setDragActive(false);
    };

    return (
        <div className="encoder-body">
            <div
                className={`drop-zone ${dragActive ? 'active' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDrag}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
            >
                <p>Drag & drop your image here, or click to upload</p>
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFiles(e.target.files)}
                    id="fileInput"
                    className="file-input"
                />
                <label htmlFor="fileInput" className="upload-btn">
                    Browse Files
                </label>
            </div>

            {base64 && (
                <div className="preview">
                    <h3>Preview:</h3>
                    <img src={base64} alt="Preview" className="preview-img" />
                </div>
            )}
        </div>
    );
}

const BackgroundButton = (props) => {
    const [openBackgroundModal, setOpenBackgroundModal] = useState(false);
    const [openChangeBackgroundModal, setOpenChangeBackgroundModal] = useState(false);
    const [newBG, setNewBG] = useState(undefined);
    const [displayError, setDisplayError] = useState(false);
    const [backgrounds, setBackgrounds] = useState([]);
    const [selectedBG, setSelectedBG] = useState();

    const refreshBackgrounds = () => {
        getBackgrounds().then((response) => {
            if (response.status >= 200 && response.status <= 299) {
                setBackgrounds(mergeBackgroundThemes(response.entry));
            } else {
                console.error(response);
                setBackgrounds(mergeBackgroundThemes());
            }
        });
    };

    useEffect(() => {
        refreshBackgrounds();
    }, []);

    const handleRequestCloseModal = () => {
        setOpenBackgroundModal(false);
        setDisplayError(false);
    };

    const handleRequestCloseChangeBGModal = () => {
        setOpenChangeBackgroundModal(false);
    };

    const handleUploadBG = () => {
        addBackgrounds(newBG).then((response) => {
            if (response.status >= 200 && response.status <= 299) {
                setOpenBackgroundModal(false);
                setDisplayError(false);
                refreshBackgrounds();
            } else {
                setDisplayError(true);
                console.error(response);
            }
        });
    };

    const applyNewBG = () => {
        const { dashboardApi } = props;
        let def = cloneDeep(dashboardApi.getDefinition());
        const bgConf = {
            backgroundImage: {
                sizeType: 'cover',
                src: backgrounds.find((bg) => bg.name == selectedBG)?.content.data,
                x: 0,
                y: 0,
            },
        };
        if (def.layout.tabs) {
            // dashboards with tabs
            def.layout.layoutDefinitions[dashboardApi.getActiveTab()].options = {
                ...def.layout.layoutDefinitions[dashboardApi.getActiveTab()].options,
                ...bgConf,
            };
        } else {
            def.layout.options = { ...def.layout.options, ...bgConf };
        }

        dashboardApi.updateDefinition(def);
        setOpenChangeBackgroundModal(false);
    };

    return (
        <>
            <Modal id="choose_background_modal"
                open={openChangeBackgroundModal}
                style={{ width: '900px' }}
                onRequestClose={handleRequestCloseChangeBGModal}
            >
                <Modal.Header
                    title="Background and Theme Selector"
                    icon={<Picture style={{ width: 30, height: 30 }}></Picture>}
                />

                <Modal.Body id="">
                    <span>Select a background image to apply to this dashboard. To see the image name simply mouse over and hover until the name is shown.</span>
                    <CardLayout
                        alignCards="left"
                        gutterSize={20}
                        cardWidth={250}
                        cardMinWidth={250}
                        cardMaxWidth={250}
                        wrapCards
                    >
                        {backgrounds
                            .filter((bg) => bg.name.includes('background://'))
                            .map((bg) => (
                                <Card
                                    key={bg.name}
                                    style={{
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                        setSelectedBG(bg.name);
                                    }}
                                >
                                    <Card.Body style={{ padding: 5 }}>
                                        <img
                                            title={bg.content.name}
                                            src={bg.content.data}
                                            style={{ display: 'block', width: 240 }}
                                        ></img>
                                    </Card.Body>
                                </Card>
                            ))}
                    </CardLayout>
                </Modal.Body>
                <Modal.Footer>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: 850,
                        }}
                    >
                        <Button
                            label="Add new background"
                            onClick={() => {
                                setDisplayError(false);
                                setOpenBackgroundModal(true);
                            }}
                            style={{ maxWidth: 160 }}
                        ></Button>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <Button
                                label="Select"
                                onClick={() => {
                                    applyNewBG();
                                }}
                                appearance="primary"
                                disabled={selectedBG == undefined}
                            ></Button>
                            <Button
                                label="Cancel"
                                onClick={() => {
                                    setOpenChangeBackgroundModal(false);
                                }}
                            ></Button>
                        </div>
                    </div>
                </Modal.Footer>
            </Modal>
            <Modal
                open={openBackgroundModal}
                style={{ width: '500px' }}
                onRequestClose={handleRequestCloseModal}
            >
                <Modal.Header
                    title="Upload New Backgrounds"
                    icon={<Picture style={{ width: 30, height: 30 }}></Picture>}
                />

                <Modal.Body>
                    <span>
                        Upload your company’s corporate background image to streamline dashboard
                        design aligned with your brand’s visual identity.
                    </span>
                    <ImageBase64Encoder setNewBG={setNewBG}></ImageBase64Encoder>
                    {displayError && (
                        <span style={{ color: '#FF0000' }}>
                            An error occurred while trying to upload the new background. Please
                            check the browser console logs for more details.
                        </span>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        label="Upload"
                        onClick={() => {
                            handleUploadBG();
                        }}
                        appearance="primary"
                        disabled={newBG == undefined || newBG == '' || newBG == false}
                    ></Button>
                    <Button
                        label="Cancel"
                        onClick={() => {
                            setOpenBackgroundModal(false);
                            setNewBG(undefined);
                        }}
                    ></Button>
                </Modal.Footer>
            </Modal>
            <Tooltip content="Add a background/theme">
                <Button
                    style={{ maxWidth: 32 }}
                    appearance="subtle"
                    icon={<Palette width={20} height={20}></Palette>}
                    onClick={() => {
                        setNewBG(undefined);
                        setOpenChangeBackgroundModal(true);
                    }}
                ></Button>
            </Tooltip>
        </>
    );
};

export default BackgroundButton;
