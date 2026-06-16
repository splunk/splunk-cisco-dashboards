import DefaultDataSourcesPanel from '@splunk/dashboard-datasource-panel';
import { noop } from '@splunk/dashboard-utils';
import Button from '@splunk/react-ui/Button';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Pencil from '@splunk/react-icons/Pencil';
import Trash from '@splunk/react-icons/enterprise/Trash';
import Menu from '@splunk/react-ui/Menu';
import _ from 'lodash';
import CollapsiblePanel from '@splunk/react-ui/CollapsiblePanel';
import Link from '@splunk/react-ui/Link';
import TrashCanCross from '@splunk/react-icons/TrashCanCross';
import Clickable from '@splunk/react-ui/Clickable';
import Modal from '@splunk/react-ui/Modal';
import Message from '@splunk/react-ui/Message';
import Tooltip from '@splunk/react-ui/Tooltip';

const styles = {
    container: {
        display: 'flex',
        justifyContent: 'space-between',
        width: '400px',
    },
    label: {
        alignSelf: 'center',
        overflow: 'hidden',
        paddingRight: '12px',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
    },
    buttonGroup: {
        display: 'flex',
    },
};

const EditIcon = <Pencil variant="filled" />;
const DeleteIcon = <TrashCanCross variant="filled" />;

const MyDataSourceItem = ({
    id,
    name,
    editDataSource,
    deleteDataSource,
    selectSBSearch,
    used,
    itemSelected,
}) => {
    const [openDelete, setOpenDelete] = useState(false);
    const handleEdit = useCallback(
        (e) => {
            e.stopPropagation();
            editDataSource?.(id);
        },
        [id, editDataSource]
    );

    const handleDelete = useCallback(() => {
        deleteDataSource?.({ id, isUsed: true });
    }, [id, deleteDataSource]);

    const handleRequestClickAway = ({ reason }) => {
        if (reason === 'escapeKey') {
            setOpenDelete(false);
        }
    };

    return (
        <>
            <Modal
                onRequestClose={handleRequestClickAway}
                open={openDelete}
                style={{ width: '600px' }}
            >
                <form>
                    <Modal.Header
                        onRequestClose={() => setOpenDelete(false)}
                        title={`Delete '${id}'`}
                    />

                    <Modal.Body>
                        <div>
                            {`${id} is currently being used by 1 visualization. Are you
                            sure you want to delete this data source?`}
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            appearance="secondary"
                            onClick={() => setOpenDelete(false)}
                            label="Cancel"
                        />

                        <Button
                            appearance="primary"
                            label="Delete"
                            onClick={() => {
                                deleteDataSource(id);
                                setOpenDelete(false);
                            }}
                        />
                    </Modal.Footer>
                </form>
            </Modal>
            <Menu.Item
                //disabled={!itemSelected}
                style={{
                    padding: '0px 10px 0px 30px',
                    cursor: itemSelected ? 'pointer' : 'default',
                    color: used ? '#000000' : '#666',
                }}
                endAdornment={
                    <div style={{ display: 'flex' }}>
                        <Button
                            appearance="pill"
                            icon={EditIcon}
                            onClick={handleEdit}
                            style={{ borderRadius: 0, border: '0px solid black' }}
                        />
                        <Button
                            appearance="pill"
                            icon={DeleteIcon}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (used) setOpenDelete(true);
                                else deleteDataSource(id);
                            }}
                            style={{ borderRadius: 0, border: '0px solid black' }}
                        />
                    </div>
                }
                onClick={() => selectSBSearch(id)}
            >
                {used ? name : name + ' (Unused)'}
            </Menu.Item>
        </>
    );
};

