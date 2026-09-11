import React, { memo, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import SplunkVisualization from '@splunk/visualizations/common/SplunkVisualization';
import { Map as MapIcon } from '@splunk/visualization-icons';
import { isEqual, reduce, intersection } from 'lodash-es';
import { normalizeSharedImageSource } from '../../../common/lib/imageSource';

const SAMPLE_FLOOR = {
    locationHierarchy: [
        { id: 'sample-campus', name: 'Cisco Spaces', type: 'campus' },
        { id: 'sample-building', name: 'OPS', type: 'network' },
        { id: 'sample-floor', name: 'First Floor', type: 'floor' },
    ],
    maps: [
        {
            name: 'OPS First Floor',
            source: 'Sample',
            unit: 'FEET',
            imageWidth: 1200,
            imageHeight: 620,
            width: 220,
            length: 120,
            zones: [
                {
                    locId: 'armadillo',
                    name: 'Armadillo',
                    type: 'POLYGON_ZONE',
                    color: '#43b6ff',
                    coordinates: [
                        '120,176,0',
                        '276,132,0',
                        '364,170,0',
                        '330,286,0',
                        '154,304,0',
                        '120,176,0',
                    ],
                    occupancy: 3,
                    capacity: 95,
                },
                {
                    locId: 'pelican',
                    name: 'Pelican',
                    type: 'POLYGON_ZONE',
                    color: '#62d6a4',
                    coordinates: [
                        '326,116,0',
                        '514,104,0',
                        '556,224,0',
                        '394,264,0',
                        '326,116,0',
                    ],
                    occupancy: 2,
                    capacity: 120,
                },
                {
                    locId: 'key-deer',
                    name: 'Key Deer',
                    type: 'POLYGON_ZONE',
                    color: '#ffd166',
                    coordinates: [
                        '504,214,0',
                        '704,184,0',
                        '744,334,0',
                        '548,358,0',
                        '504,214,0',
                    ],
                    occupancy: 4,
                    capacity: 210,
                },
                {
                    locId: 'dolphin',
                    name: 'Dolphin',
                    type: 'POLYGON_ZONE',
                    color: '#35c2c1',
                    coordinates: [
                        '708,206,0',
                        '916,232,0',
                        '874,396,0',
                        '690,360,0',
                        '708,206,0',
                    ],
                    occupancy: 6,
                    capacity: 260,
                },
                {
                    locId: 'tag-support',
                    name: 'TAG Support',
                    type: 'POLYGON_ZONE',
                    color: '#f05a28',
                    coordinates: [
                        '644,382,0',
                        '1014,408,0',
                        '984,536,0',
                        '612,518,0',
                        '644,382,0',
                    ],
                    occupancy: 4,
                    capacity: 360,
                },
                {
                    locId: 'military-support',
                    name: 'ESF 13 - Military Support',
                    type: 'POLYGON_ZONE',
                    color: '#9b5de5',
                    coordinates: [
                        '936,286,0',
                        '1130,322,0',
                        '1084,466,0',
                        '920,438,0',
                        '936,286,0',
                    ],
                    occupancy: 0,
                    capacity: 180,
                },
            ],
        },
    ],
    accessPoints: [
        { id: 'ap-1', name: 'AP-OPS-101', x: 214, y: 214, model: 'CW9174I', channel: 36 },
        { id: 'ap-2', name: 'AP-OPS-119', x: 424, y: 182, model: 'CW9174I', channel: 44 },
        { id: 'ap-3', name: 'AP-OPS-142', x: 622, y: 270, model: 'CW9176I', channel: 149 },
        { id: 'ap-4', name: 'AP-OPS-177', x: 792, y: 308, model: 'CW9174I', channel: 6 },
        { id: 'ap-5', name: 'AP-OPS-214', x: 930, y: 454, model: 'CW9176I', channel: 161 },
    ],
    devices: [
        { id: 'client-1', x: 228, y: 246, value: 61 },
        { id: 'client-2', x: 362, y: 218, value: 50 },
        { id: 'client-3', x: 486, y: 248, value: 74 },
        { id: 'client-4', x: 548, y: 306, value: 46 },
        { id: 'client-5', x: 678, y: 292, value: 81 },
        { id: 'client-6', x: 760, y: 334, value: 69 },
        { id: 'client-7', x: 828, y: 422, value: 57 },
        { id: 'client-8', x: 938, y: 474, value: 72 },
        { id: 'client-9', x: 1024, y: 384, value: 44 },
    ],
    metrics: {
        occupancyPercent: 1.06,
        activeDevices: 19,
        capacity: 1799,
        iaq: 'Excellent',
        temperature: '70 F',
        humidity: '61%',
        ambientNoise: '30 dB',
    },
    history: [
        0.4, 0.6, 0.5, 0.7, 0.9, 1.1, 1.5, 1.3, 1.8, 1.4, 1.1, 1.0, 1.06,
    ],
};

const metricStyle = {
    borderRight: '1px solid rgba(17, 24, 39, 0.12)',
    minWidth: 132,
    padding: '10px 16px',
};

const generateRandomString = (length = 10) => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    return Array.from({ length }, () =>
        characters.charAt(Math.floor(Math.random() * characters.length)),
    ).join('');
};

