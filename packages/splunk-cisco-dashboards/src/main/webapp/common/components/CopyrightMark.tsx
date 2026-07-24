import React from 'react';
import { Copyright } from 'lucide-react';

const markStyle: React.CSSProperties = {
    position: 'fixed',
    right: 10,
    bottom: 8,
    zIndex: 20,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 7px',
    border: '1px solid rgba(148, 163, 184, 0.24)',
    borderRadius: 999,
    background: 'rgba(15, 23, 42, 0.72)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.14)',
    color: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 10,
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: '0.02em',
    pointerEvents: 'none',
    userSelect: 'none',
    backdropFilter: 'blur(6px)',
};

export default function CopyrightMark(): JSX.Element {
    const year = new Date().getFullYear();
    const label = `Copyright ${year} Splunk Inc. Licensed under Apache-2.0.`;

    return (
        <div aria-label={label} title={label} style={markStyle}>
            <Copyright aria-hidden="true" focusable="false" size={12} strokeWidth={2} />
            <span aria-hidden="true">{year} Splunk Inc.</span>
        </div>
    );
}
