import React, { useEffect, useState, useRef, useCallback } from 'react';
import { BaseInput, withInputWrapper } from '@splunk/dashboard-inputs';
import ButtonGroup from '@splunk/react-ui/ButtonGroup';
import Button from '@splunk/react-ui/Button';
import get from 'lodash/get';
import isString from 'lodash/isString';
import isPlainObject from 'lodash/isPlainObject';
import some from 'lodash/some';
import {
    DEFAULT_SPAN,
    isValidTimeSpan,
    parseTimeRangeValue,
    toTimeRangeValue,
} from './timeRangeUtils';
import './SimpleTimePicker.css';
import CalendarClock from '@splunk/react-icons/CalendarClock';
import SlidersDoubleHorizontal from '@splunk/react-icons/SlidersDoubleHorizontal';
import Dropdown from '@splunk/react-ui/Dropdown';
import TimeRangeDropdown from '@splunk/react-time-range/Dropdown';
import Modal from '@splunk/react-ui/Modal';
import ControlGroup from '@splunk/react-ui/ControlGroup';
import Text from '@splunk/react-ui/Text';
import { makeCancelable } from '@splunk/ui-utils/promise';
import timeParser from './timeparser';

const locale = 'en_US';

const presets = [
    { label: '30 second window', earliest: 'rt-30s', latest: 'rt' },
    { label: '1 minute window', earliest: 'rt-1m', latest: 'rt' },
    { label: '5 minute window', earliest: 'rt-5m', latest: 'rt' },
    { label: '30 minute window', earliest: 'rt-30m', latest: 'rt' },
    { label: '1 hour window', earliest: 'rt-1h', latest: 'rt' },
    { label: 'All time (real-time)', earliest: 'rt', latest: 'rt' },
    { label: 'Today', earliest: '@d', latest: 'now' },
    { label: 'Week to date', earliest: '@w0', latest: 'now' },
    { label: 'Business week to date', earliest: '@w1', latest: 'now' },
    { label: 'Month to date', earliest: '@mon', latest: 'now' },
    { label: 'Year to date', earliest: '@y', latest: 'now' },
    { label: 'Yesterday', earliest: '-1d@d', latest: '@d' },
    { label: 'Previous week', earliest: '-7d@w0', latest: '@w0' },
    { label: 'Previous business week', earliest: '-6d@w1', latest: '-1d@w6' },
    { label: 'Previous month', earliest: '-1mon@mon', latest: '@mon' },
    { label: 'Previous year', earliest: '-1y@y', latest: '@y' },
    { label: 'Last 15 minutes', earliest: '-15m', latest: 'now' },
    { label: 'Last 60 minutes', earliest: '-60m@m', latest: 'now' },
    { label: 'Last 4 hours', earliest: '-4h@m', latest: 'now' },
    { label: 'Last 24 hours', earliest: '-24h@h', latest: 'now' },
    { label: 'Last 7 days', earliest: '-7d@h', latest: 'now' },
    { label: 'Last 30 days', earliest: '-30d@d', latest: 'now' },
    { label: 'All time', earliest: '0', latest: '' },
];

