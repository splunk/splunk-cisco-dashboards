import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import '../../common/styles/commonstyles.css';
import Button from '@splunk/react-ui/Button';
import Select from '@splunk/react-ui/Select';
import Multiselect from '@splunk/react-ui/Multiselect';
import Checkbox from '@splunk/react-ui/Checkbox';
import Text from '@splunk/react-ui/Text';
import ChartSingleValue from '@splunk/react-icons/ChartSingleValue';
import ChartPie from '@splunk/react-icons/ChartPie';
import ChartLine from '@splunk/react-icons/ChartLine';
import ChartArea from '@splunk/react-icons/ChartArea';
import ChartBar from '@splunk/react-icons/ChartBar';
import TableList from '@splunk/react-icons/TableList';
import ChartSingleValueRadial from '@splunk/react-icons/ChartSingleValueRadial';
import ChartColumn from '@splunk/react-icons/ChartColumn';
import Modal from '@splunk/react-ui/Modal';
import { plainTextFromHtml } from '../../common/services/searchbaseCatalogue';

const ALL_APPS = '__all_apps__';
const ALL_CATEGORIES = '__all_categories__';
const ALL_SUB_CATEGORIES = '__all_sub_categories__';
const DEFAULT_APP_SCOPE = 'splunk-cisco-dashboards';
const KPI_MENU_WIDTH = 560;
const MENU_VIEWPORT_MARGIN = 12;
const CONFIG_PANEL_MIN_WIDTH = 240;
const CONFIG_PANEL_MIN_HEIGHT = 300;

const getConfigurationPanelLeft = () => {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const elements = Array.from(document.querySelectorAll('aside, section, div'));

    return elements.reduce((panelLeft, element) => {
        const rect = element.getBoundingClientRect();

        if (
            rect.width < CONFIG_PANEL_MIN_WIDTH ||
            rect.height < CONFIG_PANEL_MIN_HEIGHT ||
            rect.left < viewportWidth * 0.45 ||
            rect.right < viewportWidth - 40 ||
            !element.textContent.includes('Configuration')
        ) {
            return panelLeft;
        }

        return Math.min(panelLeft, rect.left);
    }, viewportWidth);
};

const equalArrays = (a, b) => {
    if (a.length !== b.length) return false;

    const freq = {};

    for (const s of a) freq[s] = (freq[s] || 0) + 1;
    for (const s of b) {
        if (!freq[s]) return false;
        freq[s]--;
    }

    return true;
};

const sortedUnique = (values) =>
    [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));

const getVizIcon = (defaultViz) => {
    if (!defaultViz) return <TableList width={20} height={20} />;
    if (defaultViz.includes('table')) return <TableList width={20} height={20} />;
    if (defaultViz.includes('bar')) return <ChartBar width={20} height={20} />;
    if (defaultViz.includes('line')) return <ChartLine width={20} height={20} />;
    if (defaultViz.includes('area')) return <ChartArea width={20} height={20} />;
    if (defaultViz.includes('column')) return <ChartColumn width={20} height={20} />;
    if (defaultViz.includes('pie')) return <ChartPie width={20} height={20} />;
    if (defaultViz.includes('singlevalueradial')) {
        return <ChartSingleValueRadial width={20} height={20} />;
    }
    return <ChartSingleValue width={20} height={20} />;
};

