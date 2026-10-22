import React, { useLayoutEffect, useRef, useState } from 'react';
import { chartDataSources, sparseVisualizationOptions } from './sparseVisualizationOptions';

// Studio subtracts a fixed one-line header from the visualization height.
// Our wrapped descriptions use more space, so pass the renderer the actual
// remaining panel size. ResizeObserver reports unscaled CSS pixels even when
// the dashboard canvas is zoomed or fitted to the viewport.
export default function VisualizationFrame({ component: Visualization, ...props }) {
    const type = Visualization.config?.key;
    const guardedProps = { ...props, dataSources: chartDataSources(type, props.dataSources, props.options, Visualization.config?.optionsSchema) };
    const frameRef = useRef(null);
    const [size, setSize] = useState(null);

    useLayoutEffect(() => {
        const frame = frameRef.current;
        if (!frame) return undefined;

        const updateSize = ({ width, height }) => {
            if (width <= 0 || height <= 0) return;
            setSize((previous) => previous?.width === width && previous?.height === height
                ? previous : { width, height });
        };
        updateSize({ width: frame.clientWidth, height: frame.clientHeight });
        if (typeof ResizeObserver === 'undefined') return undefined;

        const observer = new ResizeObserver(([entry]) => {
            if (entry) updateSize(entry.contentRect);
        });
        observer.observe(frame);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={frameRef}
            data-test="dashboard-visualization-frame"
            style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}
        >
            <Visualization {...guardedProps} options={sparseVisualizationOptions(type, guardedProps, Visualization.config?.optionsSchema)} {...size} />
        </div>
    );
}

export function withMeasuredVisualizationSizes(preset) {
    return {
        ...preset,
        visualizations: Object.fromEntries(Object.entries(preset.visualizations || {}).map(
            ([name, Visualization]) => {
                const MeasuredVisualization = (props) => (
                    <VisualizationFrame component={Visualization} {...props} />
                );
                Object.assign(MeasuredVisualization, Visualization, {
                    displayName: `DashboardManagerFrame(${name})`,
                });
                return [name, MeasuredVisualization];
            },
        )),
    };
}
