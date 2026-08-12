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
import useSplunkTheme from '@splunk/themes/useSplunkTheme';
import { plainTextFromHtml } from '../../common/services/searchbaseCatalogue';

const ALL_APPS = '__all_apps__';
const ALL_CATEGORIES = '__all_categories__';
const ALL_SUB_CATEGORIES = '__all_sub_categories__';
const KPI_MENU_WIDTH = 620;
const MENU_VIEWPORT_MARGIN = 12;
const KPI_MENU_MAX_HEIGHT = 640;
const KPI_MENU_MIN_HEIGHT = 260;
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

const normalizeSearchKey = (value) => String(value || '').trim().toLowerCase();

const isTableSearch = (search) => normalizeSearchKey(search.defaultViz) === 'splunk.table';

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
    ariaLabel,
    className,
    style,
    onSelect,
    searches,
}) {
    const splunkTheme = useSplunkTheme();
    const colorScheme = splunkTheme.colorScheme === 'dark' ? 'dark' : 'light';
    const dropdownThemeStyle = {
        '--dashboard-builder-background-page': splunkTheme.backgroundColorPage,
        '--dashboard-builder-background-section': splunkTheme.backgroundColorSection,
        '--dashboard-builder-background-popup': splunkTheme.backgroundColorPopup,
        '--dashboard-builder-content-active': splunkTheme.contentColorActive,
        '--dashboard-builder-content-default': splunkTheme.contentColorDefault,
        '--dashboard-builder-content-inverted': splunkTheme.contentColorInverted,
        '--dashboard-builder-content-muted': splunkTheme.contentColorMuted,
        '--dashboard-builder-border': splunkTheme.borderColor,
        '--dashboard-builder-border-strong': splunkTheme.borderColorStrong,
        '--dashboard-builder-border-weak': splunkTheme.borderColorWeak,
        '--dashboard-builder-accent': splunkTheme.interactiveColorAccent,
        '--dashboard-builder-overlay-hover': splunkTheme.interactiveColorOverlayHover,
        '--dashboard-builder-overlay-selected': splunkTheme.interactiveColorOverlaySelected,
        '--dashboard-builder-modal-background': splunkTheme.backgroundColorPopup,
        '--dashboard-builder-modal-background-section': splunkTheme.backgroundColorSection,
        '--dashboard-builder-modal-content-active': splunkTheme.contentColorActive,
        '--dashboard-builder-modal-content-default': splunkTheme.contentColorDefault,
        '--dashboard-builder-modal-content-muted': splunkTheme.contentColorMuted,
        '--dashboard-builder-modal-border': splunkTheme.borderColor,
        '--dashboard-builder-modal-border-strong': splunkTheme.borderColorStrong,
        '--dashboard-builder-modal-border-weak': splunkTheme.borderColorWeak,
        '--dashboard-builder-modal-overlay-hover': splunkTheme.interactiveColorOverlayHover,
        '--dashboard-builder-modal-overlay-selected': splunkTheme.interactiveColorOverlaySelected,
    };
    const dropdownRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedApp, setSelectedApp] = useState(ALL_APPS);
    const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
    const [selectedSubCategory, setSelectedSubCategory] = useState(ALL_SUB_CATEGORIES);
    const [selectedTags, setSelectedTags] = useState([]);
    const [includeHiddenSearches, setIncludeHiddenSearches] = useState(false);
    const [includeDrilldownSearches, setIncludeDrilldownSearches] = useState(false);
    const [includeTableSearches, setIncludeTableSearches] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState(undefined);
    const [selection, setSelection] = useState([]);
    const [confirmationOpen, setConfirmationOpen] = useState(false);

    const updateMenuPosition = useCallback(() => {
        if (!isOpen || !dropdownRef.current) return;

        const rect = dropdownRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
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
        const spaceBelow = viewportHeight - rect.bottom - MENU_VIEWPORT_MARGIN;
        const spaceAbove = rect.top - MENU_VIEWPORT_MARGIN;
        const openAbove = spaceBelow < KPI_MENU_MIN_HEIGHT && spaceAbove > spaceBelow;
        const availableHeight = openAbove ? spaceAbove : spaceBelow;
        const height = Math.max(180, Math.min(KPI_MENU_MAX_HEIGHT, availableHeight));

        setMenuPosition({
            left,
            top: openAbove ? Math.max(MENU_VIEWPORT_MARGIN, rect.top - height - 5) : rect.bottom + 5,
            width: menuWidth,
            height,
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
        setSelectedApp(ALL_APPS);
        setSelectedCategory(ALL_CATEGORIES);
        setSelectedSubCategory(ALL_SUB_CATEGORIES);
        setSelectedTags([]);
        setIncludeHiddenSearches(false);
        setIncludeDrilldownSearches(false);
        setIncludeTableSearches(false);
    };

    const clearSelectionAndClose = () => {
        resetFilters();
        setSelection([]);
        setIsOpen(false);
    };

    const drilldownSearchNames = new Set(
        searches
            .flatMap((search) => search.drilldownSearchNames || [search.drilldownSearchName])
            .filter(Boolean)
            .map(normalizeSearchKey),
    );

    const visibilityFilteredSearches = searches.filter((search) => {
        if (!includeHiddenSearches && search.searchHidden) return false;

        const isDrilldownSearch =
            drilldownSearchNames.has(normalizeSearchKey(search.searchName)) ||
            drilldownSearchNames.has(normalizeSearchKey(search.id));
        if (!includeDrilldownSearches && isDrilldownSearch) return false;

        if (!includeTableSearches && isTableSearch(search)) return false;

        return true;
    });

    const apps = sortedUnique(visibilityFilteredSearches.map((search) => search.catalogueApp));

    const appScopedSearches = visibilityFilteredSearches.filter(
        (search) => selectedApp === ALL_APPS || search.catalogueApp === selectedApp,
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

    const query = searchTerm.trim().toLowerCase();
    const queryFilteredSearches = facetFilteredSearches.filter((search) => {
        if (!query) {
            return true;
        }
        const haystack = [
            search.searchName,
            search.id,
            search.category,
            search.subCategory,
            search.catalogueApp,
            plainTextFromHtml(search.description || ''),
            plainTextFromHtml(search.explanation || ''),
            search.search,
            ...(search.drilldownSearchNames || [search.drilldownSearchName]),
            search.defaultViz,
            ...(search.tags || []),
        ]
            .join('\n')
            .toLowerCase();

        return haystack.includes(query);
    });

    // Tags are an AND facet. Build their choices from the searches that match
    // every filter already applied, including the currently selected tags.
    // This prevents the picker from offering a next tag that would reduce the
    // result set to zero, while removing a tag immediately broadens the list.
    const filteredSearches = queryFilteredSearches.filter(
        (search) => !selectedTags.some((tag) => !(search.tags || []).includes(tag)),
    );

    const availableTags = sortedUnique(
        filteredSearches.flatMap((search) => search.tags || []),
    );

    const sortedSearches = [...filteredSearches].sort((left, right) =>
        left.searchName.localeCompare(right.searchName, undefined, { sensitivity: 'base' }),
    );

    const selectedFilteredSearches = sortedSearches.map((search) => search.id);
    const hasActiveFilters =
        searchTerm.trim() ||
        selectedApp !== ALL_APPS ||
        selectedCategory !== ALL_CATEGORIES ||
        selectedSubCategory !== ALL_SUB_CATEGORIES ||
        selectedTags.length > 0 ||
        includeHiddenSearches ||
        includeDrilldownSearches ||
        includeTableSearches;

    const activeFilterCount = [
        searchTerm.trim(),
        selectedApp !== ALL_APPS,
        selectedCategory !== ALL_CATEGORIES,
        selectedSubCategory !== ALL_SUB_CATEGORIES,
        selectedTags.length > 0,
        includeHiddenSearches,
        includeDrilldownSearches,
        includeTableSearches,
    ].filter(Boolean).length;

    const applySelection = () => {
        resetFilters();
        onSelect(selection);
        setSelection([]);
        setIsOpen(false);
    };

    const commitSelection = () => {
        if (selection.length === 0) return;
        if (selection.length < 20) {
            applySelection();
            return;
        }
        setConfirmationOpen(true);
    };

    return (
        <>
            <Modal
                open={confirmationOpen}
                className={`dashboard-builder-themed-modal dashboard-builder-themed-modal-${colorScheme}`}
                style={dropdownThemeStyle}
            >
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
                                applySelection();
                            }}
                        />
                    </div>
                </Modal.Footer>
            </Modal>
            <div
                ref={dropdownRef}
                className={['dropdown', className].filter(Boolean).join(' ')}
                style={style}
            >
                <Button
                    appearance={appearance}
                    onClick={() => setIsOpen(!isOpen)}
                    label={label}
                    icon={icon}
                    aria-label={ariaLabel || label}
                />

                {isOpen && (
                    <div
                        className={`dropdown-menu dropdown-kpi-menu dropdown-kpi-menu-${colorScheme}`}
                        style={
                            menuPosition
                                ? {
                                      ...dropdownThemeStyle,
                                      left: menuPosition.left,
                                      marginLeft: 0,
                                      position: 'fixed',
                                      top: menuPosition.top,
                                      width: menuPosition.width,
                                      height: menuPosition.height,
                                  }
                                : dropdownThemeStyle
                        }
                    >
                        <div className="dropdown-kpi-filter-shell">
                            <Text
                                className="dropdown-search dropdown-kpi-search"
                                placeholder={`Search ${searches.length} KPIs by name, category, sub-category, app, or tag...`}
                                value={searchTerm}
                                onChange={(e, { value }) => setSearchTerm(value)}
                            />

                            <button
                                type="button"
                                className="dropdown-kpi-filter-toggle"
                                aria-expanded={filtersOpen}
                                onClick={() => setFiltersOpen((open) => !open)}
                            >
                                <span className="dropdown-kpi-filter-caret">
                                    {filtersOpen ? '^' : 'v'}
                                </span>
                                <span>Filters</span>
                                {activeFilterCount > 0 && (
                                    <span className="dropdown-kpi-filter-active">Active</span>
                                )}
                            </button>

                            {filtersOpen && (
                                <div className="dropdown-kpi-filter-panel">
                                    <label className="dropdown-kpi-filter-row">
                                        <span className="dropdown-kpi-filter-label">App</span>
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
                                        </Select>
                                    </label>

                                    <div className="dropdown-kpi-filter-row dropdown-kpi-filter-row-top">
                                        <span className="dropdown-kpi-filter-label">
                                            Visibility
                                        </span>
                                        <div className="dropdown-kpi-visibility-grid">
                                            <label className="dropdown-kpi-visibility-option">
                                                <input
                                                    type="checkbox"
                                                    checked={includeHiddenSearches}
                                                    onChange={(e) => {
                                                        setIncludeHiddenSearches(e.target.checked);
                                                        setSelectedTags([]);
                                                    }}
                                                />
                                                <span>Show hidden searches</span>
                                            </label>
                                            <label className="dropdown-kpi-visibility-option">
                                                <input
                                                    type="checkbox"
                                                    checked={includeDrilldownSearches}
                                                    onChange={(e) => {
                                                        setIncludeDrilldownSearches(
                                                            e.target.checked,
                                                        );
                                                        setSelectedTags([]);
                                                    }}
                                                />
                                                <span>Show drill-down searches</span>
                                            </label>
                                            <label className="dropdown-kpi-visibility-option">
                                                <input
                                                    type="checkbox"
                                                    checked={includeTableSearches}
                                                    onChange={(e) => {
                                                        setIncludeTableSearches(e.target.checked);
                                                        setSelectedTags([]);
                                                    }}
                                                />
                                                <span>Show table searches</span>
                                            </label>
                                        </div>
                                    </div>

                                    <label className="dropdown-kpi-filter-row">
                                        <span className="dropdown-kpi-filter-label">Category</span>
                                        <Select
                                            value={selectedCategory}
                                            onChange={(e, { value }) => {
                                                setSelectedCategory(value);
                                                setSelectedSubCategory(ALL_SUB_CATEGORIES);
                                                setSelectedTags([]);
                                            }}
                                        >
                                            <Select.Option
                                                label="All categories"
                                                value={ALL_CATEGORIES}
                                            />
                                            {categories.map((category) => (
                                                <Select.Option
                                                    key={category}
                                                    label={category}
                                                    value={category}
                                                />
                                            ))}
                                        </Select>
                                    </label>

                                    {selectedCategory !== ALL_CATEGORIES &&
                                        subCategories.length > 0 && (
                                            <label className="dropdown-kpi-filter-row">
                                                <span className="dropdown-kpi-filter-label">
                                                    Sub-cat
                                                </span>
                                                <Select
                                                    value={selectedSubCategory}
                                                    onChange={(e, { value }) => {
                                                        setSelectedSubCategory(value);
                                                        setSelectedTags([]);
                                                    }}
                                                >
                                                    <Select.Option
                                                        label={`All sub-categories (${subCategories.length})`}
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
                                            </label>
                                        )}

                                    <label className="dropdown-kpi-filter-row dropdown-kpi-filter-row-top">
                                        <span className="dropdown-kpi-filter-label">Tags</span>
                                        <Multiselect
                                            values={selectedTags}
                                            onChange={(e, { values }) => {
                                                setSelectedTags(values || []);
                                            }}
                                            placeholder={
                                                selectedTags.length === 0
                                                    ? `Filter by tag (${availableTags.length} available, AND combined)...`
                                                    : 'Add tag...'
                                            }
                                            inline
                                        >
                                            {availableTags.map((tag) => (
                                                <Multiselect.Option
                                                    key={tag}
                                                    label={tag}
                                                    value={tag}
                                                />
                                            ))}
                                        </Multiselect>
                                    </label>
                                </div>
                            )}

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

                        <div className="dropdown-kpi-selection-bar">
                            <span className="dropdown-kpi-selection-count">
                                {selection.length === 0
                                    ? 'Select one or more KPIs to add'
                                    : `${selection.length} KPI${
                                          selection.length === 1 ? '' : 's'
                                      } selected`}
                            </span>
                            <div className="dropdown-kpi-selection-actions">
                                <Button
                                    style={{ minWidth: 80 }}
                                    label="Cancel"
                                    appearance="default"
                                    onClick={clearSelectionAndClose}
                                />
                                <Button
                                    disabled={selection.length === 0}
                                    style={{ minWidth: 112 }}
                                    label="Add selected"
                                    appearance="primary"
                                    onClick={commitSelection}
                                />
                            </div>
                        </div>

                        <div className="dropdown-kpi-results">
                            <ul className="dropdown-list">
                                {sortedSearches.map((search) => (
                                    <DropdownItem
                                        key={search.id}
                                        label={search.searchName}
                                        value={search.id}
                                        category={search.category}
                                        subCategory={search.subCategory}
                                        app={search.catalogueApp}
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