export default function DropdownWithSearch({
    label,
    icon,
    appearance,
    style,
    onSelect,
    searches,
}) {
    const dropdownRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedApp, setSelectedApp] = useState(DEFAULT_APP_SCOPE);
    const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
    const [selectedSubCategory, setSelectedSubCategory] = useState(ALL_SUB_CATEGORIES);
    const [selectedTags, setSelectedTags] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState(undefined);
    const [selection, setSelection] = useState([]);
    const [confirmationOpen, setConfirmationOpen] = useState(false);

    const updateMenuPosition = useCallback(() => {
        if (!isOpen || !dropdownRef.current) return;

        const rect = dropdownRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const maxMenuWidth = Math.max(320, viewportWidth - MENU_VIEWPORT_MARGIN * 2);
        const menuWidth = Math.min(KPI_MENU_WIDTH, maxMenuWidth);
        const configurationPanelLeft = getConfigurationPanelLeft();
        const availableRight =
            configurationPanelLeft < viewportWidth
                ? Math.max(
                      MENU_VIEWPORT_MARGIN + menuWidth,
                      configurationPanelLeft - MENU_VIEWPORT_MARGIN,
                  )
                : viewportWidth - MENU_VIEWPORT_MARGIN;
        const preferredLeft = rect.left - 11;
        const left = Math.max(
            MENU_VIEWPORT_MARGIN,
            Math.min(preferredLeft, availableRight - menuWidth),
        );

        setMenuPosition({
            left,
            top: rect.bottom + 5,
            width: menuWidth,
        });
    }, [isOpen]);

    useLayoutEffect(() => {
        if (!isOpen) {
            setMenuPosition(undefined);
            return undefined;
        }

        updateMenuPosition();
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);

        return () => {
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
        };
    }, [isOpen, updateMenuPosition]);

    const updateSelection = (item) => {
        if (selection.includes(item)) setSelection((prev) => prev.filter((it) => it !== item));
        else setSelection((prev) => [...prev, item]);
    };

    const resetFilters = () => {
        setSearchTerm('');
        setSelectedApp(DEFAULT_APP_SCOPE);
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setSelectedTags([]);
    };

    const clearSelectionAndClose = () => {
        resetFilters();
        setSelection([]);
        setIsOpen(false);
    };

    const apps = sortedUnique(searches.map((search) => search.dispatchContext));

    const appScopedSearches = searches.filter(
        (search) => selectedApp === ALL_APPS || search.dispatchContext === selectedApp,
    );

    const categories = sortedUnique(appScopedSearches.map((search) => search.category));

    const subCategories =
        selectedCategory === ALL_CATEGORIES
            ? []
            : sortedUnique(
                  appScopedSearches
                      .filter((search) => search.category === selectedCategory)
                      .map((search) => search.subCategory),
              );

    const facetFilteredSearches = appScopedSearches.filter((search) => {
        if (selectedCategory !== ALL_CATEGORIES && search.category !== selectedCategory)
            return false;
        if (
            selectedSubCategory !== ALL_SUB_CATEGORIES &&
            search.subCategory !== selectedSubCategory
        )
            return false;
        return true;
    });

    const availableTags = sortedUnique(
        facetFilteredSearches.flatMap((search) => search.tags || []),
    );

    const filteredSearches = facetFilteredSearches.filter((search) => {
        if (selectedTags.some((tag) => !(search.tags || []).includes(tag))) return false;

        const query = searchTerm.trim().toLowerCase();
        if (!query) return true;

        const haystack = [
            search.searchName,
            search.id,
            search.category,
            search.subCategory,
            search.dispatchContext,
            plainTextFromHtml(search.description || ''),
            ...(search.tags || []),
        ]
            .join('\n')
            .toLowerCase();

        return haystack.includes(query);
    });

    const sortedSearches = [...filteredSearches].sort((left, right) =>
        left.searchName.localeCompare(right.searchName, undefined, { sensitivity: 'base' }),
    );

    const selectedFilteredSearches = sortedSearches.map((search) => search.id);
    const hasActiveFilters =
        searchTerm.trim() ||
        selectedApp !== DEFAULT_APP_SCOPE ||
        selectedCategory !== ALL_CATEGORIES ||
        selectedSubCategory !== ALL_SUB_CATEGORIES ||
        selectedTags.length > 0;

    return (
        <>
            <Modal open={confirmationOpen}>
                <Modal.Header title="Large KPI Selection - Confirmation Required" />
                <Modal.Body>
                    <div>
                        You are about to add <b>{selection.length} KPIs</b>.
                        <br />
                        This is a large number and may cause performance issues due to loading all
                        KPI searches and visualizations at the same time.
                        <br />
                        <br />
                        <b>Confirmation is required before proceeding.</b>
                        <br />
                        Do you want to continue?
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <div style={{ display: 'flex', justifyContent: 'end', minWidth: 800 }}>
                        <Button
                            appearance="default"
                            label="No"
                            onClick={() => {
                                setConfirmationOpen(false);
                            }}
                            style={{ maxWidth: 125, marginLeft: 10, marginRight: 20 }}
                        />
                        <Button
                            appearance="primary"
                            label="Yes"
                            style={{ maxWidth: 125 }}
                            onClick={() => {
                                setConfirmationOpen(false);
                                resetFilters();
                                onSelect(selection);
                                setSelection([]);
                                setIsOpen(false);
                            }}
                        />
                    </div>
                </Modal.Footer>
            </Modal>
            <div ref={dropdownRef} className="dropdown" style={style}>
                <Button
                    appearance={appearance}
                    onClick={() => setIsOpen(!isOpen)}
                    label={label}
                    icon={icon}
                />

                {isOpen && (
                    <div
                        className="dropdown-menu dropdown-kpi-menu"
                        style={
                            menuPosition
                                ? {
                                      left: menuPosition.left,
                                      marginLeft: 0,
                                      position: 'fixed',
                                      top: menuPosition.top,
                                      width: menuPosition.width,
                                  }
                                : undefined
                        }
                    >
                        <div className="dropdown-kpi-filter-shell">
                            <Text
                                className="dropdown-search dropdown-kpi-search"
                                placeholder={`Search ${searches.length} KPIs by name, category, sub-category, app, or tag...`}
                                value={searchTerm}
                                onChange={(e, { value }) => setSearchTerm(value)}
                            />

                            <div className="dropdown-kpi-filters">
                                <Select
                                    value={selectedApp}
                                    onChange={(e, { value }) => {
                                        setSelectedApp(value);
                                        setSelectedCategory(ALL_CATEGORIES);
                                        setSelectedSubCategory(ALL_SUB_CATEGORIES);
                                        setSelectedTags([]);
                                    }}
                                >
                                    <Select.Option
                                        label={`All apps (${apps.length})`}
                                        value={ALL_APPS}
                                    />
                                    {apps.map((app) => (
                                        <Select.Option key={app} label={app} value={app} />
                                    ))}
                                    {!apps.includes(DEFAULT_APP_SCOPE) && (
                                        <Select.Option
                                            label={DEFAULT_APP_SCOPE}
                                            value={DEFAULT_APP_SCOPE}
                                        />
                                    )}
                                </Select>

                                <Select
                                    value={selectedCategory}
                                    onChange={(e, { value }) => {
                                        setSelectedCategory(value);
                                        setSelectedSubCategory(ALL_SUB_CATEGORIES);
                                        setSelectedTags([]);
                                    }}
                                >
                                    <Select.Option label="All categories" value={ALL_CATEGORIES} />
                                    {categories.map((category) => (
                                        <Select.Option
                                            key={category}
                                            label={category}
                                            value={category}
                                        />
                                    ))}
                                </Select>

                                <Select
                                    disabled={selectedCategory === ALL_CATEGORIES}
                                    value={selectedSubCategory}
                                    onChange={(e, { value }) => {
                                        setSelectedSubCategory(value);
                                        setSelectedTags([]);
                                    }}
                                >
                                    <Select.Option
                                        label={
                                            selectedCategory === ALL_CATEGORIES
                                                ? 'Select category first'
                                                : `All sub-categories (${subCategories.length})`
                                        }
                                        value={ALL_SUB_CATEGORIES}
                                    />
                                    {subCategories.map((subCategory) => (
                                        <Select.Option
                                            key={subCategory}
                                            label={subCategory}
                                            value={subCategory}
                                        />
                                    ))}
                                </Select>

                                <Multiselect
                                    values={selectedTags}
                                    onChange={(e, { values }) => {
                                        setSelectedTags(values || []);
                                    }}
                                    placeholder="Filter by tags"
                                    inline
                                >
                                    {availableTags.map((tag) => (
                                        <Multiselect.Option key={tag} label={tag} value={tag} />
                                    ))}
                                </Multiselect>
                            </div>

                            <div className="dropdown-kpi-filter-summary">
                                <span>
                                    {sortedSearches.length} of {searches.length} KPIs
                                </span>
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        className="dropdown-kpi-clear-button"
                                        onClick={resetFilters}
                                    >
                                        Clear filters
                                    </button>
                                )}
                            </div>
                        </div>

                        {sortedSearches.length > 0 && (
                            <div className="dropdown-kpi-select-all">
                                <button
                                    type="button"
                                    className="dropdown-kpi-select-all-button"
                                    onClick={() => {
                                        if (!equalArrays(selectedFilteredSearches, selection)) {
                                            setSelection(selectedFilteredSearches);
                                        } else {
                                            setSelection([]);
                                        }
                                    }}
                                >
                                    {equalArrays(selection, selectedFilteredSearches)
                                        ? 'Unselect all'
                                        : 'Select all'}
                                </button>
                            </div>
                        )}

                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            <ul className="dropdown-list">
                                {sortedSearches.map((search) => (
                                    <DropdownItem
                                        key={search.id}
                                        label={search.searchName}
                                        value={search.id}
                                        category={search.category}
                                        subCategory={search.subCategory}
                                        app={search.dispatchContext}
                                        tags={search.tags || []}
                                        icon={getVizIcon(search.defaultViz)}
                                        updateSelection={updateSelection}
                                        selection={selection}
                                    />
                                ))}
                                {sortedSearches.length === 0 && (
                                    <li className="dropdown-empty">
                                        No KPIs match the current filters.
                                    </li>
                                )}
                            </ul>
                        </div>
                        <div className="dropdown-kpi-footer">
                            <Button
                                style={{ minWidth: 80, marginRight: 10 }}
                                label="Cancel"
                                appearance="default"
                                onClick={clearSelectionAndClose}
                            />
                            <Button
                                disabled={selection.length === 0}
                                style={{ minWidth: 80 }}
                                label="Add"
                                appearance="primary"
                                onClick={() => {
                                    if (selection.length < 20) {
                                        resetFilters();
                                        onSelect(selection);
                                        setSelection([]);
                                        setIsOpen(false);
                                    } else {
                                        setConfirmationOpen(true);
                                    }
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export function DropdownItem({
    label,
    value,
    icon,
    updateSelection,
    selection,
    category,
    subCategory,
    app,
    tags = [],
}) {
    return (
        <li
            className="dropdown-item dropdown-kpi-item"
            onClick={() => {
                updateSelection(value);
            }}
        >
            <div style={{ display: 'flex' }}>
                <Checkbox checked={selection.includes(value)} style={{ marginRight: 10 }} />
                {icon && <span className="dropdown-icon">{icon}</span>}
                <div className="dropdown-kpi-item-copy">
                    <span className="dropdown-kpi-item-title">{label}</span>
                    <span className="dropdown-kpi-item-id">{value}</span>
                    <span className="dropdown-kpi-item-meta">
                        {[category, subCategory, app].filter(Boolean).join(' / ')}
                    </span>
                    {tags.length > 0 && (
                        <span className="dropdown-kpi-row-tags">
                            {tags.slice(0, 4).map((tag) => (
                                <span key={`${value}-${tag}`} className="dropdown-kpi-row-tag">
                                    {tag}
                                </span>
                            ))}
                        </span>
                    )}
                </div>
            </div>
        </li>
    );
}
