import React from 'react';

const managerLinks = [
    {
        id: 'dashboard_manager',
        label: 'Dashboard Manager',
        href: '/app/splunk-cisco-dashboards/dashboard_manager',
    },
];

export default function ManagerHeaderTabs({ activeManager }) {
    return (
        <div className="manager-header-tabs" role="tablist" aria-label="Manager navigation">
            {managerLinks.map((managerLink) => {
                const isActive = managerLink.id === activeManager;

                return (
                    <a
                        key={managerLink.id}
                        className={`manager-header-tab manager-header-tab-${managerLink.id} ${
                            isActive ? 'manager-header-tab-active' : ''
                        }`}
                        href={managerLink.href}
                        role="tab"
                        aria-selected={isActive}
                        aria-current={isActive ? 'page' : undefined}
                    >
                        {managerLink.label}
                    </a>
                );
            })}
        </div>
    );
}
