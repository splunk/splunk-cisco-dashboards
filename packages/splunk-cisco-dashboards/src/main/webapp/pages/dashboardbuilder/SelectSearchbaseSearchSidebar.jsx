import { useDashboardApi } from '@splunk/dashboard-context';
import Button from '@splunk/react-ui/Button';
import { _ } from '@splunk/ui-utils/i18n';
import { getSearches } from '../../common/lib/searchbase';
import React, { useState, useCallback, useEffect } from 'react';
import Menu from '@splunk/react-ui/Menu';
import WaitSpinner from '@splunk/react-ui/WaitSpinner';
import Text from '@splunk/react-ui/Text';
import { getDashboardTimeQueryParameters } from './dashboardTimeUtils';

const cancelButtonStyle = {
    margin: '10px 15px',
};

const SelectSearchbaseSearchSidebar = ({ dataSourceTemplate, from, dataSourceBindingType }) => {
    const [selectedSearchbaseSearch, setSelectedSearchbaseSearch] = useState(undefined);
    const [searches, setSearches] = useState([]);
    const [selectedSearch, setSelectedSearch] = useState();
    const [searchValue, setSearchValue] = useState('');

    const dashboardApi = useDashboardApi();

    useEffect(() => {
        if (searches.length == 0) {
            const getSearchesList = async () => {
                const data = await getSearches();
                setSearches(data.entry);
            };
            getSearchesList();
        }
    }, []);

    const openNewDataSourcePanel = useCallback(
        (newDataSource, metaData) => {
            dashboardApi.openPanel({
                activePanel: 'newData',
                panelProps: {
                    dataSourceTemplate: newDataSource,
                    from,
                    bindingType: dataSourceBindingType,
                    dataSourceMetaData: metaData,
                },
            });
        },
        [dashboardApi, from, dataSourceBindingType]
    );

    const updateSelectedSBSearch = useCallback(
        (newSBSearch) => {
            const newDs = {
                type: dataSourceTemplate.type,
                options: {
                    ...dataSourceTemplate.options,
                    ref: newSBSearch.name,
                    queryParameters: getDashboardTimeQueryParameters(
                        dashboardApi.getDefinition(),
                    ),
                },
                name: newSBSearch.name,
            };
            //setSelectedSearchbaseSearch(newSBSearch);
            openNewDataSourcePanel(newDs, newSBSearch.metaData);
        },
        [dashboardApi, openNewDataSourcePanel, dataSourceTemplate]
    );

    const handleRequestClose = useCallback(
        () => dashboardApi.openPanel(from),
        [dashboardApi, from]
    );

    return (
        <div>
            {!searches || searches.length == 0 ? (
                <WaitSpinner size="large" style={{ margin: 15 }}></WaitSpinner>
            ) : (
                <>
                    <Text
                        appearance="search"
                        value={searchValue}
                        onChange={(e, { value }) => setSearchValue(value)}
                        style={{ margin: 10 }}
                    />
                    <Menu
                        focusMode="roving"
                        style={{
                            overflowY: 'auto',
                            maxHeight: 'calc(100vh - 290px)',
                        }}
                    >
                        {searches
                            .filter((s) => s.content.search_type == 'display')
                            .filter(
                                (s) =>
                                    searchValue == '' ||
                                    s.name.includes(searchValue) ||
                                    s.content.search_name?.includes(searchValue)
                            )
                            .map((search) => (
                                <Menu.Item
                                    selectable
                                    selected={search.name == selectedSearch?.name}
                                    onClick={() =>
                                        setSelectedSearch({
                                            name: search.name,
                                        })
                                    }
                                    description={search.name}
                                    style={
                                        search.name == selectedSearch?.name
                                            ? {
                                                  background: '#e7f2fc',
                                              }
                                            : {}
                                    }
                                >
                                    {search.content.search_name}
                                </Menu.Item>
                            ))}
                    </Menu>
                </>
            )}
            <div style={{ display: 'flex', alignContent: 'space-between', margin: 15 }}>
                <Button
                    disabled={!selectedSearch}
                    appearance="primary"
                    label="Add searchbase search"
                    onClick={() => updateSelectedSBSearch({ ...selectedSearch, metaData: '' })}
                />
                <Button label="Cancel" onClick={handleRequestClose} />
            </div>
        </div>
    );
};

export default SelectSearchbaseSearchSidebar;