const parseCoordinate = (coordinate) => {
    if (Array.isArray(coordinate)) {
        return {
            x: Number(coordinate[0]) || 0,
            y: Number(coordinate[1]) || 0,
        };
    }

    if (typeof coordinate === 'object' && coordinate) {
        return {
            x: Number(coordinate.x) || 0,
            y: Number(coordinate.y) || 0,
        };
    }

    const [x, y] = String(coordinate || '')
        .split(',')
        .map((value) => Number(value.trim()));

    return {
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
    };
};

const getRowsFromDataSource = (dataSource) => {
    const data = dataSource?.data;

    if (Array.isArray(data?.results)) {
        return data.results;
    }

    if (!Array.isArray(data?.fields) || !Array.isArray(data?.columns)) {
        return [];
    }

    const fields = data.fields.map((field) => field.name);
    const rowCount = Math.max(0, ...data.columns.map((column) => column.length));

    return Array.from({ length: rowCount }, (_, rowIndex) =>
        fields.reduce(
            (row, fieldName, fieldIndex) => ({
                ...row,
                [fieldName]: data.columns[fieldIndex]?.[rowIndex],
            }),
            {},
        ),
    );
};

const tryParseJson = (value) => {
    if (!value) {
        return undefined;
    }

    if (typeof value === 'object') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (error) {
        return undefined;
    }
};

const getPayloadFromRows = (rows) => {
    const jsonFields = ['space_manager_json', 'floor_json', 'payload', 'json', '_raw'];

    return rows.reduce((matchingPayload, row) => {
        if (matchingPayload) {
            return matchingPayload;
        }

        return jsonFields.reduce((payloadMatch, field) => {
            if (payloadMatch) {
                return payloadMatch;
            }

            const payload = tryParseJson(row[field]);
            if (payload?.maps || payload?.locationHierarchy || payload?.accessPoints) {
                return payload;
            }

            return undefined;
        }, undefined);
    }, undefined);
};

const getRowsByKind = (rows, kind) =>
    rows.filter((row) => String(row.kind || row.type || '').toLowerCase() === kind);

const parseCoordinateList = (value) => {
    const parsed = tryParseJson(value);
    if (Array.isArray(parsed)) {
        return parsed;
    }

    return String(value || '')
        .split(/[;|]/)
        .map((coordinate) => coordinate.trim())
        .filter(Boolean);
};

const toZoneFromRow = (row) => {
    const coordinates = parseCoordinateList(row.coordinates || row.zone_coordinates || row.points);

    return {
        locId: row.locId || row.zone_id || row.id || row.name,
        name: row.name || row.zone || row.label || 'Zone',
        color: row.color,
        coordinates,
        occupancy: Number(row.occupancy || row.active_devices || row.count || 0),
        capacity: Number(row.capacity || 0),
    };
};

const toPointFromRow = (row) => ({
    id: row.id || row.deviceId || row.macAddress || row.name,
    name: row.name || row.displayName || row.deviceId || row.macAddress || 'Device',
    x: Number(row.x || row.coordinatex || row.coordinateX || 0),
    y: Number(row.y || row.coordinatey || row.coordinateY || 0),
    model: row.model,
    value: Number(row.value || row.rssi || row.count || 0),
});

const getMetricRows = (rows) =>
    getRowsByKind(rows, 'metric').reduce((metrics, row) => {
        const key = row.key || row.metric || row.name;
        const value = row.value ?? row.metric_value ?? row.displayValue ?? row.count;

        if (!key || value === undefined || value === null || value === '') {
            return metrics;
        }

        return {
            ...metrics,
            [key]: value,
        };
    }, {});