export const SearchBaseDataSourcePanel = ({
    createDataSource = noop,
    dashboardApi,
    from,
    editDataSource = noop,
    deleteDataSource = noop,
    ...rest
}) => {
    const [selectedViz, setSelectedViz] = useState(rest.selectedItem);
    const [sbDataSources, setSbDataSources] = useState(
        Object.entries(dashboardApi.getDataSourceRegistry().definition).filter(
            ([key, value]) => value.type === 'ds.searchbase'
        )
    );

    useEffect(() => {
        setSbDataSources((prev) =>
            Object.entries(dashboardApi.getDataSourceRegistry().definition).filter(
                ([key, value]) => value.type === 'ds.searchbase'
            )
        );
    }, [dashboardApi]);

    const handleCreate = useCallback(
        (dsTemplate) => {
            if (dsTemplate.type === 'ds.savedSearch') {
                return dashboardApi.openPanel({
                    activePanel: 'savedSearchChooser',
                    panelProps: {
                        dataSourceTemplate: dsTemplate,
                        dataSourceBindingType: rest.dataSourceBindingType,
                        from: from ?? {
                            activePanel: 'dataOverview',
                        },
                    },
                });
            } else if (dsTemplate.type === 'ds.searchbase') {
                return dashboardApi.openPanel({
                    activePanel: 'searchbaseChooser',
                    panelProps: {
                        dataSourceTemplate: dsTemplate,
                        dataSourceBindingType: rest.dataSourceBindingType,
                        from: from ?? {
                            activePanel: 'dataOverview',
                        },
                    },
                });
            }

            return createDataSource(dsTemplate);
        },
        [dashboardApi, createDataSource, from, rest.dataSourceBindingType]
    );

    const handleSelectSearchbaseSearch = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleCreate({ type: 'ds.searchbase' });
        },
        [handleCreate]
    );

    const handleEdit = useCallback(
        (dsTemplate) => {
            return editDataSource(dsTemplate);
        },
        [dashboardApi, editDataSource, from, rest.dataSourceBindingType]
    );

    const handleDelete = useCallback(
        (dsTemplate) => {
            return deleteDataSource(dsTemplate);
        },
        [dashboardApi, deleteDataSource, from, rest.dataSourceBindingType]
    );

    const selectSBSearch = (id) => {
        console.log(`selected sb search : ${id}`);
        if (selectedViz) {
            let def = _.cloneDeep(dashboardApi.getDefinition());
            def.visualizations[selectedViz['id']].dataSources = { primary: id };
            dashboardApi.updateDefinition(def);
        }
    };

    const isDatasourceUsed = (datasourceId, definition) => {
        for (const viz of Object.values(definition.visualizations || {})) {
            if (viz.dataSources && Object.values(viz.dataSources).includes(datasourceId)) {
                return true;
            }
        }
        return false;
    };

    const dataSourceListItems = useMemo(() => {
        if (!sbDataSources) {
            return null;
        }

        return sbDataSources.map(([id, info]) => (
            <MyDataSourceItem
                key={id}
                id={id}
                name={id /*info.dataSourceName*/}
                editDataSource={editDataSource}
                deleteDataSource={() => deleteSBDataSource(id)}
                selectSBSearch={() => selectSBSearch(id)}
                used={isDatasourceUsed(id, dashboardApi.getDefinition())}
                itemSelected={selectedViz != undefined}
            />
        ));
    }, [sbDataSources, editDataSource, deleteDataSource]);

    const deleteSBDataSource = (id) => {
        const ds = { ...dashboardApi.getDefinition().dataSources };
        if (ds[id]) {
            delete ds[id];
            dashboardApi.updateDefinition({ ...dashboardApi.getDefinition(), dataSources: ds });
            setSbDataSources((prev) =>
                Object.entries(ds).filter(([key, value]) => value.type === 'ds.searchbase')
            );
        }
    };

    return (
        <div>
            <DefaultDataSourcesPanel
                createDataSource={handleCreate}
                dashboardApi={dashboardApi}
                editDataSource={handleEdit}
                deleteDataSource={handleDelete}
                {...rest}
            />
            <CollapsiblePanel
                title={
                    <>
                        <span style={{ marginRight: 15 }}>Searchbase Search</span>
                        <Tooltip
                            content={
                                <div style={{ maxWidth: 500, fontSize: 13 }}>
                                    This is a custom data source that enables automatic
                                    synchronization with searches and metadata defined in
                                    searchbase.conf, ensuring real-time updates dashboards with no
                                    manual effort.
                                    <br />
                                    <b>
                                        However, because it is a custom data source, it will only
                                        function within the Cisco dashboards application (Dashboard Builder or
                                        the My Views tab).
                                    </b>{' '}
                                    You can convert it to a regular Dashboard Studio definition
                                    format by clicking the <b>Convert</b> button. The dashboard will
                                    work in any context, and the selected KPIs will remain
                                    unchanged, but updates and synchronization will no longer be
                                    automatic.
                                </div>
                            }
                        ></Tooltip>
                    </>
                }
                defaultOpen={true}
            >
                <Link
                    tag="button"
                    onClick={handleSelectSearchbaseSearch}
                    style={{ paddingLeft: 35, paddingTop: 5 }}
                >
                    + Select Searchbase Search
                </Link>

                <Menu focusMode="roving" style={{ marginTop: 10 }}>
                    {dataSourceListItems}
                </Menu>
            </CollapsiblePanel>
        </div>
    );
};
