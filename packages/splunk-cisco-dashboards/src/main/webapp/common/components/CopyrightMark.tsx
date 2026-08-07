import React from 'react';

const markStyle: React.CSSProperties = {
    position: 'fixed',
    right: 10,
    bottom: 8,
    zIndex: 20,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 7px',
    border: '1px solid var(--sui-border)',
    borderRadius: 999,
    background: 'var(--sui-background-floating)',
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.14)',
    color: 'var(--sui-content-default)',
    fontFamily: 'var(--sui-font-family)',
    fontSize: 'var(--sui-font-size-small)',
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
            <span aria-hidden="true">© {year} Splunk Inc.</span>
        </div>
    );
}