const normalizePayload = (payload, rows) => {
    const rowZones = getRowsByKind(rows, 'zone').map(toZoneFromRow);
    const rowAccessPoints = getRowsByKind(rows, 'ap').map(toPointFromRow);
    const rowDevices = getRowsByKind(rows, 'device').map(toPointFromRow);
    const rowMetrics = getMetricRows(rows);
    const firstMap = payload?.maps?.[0] || {};
    const zones = rowZones.length ? rowZones : firstMap.zones || payload?.zones || [];
    const accessPoints = rowAccessPoints.length ? rowAccessPoints : payload?.accessPoints || [];
    const devices = rowDevices.length ? rowDevices : payload?.devices || payload?.clients || [];
    const metrics = {
        ...rowMetrics,
        ...payload?.metrics,
        occupancyPercent:
            payload?.metrics?.occupancyPercent ||
            rowMetrics.occupancyPercent ||
            payload?.floorOccupancy ||
            payload?.occupancyPercent,
        activeDevices:
            payload?.metrics?.activeDevices ||
            rowMetrics.activeDevices ||
            payload?.activeDevices ||
            payload?.deviceCount ||
            devices.length,
        capacity: payload?.metrics?.capacity || rowMetrics.capacity || payload?.capacity,
    };

    return {
        ...payload,
        maps: payload?.maps || [firstMap],
        zones,
        accessPoints,
        devices,
        metrics,
        isSample: false,
    };
};

const getSpaceModel = (dataSources) => {
    const primaryRows = getRowsFromDataSource(dataSources?.primary);
    const payload = getPayloadFromRows(primaryRows);

    if (payload) {
        return normalizePayload(payload, primaryRows);
    }

    if (primaryRows.length) {
        return normalizePayload(
            {
                maps: [
                    {
                        name: 'Splunk Floor',
                        zones: getRowsByKind(primaryRows, 'zone').map(toZoneFromRow),
                    },
                ],
                accessPoints: getRowsByKind(primaryRows, 'ap').map(toPointFromRow),
                devices: getRowsByKind(primaryRows, 'device').map(toPointFromRow),
                metrics: {},
            },
            primaryRows,
        );
    }

    return {
        ...SAMPLE_FLOOR,
        zones: SAMPLE_FLOOR.maps[0].zones,
        isSample: true,
    };
};

const getPointBounds = (zones, accessPoints, devices, map) => {
    const floorPoints = [
        ...zones.flatMap((zone) => (zone.coordinates || []).map(parseCoordinate)),
        ...accessPoints.map((point) => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 })),
        ...devices.map((point) => ({ x: Number(point.x) || 0, y: Number(point.y) || 0 })),
    ].filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

    const points =
        map?.imageWidth && map?.imageHeight
            ? [
                  ...floorPoints,
                  { x: 0, y: 0 },
                  { x: Number(map.imageWidth), y: Number(map.imageHeight) },
              ]
            : floorPoints;

    if (!points.length) {
        return { minX: 0, minY: 0, maxX: 1200, maxY: 620 };
    }

    return points.reduce(
        (bounds, point) => ({
            minX: Math.min(bounds.minX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxX: Math.max(bounds.maxX, point.x),
            maxY: Math.max(bounds.maxY, point.y),
        }),
        {
            minX: points[0].x,
            minY: points[0].y,
            maxX: points[0].x,
            maxY: points[0].y,
        },
    );
};

const getCentroid = (coordinates) => {
    const points = (coordinates || []).map(parseCoordinate);
    if (!points.length) {
        return { x: 0, y: 0 };
    }

    const total = points.reduce(
        (sum, point) => ({
            x: sum.x + point.x,
            y: sum.y + point.y,
        }),
        { x: 0, y: 0 },
    );

    return {
        x: total.x / points.length,
        y: total.y / points.length,
    };
};

const getMetricValue = (metrics, key, fallback = 'No Data') =>
    metrics?.[key] === undefined || metrics?.[key] === null || metrics?.[key] === ''
        ? fallback
        : metrics[key];