const SimpleTimePicker = ({ id, options, value, onValueChange }) => {
    const [openAdvancedModal, setopenAdvancedModal] = useState(false);
    const { earliest, latest, span } = parseTimeRangeValue(value);
    const [advancedTR, setAdvancedTR] = useState({
        earliest: earliest,
        latest: latest,
        span: span,
    });
    const [parseEarliest, setParseEarliest] = useState();
    const [parseLatest, setParseLatest] = useState();

    let cancelableEarliestTimeParserRef = useRef(null);
    let cancelableLatestTimeParserRef = useRef(null);

    // Presets and validated Advanced ranges are discrete submissions. Forward
    // the event synchronously, matching Studio's native time input contract.
    const handleChange = useCallback(
        (e, payload) => onValueChange(e, payload.value),
        [onValueChange]
    );
    // If selections are not provided, use the default options as the selections
    const selections =
        options.selections && options.selections.length > 1
            ? options.selections
            : [
                  {
                      value: '-24h@h,now,auto',
                      label: '24h',
                  },
                  {
                      value: '-7d@d,now,auto',
                      label: '7d',
                  },
                  {
                      value: '-30d@d,now,auto',
                      label: '30d',
                  },
                  {
                      value: '-90d@d,now,auto',
                      label: '90d',
                  },
                  {
                      value: '-365d@d,now,auto',
                      label: '1y',
                  },
              ];

    const showAdvanced =
        options.showAdvanced == undefined || options.showAdvanced == false ? false : true;
    /*options.selections && options.selections.length > 1
            ? options.selections
            : [DEFAULT_OPTIONS];*/

    // If default value is not provided or not part of the selections, select the first one
    const defaultValue =
        options.defaultValue != null &&
        options.defaultValue.length > 0 &&
        some(selections, { value: options.defaultValue })
            ? options.defaultValue
            : selections[0].value;

    // Use default value if no value is specified
    const selected =
        value != null && value.length > 0 //&& some(selections, { value: value })
            ? value
            : defaultValue;
    const isQuickSelection = selections.some((selection) => selection.value === selected);
    const isAdvancedSpanValid = isValidTimeSpan(advancedTR.span);

    useEffect(() => {
        if (!openAdvancedModal) {
            setAdvancedTR(parseTimeRangeValue(selected));
        }
    }, [openAdvancedModal, selected]);

    const handleTRChange = (e, newValues) => {
        e.stopPropagation();
        e.preventDefault();
        cancelParse();
        setAdvancedTR((prev) => ({
            ...prev,
            earliest: newValues.earliest,
            latest: newValues.latest,
        }));
    };

    const handleCloseAdvancedModal = () => {
        setopenAdvancedModal(false);
    };

    const cancelParse = () => {
        if (cancelableEarliestTimeParserRef.current) {
            cancelableEarliestTimeParserRef.current.cancel();
        }
        if (cancelableLatestTimeParserRef.current) {
            cancelableLatestTimeParserRef.current.cancel();
        }
    };

    useEffect(() => {
        return () => {
            if (cancelableEarliestTimeParserRef.current) {
                cancelableEarliestTimeParserRef.current.cancel();
            }
            if (cancelableLatestTimeParserRef.current) {
                cancelableLatestTimeParserRef.current.cancel();
            }
        };
    }, []);

    const handleRequestParseEarliest = useCallback((time) => {
        if (cancelableEarliestTimeParserRef.current) {
            cancelableEarliestTimeParserRef.current.cancel();
        }

        const cancelable = makeCancelable(timeParser(time, locale));
        cancelableEarliestTimeParserRef.current = cancelable;

        cancelable.promise
            .then(({ error, iso }) => {
                setParseEarliest((prev) => {
                    if (prev?.iso === iso && prev?.time === time) return prev;
                    return { error, iso, time };
                });
            })
            .catch((err) => {
                if (!err?.isCanceled) console.error(err);
            });
    }, []);

    const handleRequestParseLatest = useCallback((time) => {
        if (cancelableLatestTimeParserRef.current) {
            cancelableLatestTimeParserRef.current.cancel();
        }

        const cancelable = makeCancelable(timeParser(time, locale));
        cancelableLatestTimeParserRef.current = cancelable;

        cancelable.promise
            .then(({ error, iso }) => {
                setParseLatest((prev) => {
                    if (prev?.iso === iso && prev?.time === time) return prev;
                    return { error, iso, time };
                });
            })
            .catch((err) => {
                if (!err?.isCanceled) console.error(err);
            });
    }, []);

    return (
        <>
            <Modal
                open={openAdvancedModal}
                onRequestClose={handleCloseAdvancedModal}
                style={{ zIndex: 1050 }}
            >
                <Modal.Header title="Advanced time range" />
                <Modal.Body>
                    <ControlGroup label="Time range" labelPosition="left">
                        <TimeRangeDropdown
                            onChange={handleTRChange}
                            earliest={advancedTR.earliest}
                            latest={advancedTR.latest}
                            realTimeDisabled
                            presets={presets}
                            onRequestParseEarliest={handleRequestParseEarliest}
                            onRequestParseLatest={handleRequestParseLatest}
                            parseEarliest={parseEarliest}
                            parseLatest={parseLatest}
                            //advancedInputTypes={['relative', 'allTime', 'dateTime']}
                        />
                    </ControlGroup>
                    <ControlGroup
                        label="Span"
                        labelPosition="left"
                        help="Auto lets timechart choose. Or enter 1m, 5m, 1h, 1d, 1w, 1mon, 1qtr, or 1y."
                    >
                        <Text
                            style={{ zIndex: 9999 }}
                            value={advancedTR.span === DEFAULT_SPAN ? 'Auto' : advancedTR.span}
                            onChange={(e, { value }) => {
                                e.stopPropagation();
                                e.preventDefault();

                                setAdvancedTR((prev) => ({ ...prev, span: value }));
                            }}
                        ></Text>
                    </ControlGroup>
                </Modal.Body>
                <Modal.Footer>
                    <Button label="Close" onClick={handleCloseAdvancedModal} appearance="default" />
                    <Button
                        label="Validate"
                        disabled={!isAdvancedSpanValid}
                        onClick={(e) => {
                            const payload = {
                                value: toTimeRangeValue(advancedTR),
                            };
                            handleChange(e, payload);
                            setopenAdvancedModal(false);
                        }}
                        appearance="primary"
                    />
                </Modal.Footer>
            </Modal>
            <ButtonGroup id={id} className={showAdvanced ? 'trshowadvanced' : ''}>
                {selections.map((s) => (
                    <Button
                        appearance="toggle"
                        key={s.value}
                        value={s.value}
                        selected={selected === s.value}
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            // Bind the selected range directly; toolkit click
                            // metadata is not the dashboard input value contract.
                            handleChange(e, { value: s.value });
                        }}
                        style={{
                            minWidth: '60px',
                            background: selected === s.value ? '#cccccc' : '#fcfcfc',
                        }}
                    >
                        {s.label}
                    </Button>
                ))}
                {showAdvanced && (
                    <Button
                        aria-label="Advanced time range"
                        appearance="toggle"
                        key="advancedTR"
                        value="advancedTR"
                        selected={!isQuickSelection}
                        onClick={(e, payload) => {
                            e.preventDefault();
                            e.stopPropagation();
                            //handleChange(e, payload);
                            setopenAdvancedModal(true);
                        }}
                        style={{
                            minWidth: '60px',
                            background: isQuickSelection ? '#fcfcfc' : '#cccccc',
                        }}
                    >
                        <SlidersDoubleHorizontal aria-hidden="true" />
                    </Button>
                )}
            </ButtonGroup>
        </>
    );
};

