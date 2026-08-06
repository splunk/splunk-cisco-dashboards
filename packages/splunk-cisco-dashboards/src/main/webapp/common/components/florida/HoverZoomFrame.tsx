import React, { useState } from 'react';
import { cn } from '@/common/lib/utils';
import type { InfoTooltipAnchor } from './InfoTooltip';

interface HoverZoomFrameProps {
    children: React.ReactNode;
    ariaLabel: string;
    title?: string;
    anchor?: InfoTooltipAnchor;
    scale?: number;
    className?: string;
    contentClassName?: string;
}

/**
 * Accessible magnification frame for dense, compact visualizations.
 *
 * Pointer hover and keyboard focus use the same state so the interaction is
 * predictable across mouse and keyboard input. The bottom-edge origin keeps
 * magnified charts inside their dashboard section instead of covering the
 * section below them.
 */
export const HoverZoomFrame: React.FC<HoverZoomFrameProps> = ({
    children,
    ariaLabel,
    title = 'Hover or focus to enlarge',
    anchor = 'auto',
    scale = 1.45,
    className,
    contentClassName,
}) => {
    const [isZoomed, setIsZoomed] = useState(false);
    const transformOrigin =
        anchor === 'right'
            ? 'right bottom'
            : anchor === 'left'
            ? 'left bottom'
            : 'center bottom';

    return (
        <div
            role="img"
            data-tile-control="true"
            tabIndex={0}
            onPointerEnter={() => setIsZoomed(true)}
            onPointerLeave={() => setIsZoomed(false)}
            onFocus={() => setIsZoomed(true)}
            onBlur={() => setIsZoomed(false)}
            aria-label={ariaLabel}
            title={title}
            style={{ zIndex: isZoomed ? 30 : 0 }}
            className={cn(
                'relative overflow-visible rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                isZoomed && 'z-30',
                className
            )}
        >
            <div
                style={{
                    transform: `scale(${isZoomed ? scale : 1})`,
                    transformOrigin,
                }}
                className={cn(
                    'absolute inset-0 transform-gpu rounded-md transition-[transform,box-shadow,background-color] duration-200 ease-out',
                    isZoomed &&
                        'bg-white shadow-2xl ring-1 ring-sky-300 dark:bg-slate-900 dark:ring-sky-700',
                    contentClassName
                )}
            >
                {children}
            </div>
        </div>
    );
};
