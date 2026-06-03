import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import Cross from '@splunk/react-icons/Cross';

const DEFAULT_WIDTH = 1100;
const DEFAULT_HEIGHT = 720;

export default function ManagerPreviewModal({
    open,
    title,
    onRequestClose,
    children,
    footerContent,
    bodyClassName = '',
    bodyStyle,
    initialWidth = DEFAULT_WIDTH,
    initialHeight = DEFAULT_HEIGHT,
}) {
    const modalRef = useRef(null);
    const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

    const [position, setPosition] = useState(null);
    const [size, setSize] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (!open) {
            setPosition(null);
            setSize(null);
        }
    }, [open]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onRequestClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onRequestClose, open]);

    const handleDragStart = useCallback(
        (event) => {
            if (event.target.closest('button')) {
                return;
            }

            event.preventDefault();

            const rect = modalRef.current.getBoundingClientRect();
            dragStartRef.current = {
                mouseX: event.clientX,
                mouseY: event.clientY,
                posX: rect.left,
                posY: rect.top,
            };

            if (!size) {
                setSize({ width: rect.width, height: rect.height });
            }

            setPosition({ x: rect.left, y: rect.top });
            setIsDragging(true);
        },
        [size],
    );

    useEffect(() => {
        if (!isDragging) {
            return undefined;
        }

        const handleMove = (event) => {
            const dx = event.clientX - dragStartRef.current.mouseX;
            const dy = event.clientY - dragStartRef.current.mouseY;
            const modalWidth = size ? size.width : modalRef.current?.offsetWidth || initialWidth;
            const modalHeight = size ? size.height : modalRef.current?.offsetHeight || initialHeight;
            const newX = Math.max(
                0,
                Math.min(dragStartRef.current.posX + dx, window.innerWidth - modalWidth),
            );
            const newY = Math.max(
                0,
                Math.min(dragStartRef.current.posY + dy, window.innerHeight - modalHeight),
            );

            setPosition({ x: newX, y: newY });
        };

        const handleUp = () => {
            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
        return () => {
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
    }, [initialHeight, initialWidth, isDragging, size]);

    if (!open) {
        return null;
    }

    const isActive = isDragging;
    const viewportMaxWidth = Math.max(320, Math.floor(window.innerWidth * 0.9));
    const viewportMaxHeight = Math.max(320, Math.floor(window.innerHeight * 0.9));
    const resolvedWidth = Math.min(size ? size.width : initialWidth, viewportMaxWidth);
    const resolvedHeight = Math.min(size ? size.height : initialHeight, viewportMaxHeight);
    const modalStyle = {
        position: 'fixed',
        ...(position
            ? { left: position.x, top: position.y }
            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }),
        width: resolvedWidth,
        height: resolvedHeight,
        maxWidth: '90vw',
        maxHeight: '90vh',
        opacity: isActive ? 0.9 : 1,
        transition: isActive ? 'none' : 'opacity 0.16s ease',
    };

    return ReactDOM.createPortal(
        <>
            <div className="manager-preview-modal-overlay" onClick={onRequestClose} />
            <div
                ref={modalRef}
                className={`manager-preview-modal-shell ${
                    isActive ? 'manager-preview-modal-shell-active' : ''
                }`}
                style={modalStyle}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="manager-preview-modal-header" onMouseDown={handleDragStart}>
                    <div className="manager-preview-modal-title">{title}</div>
                    <button
                        type="button"
                        className="manager-preview-modal-close"
                        aria-label="Close preview"
                        title="Close preview"
                        onClick={onRequestClose}
                    >
                        <Cross width={14} height={14} />
                    </button>
                </div>
                <div className={`manager-preview-modal-body ${bodyClassName}`.trim()} style={bodyStyle}>
                    {children}
                </div>
                {footerContent ? (
                    <div className="manager-preview-modal-footer">
                        <div className="manager-preview-modal-footer-actions">{footerContent}</div>
                    </div>
                ) : null}
            </div>
        </>,
        document.body,
    );
}
