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

export const C3_DEFAULT_BACKGROUND_NAME = 'background://c3-atmosphere';
export const C3_DEFAULT_BACKGROUND_DATA =
    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOTIwIiBoZWlnaHQ9IjEwODAiIHZpZXdCb3g9IjAgMCAxOTIwIDEwODAiPjxkZWZzPjxmaWx0ZXIgaWQ9ImMzLWJsdXIiIHg9Ii01MDAiIHk9Ii01MDAiIHdpZHRoPSIyOTIwIiBoZWlnaHQ9IjI1ODAiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzPSJzUkdCIj48ZmVHYXVzc2lhbkJsdXIgc3RkRGV2aWF0aW9uPSIxNzUiLz48L2ZpbHRlcj48cmFkaWFsR3JhZGllbnQgaWQ9ImMzLWN5YW4tbmF2eSIgY3g9IjEzLjUiIGN5PSIxNDQxLjM2IiByPSI4NTEuNDkiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIiBncmFkaWVudFRyYW5zZm9ybT0idHJhbnNsYXRlKDAgMTQ0MS4zNikgc2NhbGUoMSAuNjE2NTUpIHRyYW5zbGF0ZSgwIC0xNDQxLjM2KSI+PHN0b3Agc3RvcC1jb2xvcj0iIzMwYWFjYyIvPjxzdG9wIG9mZnNldD0iMSIgc3RvcC1jb2xvcj0iIzBjMWE1NiIvPjwvcmFkaWFsR3JhZGllbnQ+PHJhZGlhbEdyYWRpZW50IGlkPSJjMy1ibHVlLXZpb2xldCIgY3g9IjI3My41IiBjeT0iMTQ0MS4zNiIgcj0iODUxLjQ5IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgZ3JhZGllbnRUcmFuc2Zvcm09InRyYW5zbGF0ZSgwIDE0NDEuMzYpIHNjYWxlKDEgLjYxNjU1KSB0cmFuc2xhdGUoMCAtMTQ0MS4zNikiPjxzdG9wIHN0b3AtY29sb3I9IiMyYzkzZTEiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiM4MDE0OGMiLz48L3JhZGlhbEdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTkyMCIgaGVpZ2h0PSIxMDgwIiBmaWxsPSIjMGIxMTE4Ii8+PGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjYyLjQgMCkiIG9wYWNpdHk9Ii43MiI+PHJlY3QgeD0iMTMuNSIgeT0iNDgzIiB3aWR0aD0iNTkzIiBoZWlnaHQ9IjE2OTciIGZpbGw9InVybCgjYzMtY3lhbi1uYXZ5KSIgZmlsdGVyPSJ1cmwoI2MzLWJsdXIpIiB0cmFuc2Zvcm09InJvdGF0ZSgtOTAgMzEwIDEzMzEuNSkiLz48cmVjdCB4PSIyNzMuNSIgeT0iNDgzIiB3aWR0aD0iNTkzIiBoZWlnaHQ9IjE2OTciIGZpbGw9InVybCgjYzMtYmx1ZS12aW9sZXQpIiBmaWx0ZXI9InVybCgjYzMtYmx1cikiIHRyYW5zZm9ybT0icm90YXRlKC05MCA1NzAgMTMzMS41KSIvPjwvZz48L3N2Zz4=';

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
    const [selectedBG, setSelectedBG] = useState(C3_DEFAULT_BACKGROUND_NAME);

    const refreshBackgrounds = () => {
        getBackgrounds().then((response) => {
            if (response.status >= 200 && response.status <= 299) {
                setBackgrounds(response.entry);
            } else {
                console.error(response);
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
        const selectedBackground = backgrounds.find((bg) => bg.name === selectedBG);
        if (!selectedBackground) {
            return;
        }
        const bgConf = {
            backgroundImage: {
                sizeType: 'cover',
                src: selectedBackground.content.data,
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
                            .sort(
                                (left, right) =>
                                    Number(right.name === C3_DEFAULT_BACKGROUND_NAME) -
                                    Number(left.name === C3_DEFAULT_BACKGROUND_NAME),
                            )
                            .map((bg) => (
                                <Card
                                    key={bg.name}
                                    style={{
                                        cursor: 'pointer',
                                        outline:
                                            selectedBG === bg.name ? '2px solid #0ea5e9' : undefined,
                                        outlineOffset: selectedBG === bg.name ? 2 : undefined,
                                    }}
                                    aria-label={`Select ${bg.content.name}`}
                                    aria-pressed={selectedBG === bg.name}
                                    onClick={() => {
                                        setSelectedBG(bg.name);
                                    }}
                                >
                                    <Card.Body style={{ padding: 5 }}>
                                        <img
                                            title={bg.content.name}
                                            alt={`${bg.content.name} dashboard background`}
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
                                disabled={!backgrounds.some((bg) => bg.name === selectedBG)}
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
            <Tooltip content="Cisco extension: choose dashboard background/theme">
                <Button
                    style={{ maxWidth: 32 }}
                    appearance="subtle"
                    aria-label="Choose dashboard background or theme"
                    icon={
                        <Palette
                            width={20}
                            height={20}
                            style={{ color: props.iconColor || '#26afac' }}
                        />
                    }
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
