import React, { useCallback, useState, useEffect } from 'react';
import Button from '@splunk/react-ui/Button';
import Paintbrush from '@splunk/react-icons/Paintbrush';
import Palette from '@splunk/react-icons/Palette';
import Tooltip from '@splunk/react-ui/Tooltip';
import Modal from '@splunk/react-ui/Modal';
import Picture from '@splunk/react-icons/Picture';
import '../../common/styles/commonstyles.css';
import { getBackgrounds, addBackgrounds } from '../../common/lib/splunk';
import {
    isAllowedDashboardBackgroundFile,
    isAllowedDashboardBackgroundUpload,
    normalizeDashboardBackgroundSource,
} from '../../common/lib/imageSource';
import { useCanManageInsightsWorkspaces } from '../../common/hooks/useCanManageInsightsWorkspaces';
import CardLayout from '@splunk/react-ui/CardLayout';
import Card from '@splunk/react-ui/Card';
import { cloneDeep, isEqual } from 'lodash-es';

export const FACTORY_DEFAULT_BACKGROUND_NAME =
    'background://page-spotlight-bottom-glow-low-intensity';
export const FACTORY_DEFAULT_BACKGROUND_LABEL = 'Page Spotlight Bottom Glow - Low Intensity';
export const FACTORY_DEFAULT_BACKGROUND_DATA =
    'data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiBoZWlnaHQ9IjEyODgiIHZpZXdCb3g9IjAgMCAyMDAwIDEyODgiIHdpZHRoPSIyMDAwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIj48ZmlsdGVyIGlkPSJhIiBjb2xvci1pbnRlcnBvbGF0aW9uLWZpbHRlcnM9InNSR0IiIGZpbHRlclVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgaGVpZ2h0PSIxNTg0IiB3aWR0aD0iMjAwMCIgeD0iMCIgeT0iLTI4MCI+PGZlRmxvb2QgZmxvb2Qtb3BhY2l0eT0iMCIgcmVzdWx0PSJCYWNrZ3JvdW5kSW1hZ2VGaXgiLz48ZmVCbGVuZCBpbj0iU291cmNlR3JhcGhpYyIgaW4yPSJCYWNrZ3JvdW5kSW1hZ2VGaXgiIG1vZGU9Im5vcm1hbCIgcmVzdWx0PSJzaGFwZSIvPjxmZUdhdXNzaWFuQmx1ciByZXN1bHQ9ImVmZmVjdDFfZm9yZWdyb3VuZEJsdXJfNjU1MTZfNjgiIHN0ZERldmlhdGlvbj0iMTQwIi8+PC9maWx0ZXI+PGNsaXBQYXRoIGlkPSJiIj48cGF0aCBkPSJtMjgwIDBoMTQ0MHYxMDI0aC0xNDQweiIvPjwvY2xpcFBhdGg+PGcgZmlsdGVyPSJ1cmwoI2EpIiBvcGFjaXR5PSIuNSI+PGcgY2xpcC1wYXRoPSJ1cmwoI2IpIiBmaWxsLW9wYWNpdHk9Ii41Ij48ZWxsaXBzZSBjeD0iNTY2LjAwMSIgY3k9IjEwNDguMTYiIGZpbGw9IiNmZjkwMDAiIHJ4PSI0MjIiIHJ5PSIxNTQiIHRyYW5zZm9ybT0ibWF0cml4KC0xIC0wIDAgLTEgMTEzMi4wMDIgMjA5Ni4zMikiLz48ZWxsaXBzZSBjeD0iMTE4MSIgY3k9IjEwNzAuMTYiIGZpbGw9IiNmZjAwN2YiIHJ4PSI1OTIiIHJ5PSIyMjMiIHRyYW5zZm9ybT0ibWF0cml4KC0xIC0wIDAgLTEgMjM2MiAyMTQwLjMyKSIvPjxnIGZpbGw9IiNmZjkwMDAiPjxlbGxpcHNlIGN4PSIyNDIuMDEyIiBjeT0iMTU1LjYyMiIgcng9IjI0Mi4wMTIiIHJ5PSIxNTUuNjIyIiB0cmFuc2Zvcm09Im1hdHJpeCgtLjg2MTk2NyAtLjUwNjk2NCAuODIzNDEgLS41Njc0NDcgMTY2OC44NiAxMTgyKSIvPjxlbGxpcHNlIGN4PSI2NzcuMDAxIiBjeT0iMTA0Ny42NiIgcng9IjIyNyIgcnk9Ijk2LjUiIHRyYW5zZm9ybT0ibWF0cml4KC0xIC0wIDAgLTEgMTM1NC4wMDIgMjA5NS4zMikiLz48L2c+PC9nPjwvZz48L3N2Zz4=';

