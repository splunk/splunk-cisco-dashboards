import React, { useState, cloneElement } from 'react';
import '../../common/styles/commonstyles.css';
import Button from '@splunk/react-ui/Button';
import Select from '@splunk/react-ui/Select';
import Checkbox from '@splunk/react-ui/Checkbox';
import Search from '@splunk/react-ui/Search';
import Text from '@splunk/react-ui/Text';
import ChartSingleValue from '@splunk/react-icons/ChartSingleValue';
import ChartPie from '@splunk/react-icons/ChartPie';
import ChartLine from '@splunk/react-icons/ChartLine';
import ChartArea from '@splunk/react-icons/ChartArea';
import ChartBar from '@splunk/react-icons/ChartBar';
import TableList from '@splunk/react-icons/TableList';
import ChartSingleValueRadial from '@splunk/react-icons/ChartSingleValueRadial';
import ChartColumn from '@splunk/react-icons/ChartColumn';
import TooltipWithTheme from '@splunk/react-ui/Tooltip';
import Link from '@splunk/react-ui/Link';
import Modal from '@splunk/react-ui/Modal';

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

export default function DropdownWithSearch({
    label,
    icon,
    appearance,
    style,
    children,
    onSelect,
    tags,
    searches,
}) {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchTag, setSearchTag] = useState(undefined);
    const [isOpen, setIsOpen] = useState(false);
    const [selection, setSelection] = useState([]);
    const [confirmationOpen, setConfirmationOpen] = useState(false);

    const updateSelection = (item) => {
        if (selection.includes(item)) setSelection((prev) => prev.filter((it) => it != item));
        else setSelection((prev) => [...prev, item]);
    };

    return (
        <>
            <Modal open={confirmationOpen}>
                <Modal.Header title="Large KPI Selection – Confirmation Required" />
                <Modal.Body>
                    <div>
                        You are about to add <b>{selection.length} KPIs</b>.
                        <br />
                        This is a large number and may cause performance issues due to loading all
                        KPI's searches and visualizations at the same time.
                        <br />
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
                        ></Button>
                        <Button
                            appearance="primary"
                            label="Yes"
                            style={{ maxWidth: 125 }}
                            onClick={() => {
                                setConfirmationOpen(true);
                                setSearchTag(undefined);
                                setSearchTerm('');
                                onSelect(selection);
                                setSelection([]);
                                setIsOpen(false);
                            }}
                        ></Button>
                    </div>
                </Modal.Footer>
            </Modal>
            <div className="dropdown" style={style}>
                {/* Dropdown Button */}
                <Button
                    appearance={appearance}
                    onClick={() => setIsOpen(!isOpen)}
                    label={label}
                    icon={icon}
                ></Button>

                {isOpen && (
                    <div className="dropdown-menu">
                        {/* Search Input */}
                        <div
                            style={{
                                padding: 10,
                                borderBottom: '1px solid #dcdcdc',
                                display: 'flex',
                                alignContent: 'flex-end',
                            }}
                        >
                            <Text
                                className="dropdown-search"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e, { value }) => setSearchTerm(value)}
                            />
                            <Select
                                placeholder="Select a tag"
                                value={searchTag}
                                onChange={(e, { value }) => {
                                    setSearchTag(value);
                                }}
                                style={{ maxHeight: 30, marginTop: 10, minWidth: 120 }}
                            >
                                {tags.map((tag) => (
                                    <Select.Option label={tag} value={tag}></Select.Option>
                                ))}
                            </Select>
                        </div>

                        {searchTag &&
                            searches.filter((search) => {
                                let filter = true;
                                if (searchTag) filter = search.content.tags.includes(searchTag);
                                if (searchTerm)
                                    filter = search.content.search_name
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase());

                                return filter;
                            }).length > 0 && (
                                <div
                                    style={{
                                        padding: 5,
                                        borderBottom: '1px solid #dcdcdc',
                                    }}
                                >
                                    <a
                                        style={{
                                            marginLeft: 10,
                                            cursor: 'pointer',
                                            color: '#0064d7',
                                        }}
                                        onClick={() => {
                                            const selected = searches
                                                .filter((search) => {
                                                    let filter = true;
                                                    if (searchTag)
                                                        filter =
                                                            search.content.tags.includes(searchTag);
                                                    if (searchTerm)
                                                        filter = search.content.search_name
                                                            .toLowerCase()
                                                            .includes(searchTerm.toLowerCase());

                                                    return filter;
                                                })
                                                .map((s) => s.name);
                                            if (!equalArrays(selected, selection)) {
                                                setSelection(selected);
                                            } else {
                                                setSelection([]);
                                            }
                                        }}
                                    >
                                        {equalArrays(
                                            selection,
                                            searches
                                                .filter((search) => {
                                                    let filter = true;
                                                    if (searchTag)
                                                        filter =
                                                            search.content.tags.includes(searchTag);
                                                    if (searchTerm)
                                                        filter = search.content.search_name
                                                            .toLowerCase()
                                                            .includes(searchTerm.toLowerCase());

                                                    return filter;
                                                })
                                                .map((s) => s.name),
                                        )
                                            ? 'Unselect all'
                                            : 'Select all'}
                                    </a>
                                </div>
                            )}
                        {/* Filtered Items */}
                        <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                            <ul className="dropdown-list">
                                {searches
                                    .filter((search) => {
                                        let filter = true;
                                        if (searchTag)
                                            filter = search.content.tags.includes(searchTag);
                                        if (searchTerm)
                                            filter = search.content.search_name
                                                .toLowerCase()
                                                .includes(searchTerm.toLowerCase());

                                        return filter;
                                    })
                                    .map((search) => (
                                        <DropdownItem
                                            label={search.content.search_name}
                                            value={search.name}
                                            tags={
                                                search.content.tags
                                                    ? search.content.tags.split(',')
                                                    : []
                                            }
                                            icon={
                                                search.content.default_viz ? (
                                                    search.content.default_viz.includes('table') ? (
                                                        <TableList
                                                            width={20}
                                                            height={20}
                                                        ></TableList>
                                                    ) : search.content.default_viz.includes(
                                                          'bar',
                                                      ) ? (
                                                        <ChartBar width={20} height={20}></ChartBar>
                                                    ) : search.content.default_viz.includes(
                                                          'line',
                                                      ) ? (
                                                        <ChartLine
                                                            width={20}
                                                            height={20}
                                                        ></ChartLine>
                                                    ) : search.content.default_viz.includes(
                                                          'area',
                                                      ) ? (
                                                        <ChartArea
                                                            width={20}
                                                            height={20}
                                                        ></ChartArea>
                                                    ) : search.content.default_viz.includes(
                                                          'column',
                                                      ) ? (
                                                        <ChartColumn
                                                            width={20}
                                                            height={20}
                                                        ></ChartColumn>
                                                    ) : search.content.default_viz.includes(
                                                          'pie',
                                                      ) ? (
                                                        <ChartPie width={20} height={20}></ChartPie>
                                                    ) : search.content.default_viz.includes(
                                                          'singlevalueradial',
                                                      ) ? (
                                                        <ChartSingleValueRadial
                                                            width={20}
                                                            height={20}
                                                        ></ChartSingleValueRadial>
                                                    ) : (
                                                        <ChartSingleValue
                                                            width={20}
                                                            height={20}
                                                        ></ChartSingleValue>
                                                    )
                                                ) : (
                                                    <TableList width={20} height={20}></TableList>
                                                )
                                            }
                                            updateSelection={updateSelection}
                                            selection={selection}
                                        ></DropdownItem>
                                    ))}
                            </ul>
                        </div>
                        <div
                            style={{
                                padding: 10,
                                borderTop: '1px solid #dcdcdc',
                                display: 'flex',
                                alignContent: 'flex-end',
                            }}
                        >
                            <Button
                                style={{ minWidth: 80, marginRight: 10 }}
                                label="Cancel"
                                appearance="default"
                                onClick={() => {
                                    setSearchTag(undefined);
                                    setSearchTerm('');
                                    setSelection([]);
                                    setIsOpen(false);
                                }}
                            ></Button>
                            <Button
                                disabled={selection.length == 0}
                                style={{ minWidth: 80 }}
                                label="Add"
                                appearance="primary"
                                onClick={() => {
                                    if (selection.length < 20) {
                                        setSearchTag(undefined);
                                        setSearchTerm('');
                                        onSelect(selection);
                                        setSelection([]);
                                        setIsOpen(false);
                                    } else {
                                        setConfirmationOpen(true);
                                    }
                                }}
                            ></Button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// Dropdown Item Component
export function DropdownItem({ label, value, icon, updateSelection, selection }) {
    return (
        <li
            className="dropdown-item"
            onClick={() => {
                updateSelection(value);
            }}
        >
            <div style={{ display: 'flex' }}>
                <Checkbox
                    checked={selection.includes(value)}
                    style={{ marginRight: 10 }}
                ></Checkbox>
                {icon && <span className="dropdown-icon">{icon}</span>}
                <div style={{ display: 'grid' }}>
                    <span style={{ fontWeight: 'bold' }}>{label}</span>
                    <span style={{ fontSize: 11, color: 'gray' }}>{value}</span>
                </div>
            </div>
        </li>
    );
}
