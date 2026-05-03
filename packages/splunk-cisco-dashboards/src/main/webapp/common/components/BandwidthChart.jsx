import React from 'react';
import PropTypes from 'prop-types';

/**
 * Lightweight inline SVG line chart for bandwidth over time.
 *
 * Implemented with vanilla SVG (instead of @splunk/visualizations <Line>)
 * so the dashboard renders without a Splunk DataSource binding. Swap to
 * @splunk/visualizations/Line when wiring real Splunk DataSources.
 */

const PADDING = { top: 16, right: 16, bottom: 28, left: 44 };

const styles = {
    wrap: { width: '100%' },
    empty: { padding: 20, color: '#6c7a89', textAlign: 'center' },
    legend: {
        display: 'flex',
        gap: 16,
        justifyContent: 'center',
        marginTop: 8,
        color: '#6c7a89',
        fontSize: 12,
    },
    swatch: (color) => ({
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        marginRight: 6,
        verticalAlign: 'middle',
        backgroundColor: color,
    }),
};

const BandwidthChart = ({ data, width, height }) => {
    if (!data || data.length === 0) {
        return <div style={styles.empty}>No bandwidth data available.</div>;
    }

    const innerWidth = width - PADDING.left - PADDING.right;
    const innerHeight = height - PADDING.top - PADDING.bottom;

    const maxValue = Math.max(
        ...data.map((d) => Math.max(d.inbound_mbps || 0, d.outbound_mbps || 0))
    );
    const yMax = Math.ceil(maxValue / 100) * 100 || 100;

    const xScale = (idx) =>
        PADDING.left + (data.length === 1 ? 0 : (idx * innerWidth) / (data.length - 1));
    const yScale = (val) => PADDING.top + innerHeight - (val / yMax) * innerHeight;

    const buildPath = (key) =>
        data
            .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d[key] || 0)}`)
            .join(' ');

    const inboundPath = buildPath('inbound_mbps');
    const outboundPath = buildPath('outbound_mbps');

    const yTicks = 4;
    const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (yMax / yTicks) * i);

    return (
        <div style={styles.wrap}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Inbound and outbound bandwidth over time in Mbps"
                style={{ width: '100%', height: 'auto', display: 'block' }}
            >
                {ticks.map((t) => (
                    <g key={t}>
                        <line
                            x1={PADDING.left}
                            x2={width - PADDING.right}
                            y1={yScale(t)}
                            y2={yScale(t)}
                            stroke="#e1e6eb"
                            strokeDasharray="3 3"
                        />
                        <text
                            x={PADDING.left - 6}
                            y={yScale(t) + 4}
                            fontSize="10"
                            textAnchor="end"
                            fill="#6c7a89"
                        >
                            {t}
                        </text>
                    </g>
                ))}

                {data.map((d, i) => (
                    <text
                        key={d._time}
                        x={xScale(i)}
                        y={height - 8}
                        fontSize="10"
                        textAnchor="middle"
                        fill="#6c7a89"
                    >
                        {d._time}
                    </text>
                ))}

                <path d={inboundPath} fill="none" stroke="#1e88e5" strokeWidth="2" />
                <path d={outboundPath} fill="none" stroke="#43a047" strokeWidth="2" />

                {data.map((d, i) => (
                    <g key={`pts-${d._time}`}>
                        <circle cx={xScale(i)} cy={yScale(d.inbound_mbps)} r="3" fill="#1e88e5">
                            <title>{`${d._time}: ${d.inbound_mbps} Mbps in`}</title>
                        </circle>
                        <circle cx={xScale(i)} cy={yScale(d.outbound_mbps)} r="3" fill="#43a047">
                            <title>{`${d._time}: ${d.outbound_mbps} Mbps out`}</title>
                        </circle>
                    </g>
                ))}
            </svg>
            <div style={styles.legend}>
                <span>
                    <span style={styles.swatch('#1e88e5')} /> Inbound
                </span>
                <span>
                    <span style={styles.swatch('#43a047')} /> Outbound
                </span>
            </div>
        </div>
    );
};

BandwidthChart.propTypes = {
    data: PropTypes.arrayOf(
        PropTypes.shape({
            _time: PropTypes.string.isRequired,
            inbound_mbps: PropTypes.number.isRequired,
            outbound_mbps: PropTypes.number.isRequired,
        })
    ).isRequired,
    width: PropTypes.number,
    height: PropTypes.number,
};

BandwidthChart.defaultProps = {
    width: 720,
    height: 280,
};

export default BandwidthChart;
