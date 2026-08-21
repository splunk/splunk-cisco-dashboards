import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import Card from '@splunk/react-ui/Card';
import Pin from '@splunk/react-icons/Pin';
import PinStuck from '@splunk/react-icons/PinStuck';
import useSplunkTheme from '@splunk/themes/useSplunkTheme';

const CustomTooltip = ({
    style,
    type = 'text',
    text,
    title,
    subtitle,
    description,
    image,
    actions,
    component,
    delay = 800,
    placement = 'top',
    persistent = false,
    children,
    width = 500,
    height = 300,
}) => {
    const splunkTheme = useSplunkTheme();
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [isPinned, setIsPinned] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStartOffset, setDragStartOffset] = useState({ x: 0, y: 0 });

    const wrapperRef = useRef(null);
    const tooltipRef = useRef(null);
    const timeoutRef = useRef(null);
    const isHoveringTooltip = useRef(false);
    const isFocusWithin = useRef(false);
    const tooltipThemeStyle = {
        '--custom-tooltip-background-section': splunkTheme.backgroundColorSection,
        '--custom-tooltip-background-popup': splunkTheme.backgroundColorPopup,
        '--custom-tooltip-content-active': splunkTheme.contentColorActive,
        '--custom-tooltip-content-default': splunkTheme.contentColorDefault,
        '--custom-tooltip-content-muted': splunkTheme.contentColorMuted,
        '--custom-tooltip-border': splunkTheme.borderColor,
        '--custom-tooltip-border-weak': splunkTheme.borderColorWeak,
        '--custom-tooltip-accent': splunkTheme.interactiveColorAccent,
        '--custom-tooltip-overlay-hover': splunkTheme.interactiveColorOverlayHover,
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) {
                return;
            }

            const newLeft = e.clientX - dragStartOffset.x;
            const newTop = e.clientY - dragStartOffset.y;

            setCoords({ top: newTop, left: newLeft });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            clearTimeout(timeoutRef.current);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStartOffset]);

    useEffect(() => {
        if (!visible) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                clearTimeout(timeoutRef.current);
                setIsPinned(false);
                setVisible(false);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [visible]);

    const showTooltip = () => {
        if (isPinned) {
            return;
        }

        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (wrapperRef.current) {
                const rect = wrapperRef.current.getBoundingClientRect();
                const tooltipWidth = width;
                const tooltipHeight = height;
                const spacing = 8;

                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                const positions = {
                    top: () => ({
                        top: rect.top - tooltipHeight - spacing + window.scrollY,
                        left: rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX,
                    }),
                    bottom: () => ({
                        top: rect.bottom + spacing + window.scrollY,
                        left: rect.left + rect.width / 2 - tooltipWidth / 2 + window.scrollX,
                    }),
                    left: () => ({
                        top: rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY,
                        left: rect.left - tooltipWidth - spacing + window.scrollX,
                    }),
                    right: () => ({
                        top: rect.top + rect.height / 2 - tooltipHeight / 2 + window.scrollY,
                        left: rect.right + spacing + window.scrollX,
                    }),
                };
                const fits = {
                    top: rect.top >= tooltipHeight + spacing,
                    bottom: viewportHeight - rect.bottom >= tooltipHeight + spacing,
                    left: rect.left >= tooltipWidth + spacing,
                    right: viewportWidth - rect.right >= tooltipWidth + spacing,
                };
                const priority = ['top', 'bottom', 'right', 'left'];
                const resolvedPlacement =
                    placement === 'auto'
                        ? priority.find((candidate) => fits[candidate]) || 'bottom'
                        : placement;
                const initialPosition = (positions[resolvedPlacement] || positions.top)();

                // Clamp position to viewport to avoid clipping.
                const pos = {
                    left: Math.max(
                        spacing + window.scrollX,
                        Math.min(
                            initialPosition.left,
                            viewportWidth - tooltipWidth - spacing + window.scrollX,
                        ),
                    ),
                    top: Math.max(
                        spacing + window.scrollY,
                        Math.min(
                            initialPosition.top,
                            viewportHeight - tooltipHeight - spacing + window.scrollY,
                        ),
                    ),
                };

                setCoords(pos);
                setVisible(true);
            }
        }, delay);
    };

    const hideTooltip = () => {
        if (isPinned) {
            return;
        }

        clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (!isHoveringTooltip.current && !isFocusWithin.current) {
                setVisible(false);
            }
        }, 500);
    };

    const handleMouseDown = (e) => {
        if (!isPinned || !tooltipRef.current) {
            return;
        }

        const rect = tooltipRef.current.getBoundingClientRect();
        const offsetX = e.clientX - rect.left - window.scrollX;
        const offsetY = e.clientY - rect.top - window.scrollY;

        setDragStartOffset({ x: offsetX, y: offsetY });

        setIsDragging(true);
        e.stopPropagation();
        e.preventDefault();
    };

    const togglePin = () => {
        setIsPinned((prev) => !prev);
    };

    const handleMoveKeyDown = (event) => {
        const offsets = {
            ArrowUp: { top: -10, left: 0 },
            ArrowDown: { top: 10, left: 0 },
            ArrowLeft: { top: 0, left: -10 },
            ArrowRight: { top: 0, left: 10 },
        };
        const offset = offsets[event.key];

        if (!offset) {
            return;
        }

        event.preventDefault();
        setCoords((current) => ({
            top: current.top + offset.top,
            left: current.left + offset.left,
        }));
    };

    const renderTooltipContent = () => {
        let content;

        switch (type) {
            case 'text':
                content = (
                    <div
                        style={{
                            maxWidth: '200px',
                            wordWrap: 'break-word',
                            background: 'var(--custom-tooltip-background-popup, #ffffff)',
                            color: 'var(--custom-tooltip-content-default, #4d4d4d)',
                            borderRadius: '6px',
                            fontSize: '14px',
                            whiteSpace: 'normal',
                            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                            fontFamily:
                                '"Splunk Platform Sans", "Splunk Data Sans", Roboto, Droid, "Helvetica Neue", Helvetica, Arial, sans-serif',
                            padding: 15,
                        }}
                    >
                        {text}
                    </div>
                );
                break;
            case 'card':
                content = (
                    <Card id="custom_tool_tip" style={{ width, height: 'auto' }}>
                        {title && title !== '' && (
                            <Card.Header className="header" title={title} subtitle={subtitle} />
                        )}
                        <Card.Body className="body">
                            {image && <div style={{ marginBottom: 10 }}>{image}</div>}
                            {description}
                        </Card.Body>
                        {actions?.length > 0 && (
                            <Card.Footer className="footer">
                                <div
                                    className="action"
                                    style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
                                >
                                    {React.Children.toArray(actions).map((action) => (
                                        <span key={action.key}>{action}</span>
                                    ))}
                                </div>
                            </Card.Footer>
                        )}
                    </Card>
                );
                break;
            case 'custom':
                content = component;
                break;
            default:
                content = <div>Invalid tooltip type</div>;
        }

        return (
            <div style={{ position: 'relative' }}>
                {persistent && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 5,
                            right: 5,
                            display: 'flex',
                            gap: 6,
                            alignItems: 'left',
                            zIndex: 1001,
                        }}
                    >
                        <button
                            type="button"
                            className="toggle-pin"
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                togglePin();
                            }}
                            style={{
                                cursor: 'pointer',
                                fontSize: 25,
                                color: 'var(--custom-tooltip-content-muted, #6b6b6b)',
                                marginRight: isPinned ? 0 : 15,
                            }}
                            aria-label={isPinned ? 'Unpin help' : 'Pin help'}
                            aria-pressed={isPinned}
                            title={isPinned ? 'Unpin' : 'Pin'}
                        >
                            {isPinned ? <PinStuck /> : <Pin />}
                        </button>
                        {isPinned && (
                            <button
                                type="button"
                                className="move"
                                onMouseDown={handleMouseDown}
                                onKeyDown={handleMoveKeyDown}
                                style={{
                                    cursor: isDragging ? 'grabbing' : 'grab',
                                    fontSize: 25,
                                    color: 'var(--custom-tooltip-content-muted, #6b6b6b)',
                                    border: 0,
                                    background: 'transparent',
                                }}
                                aria-label="Move help; use arrow keys"
                                title="Move help"
                            >
                                <span aria-hidden="true">⠿</span>
                            </button>
                        )}
                    </div>
                )}
                {content}
            </div>
        );
    };

    const tooltipNode = (
        <div
            ref={tooltipRef}
            onMouseEnter={() => {
                isHoveringTooltip.current = true;
            }}
            onMouseLeave={() => {
                isHoveringTooltip.current = false;
                hideTooltip();
            }}
            style={{
                position: 'absolute',
                top: coords.top,
                left: coords.left,
                zIndex: 9999,
                pointerEvents: 'auto',
                opacity: visible ? 1 : 0,
                transition: 'opacity 0.9s ease',
                ...tooltipThemeStyle,
            }}
            className={`custom-tooltip-portal custom-tooltip-portal-${splunkTheme.colorScheme}`}
            role={persistent ? 'dialog' : 'tooltip'}
            aria-label={persistent ? title || 'Help' : undefined}
        >
            {renderTooltipContent()}
        </div>
    );

    return (
        <>
            <div
                ref={wrapperRef}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocusCapture={() => {
                    isFocusWithin.current = true;
                    showTooltip();
                }}
                onBlurCapture={() => {
                    isFocusWithin.current = false;
                    hideTooltip();
                }}
                style={{ display: 'inline-block', ...style }}
            >
                {children}
            </div>
            {visible && ReactDOM.createPortal(tooltipNode, document.body)}
        </>
    );
};

CustomTooltip.propTypes = {
    type: PropTypes.oneOf(['text', 'card', 'custom']).isRequired,
    text: PropTypes.string,
    title: PropTypes.string,
    subtitle: PropTypes.string,
    description: PropTypes.node,
    image: PropTypes.node,
    actions: PropTypes.arrayOf(PropTypes.node),
    component: PropTypes.node,
    delay: PropTypes.number,
    placement: PropTypes.oneOf(['top', 'bottom', 'left', 'right']),
    children: PropTypes.node.isRequired,
    style: PropTypes.object,
    persistent: PropTypes.bool,
    width: PropTypes.number,
    height: PropTypes.number,
};

export default CustomTooltip;