const RETIRED_BACKGROUND_SUFFIXES = [
    'cbr-generic-3',
    'cbr-generic-4',
    'cbr-title-slide-1',
    'cbr-title-slide-2',
    'exec-manufacturing',
    'generic-1',
    'generic-1.1',
    'generic-10',
    'generic-13',
    'generic-15',
    'generic-17',
    'generic-18',
    'generic-19',
    'generic-2',
    'generic-21',
    'generic-22',
    'generic-3',
    'generic-4',
];
export const RETIRED_BACKGROUND_NAMES = new Set([
    'background://c3-atmosphere',
    ...RETIRED_BACKGROUND_SUFFIXES.flatMap((suffix) => [
        `background://is4s-${suffix}`,
        `background://sei-${suffix}`,
    ]),
]);

const FACTORY_DEFAULT_BACKGROUND = {
    name: FACTORY_DEFAULT_BACKGROUND_NAME,
    content: {
        data: FACTORY_DEFAULT_BACKGROUND_DATA,
        name: FACTORY_DEFAULT_BACKGROUND_LABEL,
    },
};

export const prepareBackgroundChoices = (entries = []) => {
    const seenNames = new Set();
    const seenImages = new Set();

    return [FACTORY_DEFAULT_BACKGROUND, ...entries]
        .filter(
            (background) =>
                background?.name?.includes('background://') &&
                background?.content?.data &&
                !RETIRED_BACKGROUND_NAMES.has(background.name),
        )
        .map((background) => {
            const source = normalizeDashboardBackgroundSource(background.content.data);
            if (!source) return undefined;
            return {
                ...background,
                content: {
                    ...background.content,
                    data: source,
                    name:
                        background.content.name ||
                        `Custom Background — ${background.name.replace('background://', '')}`,
                },
            };
        })
        .filter(Boolean)
        .filter((background) => {
            if (seenNames.has(background.name) || seenImages.has(background.content.data)) {
                return false;
            }
            seenNames.add(background.name);
            seenImages.add(background.content.data);
            return true;
        });
};

export function ImageBase64Encoder({ setNewBG, setDisplayError }) {
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
        if (!isAllowedDashboardBackgroundFile(file?.type, file?.size)) {
            setBase64(undefined);
            setNewBG(undefined);
            setDisplayError(true);
            return;
        }
        try {
            const encoded = await encodeToBase64(file);
            if (!isAllowedDashboardBackgroundUpload(encoded)) {
                throw new Error('Unsupported image data');
            }
            setBase64(encoded);
            setNewBG(encoded);
            setDisplayError(false);
        } catch {
            setBase64(undefined);
            setNewBG(undefined);
            setDisplayError(true);
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
                    accept="image/png,image/jpeg,image/gif,image/webp"
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
    const { canManage: canManageSharedBackgrounds } = useCanManageInsightsWorkspaces();
    const [openBackgroundModal, setOpenBackgroundModal] = useState(false);
    const [openChangeBackgroundModal, setOpenChangeBackgroundModal] = useState(false);
    const [newBG, setNewBG] = useState(undefined);
    const [displayError, setDisplayError] = useState(false);
    const [backgrounds, setBackgrounds] = useState([]);
    const [selectedBG, setSelectedBG] = useState(FACTORY_DEFAULT_BACKGROUND_NAME);

    const refreshBackgrounds = () => {
        getBackgrounds().then((response) => {
            if (response.status >= 200 && response.status <= 299) {
                setBackgrounds(prepareBackgroundChoices(response.entry));
            } else {
                setBackgrounds(prepareBackgroundChoices());
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
        if (!isAllowedDashboardBackgroundUpload(newBG)) {
            setDisplayError(true);
            return;
        }
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
                            .sort(
                                (left, right) =>
                                    Number(right.name === FACTORY_DEFAULT_BACKGROUND_NAME) -
                                    Number(left.name === FACTORY_DEFAULT_BACKGROUND_NAME),
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
                            justifyContent: canManageSharedBackgrounds
                                ? 'space-between'
                                : 'flex-end',
                            alignItems: 'center',
                            width: 850,
                        }}
                    >
                        {canManageSharedBackgrounds && (
                            <Button
                                label="Add new background"
                                onClick={() => {
                                    setDisplayError(false);
                                    setOpenBackgroundModal(true);
                                }}
                                style={{ maxWidth: 160 }}
                            ></Button>
                        )}
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
            {canManageSharedBackgrounds && (
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
                            Upload your company’s corporate background image to streamline
                            dashboard design aligned with your brand’s visual identity.
                        </span>
                        <ImageBase64Encoder
                            setNewBG={setNewBG}
                            setDisplayError={setDisplayError}
                        ></ImageBase64Encoder>
                        {displayError && (
                            <span style={{ color: '#FF0000' }}>
                                Use a PNG, JPEG, GIF, or WebP image no larger than 2 MB.
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
            )}
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