SimpleTimePicker.defaultProps = {
    ...BaseInput.defaultProps,
};

SimpleTimePicker.valueToTokens = (value, meta) => {
    if (!isPlainObject(meta)) {
        return {};
    }
    const { token } = meta;
    if (!token || !isString(token)) {
        return {};
    }
    const { earliest, latest, span } = parseTimeRangeValue(value);
    return {
        [`${token}.earliest`]: earliest,
        [`${token}.latest`]: latest,
        [`${token}.span`]: span,
    };
};

SimpleTimePicker.tokensToValue = ({ tokens, tokenName, tokenNamespace }) => {
    if (!tokens || !tokenName || !tokenNamespace) {
        return null;
    }
    const earliest = get(tokens, [tokenNamespace, `${tokenName}.earliest`]);
    const latest = get(tokens, [tokenNamespace, `${tokenName}.latest`]);
    const span = get(tokens, [tokenNamespace, `${tokenName}.span`]);
    return earliest && latest ? toTimeRangeValue({ earliest, latest, span }) : null;
};

SimpleTimePicker.config = {
    label: 'Simple Time range',
    description: 'Quickly select a daily, monthly, quarterly, or yearly time range.',
    baseShape: {
        options: {
            showAdvanced: false,
            selections: [
                {
                    value: '-24h@h,now,auto',
                    label: '24h',
                },
                {
                    value: '-7d@d,now,auto',
                    label: '7d',
                },
                {
                    value: '-30d@d,now,auto',
                    label: '30d',
                },
                {
                    value: '-90d@d,now,auto',
                    label: '90d',
                },
                {
                    value: '-365d@d,now,auto',
                    label: '1y',
                },
            ],
        },
        title: 'Simple Time range ',
    },
    tokenPrefix: 'tr',
    icon: CalendarClock,
};

export default withInputWrapper(SimpleTimePicker);