const SpaceManagerViz = (props) => {
    const { dataSources, options } = props;
    const [selected, setSelected] = useState();
    const model = useMemo(() => getSpaceModel(dataSources || {}), [dataSources]);
    const svgId = useMemo(() => `space-manager-${generateRandomString()}`, []);
    const map = model.maps?.[0] || {};
    const mapImageSrc = normalizeSharedImageSource(map.imageUrl);
    const zones = model.zones || map.zones || [];
    const accessPoints = model.accessPoints || [];
    const devices = model.devices || [];
    const metrics = model.metrics || {};
    const bounds = getPointBounds(zones, accessPoints, devices, map);
    const padding = Math.max(24, (bounds.maxX - bounds.minX) * 0.04);
    const viewBox = [
        bounds.minX - padding,
        bounds.minY - padding,
        bounds.maxX - bounds.minX + padding * 2 || 1200,
        bounds.maxY - bounds.minY + padding * 2 || 620,
    ].join(' ');
    const hierarchy = model.locationHierarchy || [];
    const floorName =
        options?.floorName ||
        hierarchy.find((item) => String(item.type).toLowerCase() === 'floor')?.name ||
        map.name ||
        'Floor';
    const siteName = options?.siteName || hierarchy[0]?.name || 'Cisco Spaces';
    const zoneOccupancyTotal = zones.reduce(
        (sum, zone) => sum + (Number(zone.occupancy || zone.count) || 0),
        0,
    );
    const deviceValueTotal = devices.reduce(
        (sum, device) => sum + (Number(device.value || device.count) || 0),
        0,
    );
    const activeDevicesFallback =
        zoneOccupancyTotal > 0 || zones.length > 0
            ? zoneOccupancyTotal
            : deviceValueTotal || devices.length;
    const activeDevices = getMetricValue(metrics, 'activeDevices', activeDevicesFallback);
    const capacity = getMetricValue(
        metrics,
        'capacity',
        zones.reduce((sum, zone) => sum + (Number(zone.capacity) || 0), 0),
    );
    const occupancyPercent =
        getMetricValue(
            metrics,
            'occupancyPercent',
            capacity ? ((Number(activeDevices) / Number(capacity)) * 100).toFixed(2) : '0.00',
        );
    const selectedName = selected?.name || selected?.displayName || selected?.id || 'Nothing selected';
    const hasSelectedCoordinates =
        Number.isFinite(Number(selected?.x)) && Number.isFinite(Number(selected?.y));
    const history = model.history || SAMPLE_FLOOR.history;
    const historyBars = history.map((value, index) => ({
        id: `${index}-${value}`,
        isLatest: index === history.length - 1,
        value,
    }));
    const shadowId = `${svgId}-shadow`;
    const heatId = `${svgId}-heat`;

    return (
        <div
            style={{
                background: '#f7f9fb',
                color: '#16202a',
                display: 'flex',
                flexDirection: 'column',
                fontFamily: 'Splunk Platform Sans, Splunk Data Sans, Arial, sans-serif',
                height: '100%',
                minHeight: 360,
                overflow: 'hidden',
                width: '100%',
            }}
        >
            <div
                style={{
                    alignItems: 'center',
                    background: '#ffffff',
                    borderBottom: '1px solid rgba(17, 24, 39, 0.12)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    minHeight: 50,
                    padding: '0 18px',
                }}
            >
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0 }}>
                        CISCO SPACES
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>
                        {options?.title || 'Cisco Spaces Space Manager'}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span
                        style={{
                            background: model.isSample ? '#fff3d6' : '#dff7ed',
                            border: `1px solid ${model.isSample ? '#f3ca70' : '#83d9b7'}`,
                            borderRadius: 8,
                            color: model.isSample ? '#765000' : '#096b48',
                            fontSize: 12,
                            fontWeight: 700,
                            padding: '5px 8px',
                        }}
                    >
                        {model.isSample ? 'Sample data' : 'Splunk data'}
                    </span>
                    <span style={{ color: '#4f5f70', fontSize: 12 }}>{siteName}</span>
                    <span style={{ color: '#4f5f70', fontSize: 12 }}>{floorName}</span>
                </div>
            </div>

            <div
                style={{
                    background: '#ffffff',
                    borderBottom: '1px solid rgba(17, 24, 39, 0.12)',
                    display: 'flex',
                    minHeight: 58,
                    overflowX: 'auto',
                }}
            >
                {[
                    ['Floor Occ.', `${occupancyPercent}%`],
                    ['Right Now', activeDevices],
                    ['Capacity', capacity],
                    ['Zones', zones.length],
                    ['Access Points', accessPoints.length],
                    ['IAQ', getMetricValue(metrics, 'iaq')],
                    ['Temperature', getMetricValue(metrics, 'temperature')],
                    ['Humidity', getMetricValue(metrics, 'humidity')],
                ].map(([label, value]) => (
                    <div key={label} style={metricStyle}>
                        <div style={{ color: '#4f5f70', fontSize: 12 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{value}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
                <div style={{ background: '#172232', flex: 1, minWidth: 0, position: 'relative' }}>
                    <svg
                        role="img"
                        aria-label="Cisco Spaces indoor floor map"
                        viewBox={viewBox}
                        style={{ display: 'block', height: '100%', width: '100%' }}
                    >
                        <defs>
                            <filter id={shadowId} x="-30%" y="-30%" width="160%" height="160%">
                                <feDropShadow dx="0" dy="8" floodColor="#000000" floodOpacity="0.28" stdDeviation="10" />
                            </filter>
                            <radialGradient id={heatId}>
                                <stop offset="0%" stopColor="#f05a28" stopOpacity="0.85" />
                                <stop offset="42%" stopColor="#ffd166" stopOpacity="0.62" />
                                <stop offset="74%" stopColor="#35c2c1" stopOpacity="0.34" />
                                <stop offset="100%" stopColor="#35c2c1" stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <rect
                            x={bounds.minX - padding}
                            y={bounds.minY - padding}
                            width={bounds.maxX - bounds.minX + padding * 2}
                            height={bounds.maxY - bounds.minY + padding * 2}
                            fill="#172232"
                        />
                        <g filter={`url(#${shadowId})`}>
                            <rect
                                x={bounds.minX}
                                y={bounds.minY}
                                width={bounds.maxX - bounds.minX}
                                height={bounds.maxY - bounds.minY}
                                fill="#dbe7ee"
                                opacity="0.14"
                                rx="10"
                            />
                            {mapImageSrc && (
                                <image
                                    href={mapImageSrc}
                                    x={bounds.minX}
                                    y={bounds.minY}
                                    width={bounds.maxX - bounds.minX}
                                    height={bounds.maxY - bounds.minY}
                                    preserveAspectRatio="xMidYMid meet"
                                />
                            )}
                            {zones.map((zone, index) => {
                                const points = (zone.coordinates || []).map(parseCoordinate);
                                const pointString = points.map((point) => `${point.x},${point.y}`).join(' ');
                                const centroid = getCentroid(zone.coordinates);
                                const occupancy = Number(zone.occupancy || zone.count || 0);
                                const zoneCapacity = Number(zone.capacity || 0);
                                const intensity = zoneCapacity ? Math.min(0.75, occupancy / zoneCapacity + 0.18) : 0.24;

                                return (
                                    <g key={zone.locId || zone.name || index}>
                                        <polygon
                                            points={pointString}
                                            fill={zone.color || '#35c2c1'}
                                            fillOpacity={intensity}
                                            stroke="#ffffff"
                                            strokeOpacity="0.85"
                                            strokeWidth="2"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setSelected({ ...zone, kind: 'Zone' })}
                                        />
                                        <text
                                            x={centroid.x}
                                            y={centroid.y}
                                            fill="#ffffff"
                                            fontSize="16"
                                            fontWeight="700"
                                            paintOrder="stroke"
                                            pointerEvents="none"
                                            stroke="#263545"
                                            strokeWidth="4"
                                            textAnchor="middle"
                                        >
                                            {zone.name}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                        {devices.map((device, index) => (
                            <g key={device.id || index}>
                                <circle
                                    cx={Number(device.x) || 0}
                                    cy={Number(device.y) || 0}
                                    r="44"
                                    fill={`url(#${heatId})`}
                                    pointerEvents="none"
                                />
                                <circle
                                    cx={Number(device.x) || 0}
                                    cy={Number(device.y) || 0}
                                    r="7"
                                    fill="#ff6b35"
                                    stroke="#ffffff"
                                    strokeWidth="2"
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelected({ ...device, kind: 'Device' })}
                                />
                            </g>
                        ))}
                        {accessPoints.map((ap, index) => (
                            <g
                                key={ap.id || ap.macAddress || index}
                                transform={`translate(${Number(ap.x) || 0}, ${Number(ap.y) || 0})`}
                                style={{ cursor: 'pointer' }}
                                onClick={() => setSelected({ ...ap, kind: 'Access Point' })}
                            >
                                <circle r="17" fill="#0b1118" stroke="#ffffff" strokeWidth="3" />
                                <path
                                    d="M-8 2 C-5 -4 5 -4 8 2 M-4 6 C-2 3 2 3 4 6 M0 9 L0 10"
                                    fill="none"
                                    stroke="#ffffff"
                                    strokeLinecap="round"
                                    strokeWidth="2"
                                />
                            </g>
                        ))}
                    </svg>
                    <div
                        style={{
                            bottom: 14,
                            color: '#c9d5df',
                            fontSize: 12,
                            left: 14,
                            position: 'absolute',
                        }}
                    >
                        Coordinate scale inferred from Spaces floor payload
                    </div>
                </div>

                <div
                    style={{
                        background: '#ffffff',
                        borderLeft: '1px solid rgba(17, 24, 39, 0.12)',
                        display: 'flex',
                        flexDirection: 'column',
                        width: 254,
                    }}
                >
                    <div style={{ borderBottom: '1px solid #e3e8ee', padding: 16 }}>
                        <div style={{ color: '#4f5f70', fontSize: 12, fontWeight: 700 }}>
                            SELECTED
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                            {selectedName}
                        </div>
                        <div style={{ color: '#4f5f70', fontSize: 12, marginTop: 4 }}>
                            {selected?.kind || 'Click a zone, AP, or device'}
                        </div>
                    </div>
                    <div style={{ display: 'grid', gap: 10, padding: 16 }}>
                        {[
                            ['Occupancy', selected?.occupancy ?? selected?.count ?? 'No Data'],
                            ['Capacity', selected?.capacity ?? 'No Data'],
                            ['Model', selected?.model ?? 'No Data'],
                            ['Channel', selected?.channel ?? 'No Data'],
                            [
                                'X / Y',
                                hasSelectedCoordinates
                                    ? `${Number(selected.x).toFixed(0)} / ${Number(
                                          selected.y,
                                      ).toFixed(0)}`
                                    : 'No Data',
                            ],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <div style={{ color: '#6a7888', fontSize: 11 }}>{label}</div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div
                style={{
                    alignItems: 'center',
                    background: '#ffffff',
                    borderTop: '1px solid rgba(17, 24, 39, 0.12)',
                    display: 'grid',
                    gap: 14,
                    gridTemplateColumns: '180px 1fr 160px',
                    minHeight: 58,
                    padding: '8px 18px',
                }}
            >
                <div>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{occupancyPercent}%</div>
                    <div style={{ color: '#4f5f70', fontSize: 12 }}>Floor occupancy</div>
                </div>
                <div>
                    <div style={{ color: '#4f5f70', fontSize: 12, marginBottom: 6 }}>
                        24 Hour History
                    </div>
                    <div style={{ alignItems: 'end', display: 'flex', gap: 4, height: 24 }}>
                        {historyBars.map((bar) => (
                            <span
                                key={bar.id}
                                style={{
                                    background: bar.isLatest ? '#1e88ff' : '#9dd6ff',
                                    borderRadius: 3,
                                    display: 'inline-block',
                                    flex: 1,
                                    height: `${Math.max(5, Math.min(24, Number(bar.value) * 10))}px`,
                                }}
                            />
                        ))}
                    </div>
                </div>
                <div>
                    <div style={{ color: '#4f5f70', fontSize: 12, marginBottom: 6 }}>
                        Floor Occupancy
                    </div>
                    <div
                        style={{
                            background: 'linear-gradient(90deg, #4d7cff, #51d7d1, #fff36d, #f05a28)',
                            borderRadius: 8,
                            height: 10,
                        }}
                    />
                    <div
                        style={{
                            color: '#6a7888',
                            display: 'flex',
                            fontSize: 10,
                            justifyContent: 'space-between',
                            marginTop: 4,
                        }}
                    >
                        <span>Low</span>
                        <span>Medium</span>
                        <span>High</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

SpaceManagerViz.propTypes = {
    ...SplunkVisualization.propTypes,
    options: PropTypes.shape({
        title: PropTypes.string,
        siteName: PropTypes.string,
        floorName: PropTypes.string,
    }),
};

SpaceManagerViz.defaultProps = {
    ...SplunkVisualization.defaultProps,
    title: 'Cisco Spaces Space Manager',
    options: {},
};

SpaceManagerViz.dataContract = {
    requiredDataSources: [],
    initialRequestParams: {},
};

SpaceManagerViz.config = {
    dataContract: SpaceManagerViz.dataContract,
    editorConfig: [],
    optionsSchema: {},
    key: 'splunk.cisco_spaces_space_manager',
    name: 'Cisco Spaces Space Manager',
    icon: MapIcon,
    category: 'maps',
};

export default memo(SpaceManagerViz, (prev, current) => {
    const propsUsed = ['options', 'title', 'dataSources', 'mode'];
    const changedPropNames = reduce(
        prev,
        (result, value, key) => (isEqual(value, current[key]) ? result : result.concat(key)),
        [],
    );

    return !intersection(propsUsed, changedPropNames).length;
});
