/**
 * Splunk Cisco Dashboards — Overview Page
 *
 * Direct port of the "Splunk Executive Florida Dashboard" reference
 * design. Visual structure (header, three left-column sections, right-
 * column Florida map, footer) is preserved verbatim. Sparkline data is
 * mocked client-side for now and will be replaced with live SPL search
 * results in a follow-up.
 */

import React from 'react';
import {
    Shield,
    Activity,
    Bell,
    LayoutDashboard,
    Settings,
    User,
    Search,
    Filter,
} from 'lucide-react';
import { DashboardSection } from '@/common/components/florida/DashboardSection';
import { MetricItem } from '@/common/components/florida/MetricItem';
import { FloridaMap } from '@/common/components/florida/FloridaMap';

// Deterministic-ish PRNG so each render of the dashboard is stable across
// React StrictMode double-invocations and looks the same to the user
// across quick refreshes. This replaces the reference design's
// `Math.random()`-based mock data, which changed every keystroke and
// caused noticeable flicker in StrictMode.
const seededRandom = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0xffffffff;
    };
};

const generateData = (seed: number, len: number, min: number, max: number): number[] => {
    const rnd = seededRandom(seed);
    return Array.from({ length: len }, () => Math.floor(rnd() * (max - min + 1) + min));
};

const OverviewPage: React.FC = () => {
    // Sparkline data — seeded so values are stable.
    const networkData = generateData(11, 20, 80, 100);
    const deviceData = generateData(12, 20, 95, 100);
    const issueData = generateData(13, 20, 100, 800);

    const fwData = generateData(21, 20, 10, 50);
    const threatData = generateData(22, 20, 5, 20);
    const authData = generateData(23, 20, 0, 5);

    const activeDevData = generateData(31, 20, 30, 60);
    const wifiData = generateData(32, 20, 1, 5);
    const occupancyData = generateData(33, 20, 0, 10);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            {/* Header */}
            <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center text-white">
                        <LayoutDashboard className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-sky-900 tracking-tight leading-none uppercase">
                            Florida Division of Emergency Management
                        </h1>
                        <p className="text-[10px] font-bold text-sky-600 uppercase tracking-[0.3em] mt-1">
                            Splunk Executive Control Center
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                        <Search className="w-4 h-4 text-slate-400" />
                        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            Global Search (⌘K)
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            className="relative p-2 text-slate-400 hover:text-sky-600 transition-colors"
                        >
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                        <div className="h-8 w-[1px] bg-slate-200 mx-2"></div>
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-700">Executive Admin</p>
                                <p className="text-[10px] text-slate-400">Security Operations</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600">
                                <User className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-6 md:p-8 max-w-[1600px] mx-auto w-full">
                {/* Mobile Nav Toggle / Controls */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <Filter className="w-4 h-4" />
                            Filter View
                        </button>
                        <button
                            type="button"
                            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                        >
                            <Settings className="w-4 h-4" />
                            Configure
                        </button>
                    </div>
                    <div className="text-sm font-bold text-slate-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        SYSTEMS OPERATIONAL • LAST REFRESH:{' '}
                        {new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                    {/* Left Column - 3 Sections */}
                    <div className="xl:col-span-7 space-y-8">
                        {/* IT HEALTH */}
                        <DashboardSection title="IT Health" linkText="Open IT health">
                            <MetricItem
                                label="Network health"
                                subLabel="Catalyst Center network score"
                                value={99}
                                unit="%"
                                change={0}
                                sparkData={networkData}
                            />
                            <MetricItem
                                label="Device health"
                                subLabel="Reachable and managed devices"
                                value={100}
                                unit="%"
                                change={0}
                                sparkData={deviceData}
                            />
                            <MetricItem
                                label="Open issues"
                                subLabel="Active issues from Catalyst Center"
                                value={650}
                                change={-50}
                                sparkData={issueData}
                            />
                        </DashboardSection>

                        {/* SECURITY */}
                        <DashboardSection title="Security" linkText="Open security">
                            <MetricItem
                                label="FW blocked"
                                subLabel="Firewall blocked connections"
                                value={142}
                                change={12}
                                sparkData={fwData}
                                color="#f59e0b"
                            />
                            <MetricItem
                                label="Threat sources"
                                subLabel="Unique IPs blocked at firewall"
                                value={18}
                                change={-5}
                                sparkData={threatData}
                                color="#ef4444"
                            />
                            <MetricItem
                                label="Failed auth"
                                subLabel="Failed auth attempts (ISE + AD)"
                                value={1}
                                unit=""
                                change={0}
                                sparkData={authData}
                                color="#0ea5e9"
                            />
                        </DashboardSection>

                        {/* BUILDING INTELLIGENCE */}
                        <DashboardSection
                            title="Building Intelligence"
                            linkText="Open building Intelligence"
                        >
                            <MetricItem
                                label="Active devices"
                                subLabel="Devices across Cisco Spaces"
                                value={54}
                                change={2600}
                                sparkData={activeDevData}
                                color="#10b981"
                            />
                            <MetricItem
                                label="Wi-Fi clients"
                                subLabel="Wireless clients on APs"
                                value={2}
                                change={0}
                                sparkData={wifiData}
                            />
                            <MetricItem
                                label="Occupancy"
                                subLabel="Occupied rooms as % of total"
                                value={0}
                                unit="%"
                                change={0}
                                sparkData={occupancyData}
                            />
                        </DashboardSection>
                    </div>

                    {/* Right Column - Regional Map */}
                    <div className="xl:col-span-5 h-full">
                        <div className="sticky top-24 bg-white rounded-lg border border-slate-200 p-6 shadow-sm h-fit">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h3 className="text-lg font-bold text-sky-900 uppercase tracking-wide">
                                        Regional Overview
                                    </h3>
                                    <p className="text-xs text-slate-400 font-medium">
                                        Florida District Real-Time Status
                                    </p>
                                </div>
                                <div className="flex bg-slate-100 p-1 rounded-md">
                                    <button
                                        type="button"
                                        className="px-3 py-1 text-[10px] font-bold bg-white shadow-sm rounded border border-slate-200 text-sky-600"
                                    >
                                        MAP
                                    </button>
                                    <button
                                        type="button"
                                        className="px-3 py-1 text-[10px] font-bold text-slate-400"
                                    >
                                        TABLE
                                    </button>
                                </div>
                            </div>

                            <FloridaMap />

                            <div className="mt-8 grid grid-cols-2 gap-4">
                                <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Shield className="w-3 h-3 text-red-500" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            Top Incident Volume
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">
                                        Auburndale Logistics
                                    </p>
                                </div>
                                <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Activity className="w-3 h-3 text-green-500" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                            Operational Lead
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">
                                        Tallahassee EOC
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 p-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                Splunk Adaptive Operations • Secure Executive Environment ©{' '}
                {new Date().getFullYear()}
            </footer>
        </div>
    );
};

export default OverviewPage;
