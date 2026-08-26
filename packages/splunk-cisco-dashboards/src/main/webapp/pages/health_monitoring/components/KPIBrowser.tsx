import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Filter, Search, X } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import type {
    KPISectionId,
    KPITemplate,
} from '@/data/kpi-templates';
import { KPI_SECTION_TITLES } from '@/data/kpi-templates';
import { iconRegistry } from './MetricCard';
import { useModalFocusTrap } from '@/common/hooks/useModalFocusTrap';

interface BindingInfo {
    instanceId: string;
    sectionId: KPISectionId;
}

interface KPIBrowserProps {
    open: boolean;
    targetSectionId: KPISectionId;
    templates: KPITemplate[];
    bindings: Record<string, BindingInfo | undefined>;
    initialQuery?: string;
    onClose: () => void;
    onSelect: (template: KPITemplate, sectionId: KPISectionId) => void;
    onJumpTo: (instanceId: string) => void;
}

const ALL_APPS = 'All Apps';
const ALL_CATEGORIES = 'All Categories';
const ALL_SUBCATEGORIES = 'All Sub-Categories';

const unique = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
    );

export const KPIBrowser: React.FC<KPIBrowserProps> = ({
    open,
    targetSectionId,
    templates,
    bindings,
    initialQuery = '',
    onClose,
    onSelect,
    onJumpTo,
}) => {
    const [query, setQuery] = useState(initialQuery);
    const [app, setApp] = useState(ALL_APPS);
    const [category, setCategory] = useState(ALL_CATEGORIES);
    const [subCategory, setSubCategory] = useState(ALL_SUBCATEGORIES);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const queryInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (!open) return;
        setQuery(initialQuery);
    }, [open, initialQuery]);

    useModalFocusTrap({
        isOpen: open,
        dialogRef,
        initialFocusRef: queryInputRef,
        onClose,
    });

    const apps = useMemo(() => [ALL_APPS, ...unique(templates.map((t) => t.app))], [templates]);
    const categories = useMemo(() => {
        const scoped = app === ALL_APPS ? templates : templates.filter((t) => t.app === app);
        return [ALL_CATEGORIES, ...unique(scoped.map((t) => t.category))];
    }, [app, templates]);
    const subCategories = useMemo(() => {
        const scoped = templates.filter(
            (t) =>
                (app === ALL_APPS || t.app === app) &&
                (category === ALL_CATEGORIES || t.category === category)
        );
        return [ALL_SUBCATEGORIES, ...unique(scoped.map((t) => t.subCategory))];
    }, [app, category, templates]);

    useEffect(() => {
        if (!categories.includes(category)) setCategory(ALL_CATEGORIES);
        if (!subCategories.includes(subCategory)) setSubCategory(ALL_SUBCATEGORIES);
    }, [categories, category, subCategories, subCategory]);

    const filteredTemplates = useMemo(() => {
        const q = query.trim().toLowerCase();
        return templates.filter((template) => {
            const facetMatch =
                (app === ALL_APPS || template.app === app) &&
                (category === ALL_CATEGORIES || template.category === category) &&
                (subCategory === ALL_SUBCATEGORIES ||
                    template.subCategory === subCategory);
            if (!facetMatch) return false;
            if (!q) return true;
            return [
                template.title,
                template.description,
                template.app,
                template.category,
                template.subCategory,
                ...template.tags,
            ]
                .join(' ')
                .toLowerCase()
                .includes(q);
        });
    }, [app, category, query, subCategory, templates]);

    if (!open || typeof document === 'undefined') return null;

    const portalTarget = document.getElementById('scan-root') ?? document.body;

    return createPortal(
        <div
            ref={dialogRef}
            className="fixed inset-0 z-[9996] flex items-start justify-center overflow-y-auto sui-bg-page px-4 py-8 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Browse KPI library"
            tabIndex={-1}
        >
            <div className="flex max-h-[88vh] w-[min(560px,96vw)] flex-col overflow-hidden rounded-xl border    shadow-2xl sui-border-default sui-bg-page sui-color-active">
                <header className="flex items-start justify-between gap-4 px-6 py-5">
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Browse KPI Library</h2>
                        <p className="mt-1 text-sm  sui-color-default">
                            Select a KPI for {KPI_SECTION_TITLES[targetSectionId]}.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close KPI library"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg sui-color-muted transition   focus:outline-none focus-visible:ring-2 sui-focus-visible-ring sui-hover-bg-overlay sui-hover-color-active"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="px-6 pb-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 sui-color-default" />
                        <input
                            ref={queryInputRef}
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Filter by name, description, or tag..."
                            className="h-10 w-full rounded-lg border   pl-10 pr-3 text-sm font-semibold outline-none sui-focus-border-info focus:ring-2 sui-focus-ring sui-border-default sui-bg-section"
                        />
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider  sui-color-default">
                        <Filter className="h-4 w-4 sui-color-muted" />
                        Filters
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                            {
                                label: 'APP',
                                value: app,
                                options: apps,
                                onChange: setApp,
                            },
                            {
                                label: 'CATEGORY',
                                value: category,
                                options: categories,
                                onChange: setCategory,
                            },
                            {
                                label: 'SUB-CAT',
                                value: subCategory,
                                options: subCategories,
                                onChange: setSubCategory,
                            },
                        ].map((filter) => (
                            <label key={filter.label} className="block">
                                <span className="text-xs font-black uppercase tracking-wide  sui-color-default">
                                    {filter.label}
                                </span>
                                <select
                                    value={filter.value}
                                    onChange={(event) => filter.onChange(event.target.value)}
                                    className="mt-2 h-10 w-full rounded-lg border   px-3 text-sm font-semibold outline-none sui-focus-border-info sui-border-default sui-bg-section"
                                >
                                    {filter.options.map((option) => (
                                        <option key={option} value={option}>
                                            {option}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        ))}
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto border-t  px-6 py-4 sui-border-weak">
                    <div className="space-y-3">
                        {filteredTemplates.map((template) => {
                            const binding = bindings[template.id];
                            const Icon = iconRegistry[template.icon];
                            return (
                                <div
                                    key={template.id}
                                    className={cn(
                                        'rounded-xl border p-4 transition',
                                        binding
                                            ? 'sui-border-notification-info sui-bg-notification-info'
                                            : 'sui-border-weak sui-hover-border-info'
                                    )}
                                >
                                    {binding && (
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <span className="rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide sui-border-notification-positive sui-bg-notification-positive sui-color-active">
                                                Bound: {KPI_SECTION_TITLES[binding.sectionId]}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onJumpTo(binding.instanceId);
                                                    onClose();
                                                }}
                                                className="text-xs font-black uppercase tracking-wide  transition  sui-color-active sui-hover-color-info"
                                            >
                                                Jump To
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex gap-3">
                                        {Icon && (
                                            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 sui-color-positive" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="text-base font-black leading-tight  sui-color-active">
                                                    {template.title}
                                                </h3>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (binding) {
                                                            onJumpTo(binding.instanceId);
                                                            onClose();
                                                            return;
                                                        }
                                                        onSelect(template, targetSectionId);
                                                    }}
                                                    className={cn(
                                                        'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 sui-focus-visible-ring',
                                                        binding
                                                            ? 'sui-color-info sui-hover-bg-info'
                                                            : 'sui-color-default  sui-hover-color-info sui-hover-bg-overlay'
                                                    )}
                                                    aria-label={
                                                        binding
                                                            ? `Jump to ${template.title}`
                                                            : `Add ${template.title}`
                                                    }
                                                >
                                                    <ArrowRight className="h-5 w-5" />
                                                </button>
                                            </div>
                                            <p className="mt-2 text-sm leading-6  sui-color-default">
                                                {template.description}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {template.tags.slice(0, 4).map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="rounded-full border   px-2 py-0.5 text-xs font-semibold  sui-border-default sui-bg-section sui-color-default"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="mt-3 text-xs font-semibold  sui-color-default">
                                                {template.app} <span className="px-2">.</span>{' '}
                                                {template.category}{' '}
                                                <span className="px-2">.</span>{' '}
                                                {template.subCategory}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredTemplates.length === 0 && (
                            <div className="rounded-xl border border-dashed  p-8 text-center text-sm font-semibold  sui-border-default sui-color-default">
                                No KPIs match the selected filters.
                            </div>
                        )}
                    </div>
                </div>

                <footer className="flex items-center justify-between border-t  px-6 py-4 text-sm sui-border-weak">
                    <span className="font-semibold  sui-color-default">
                        Showing {filteredTemplates.length} of {templates.length} KPIs
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-lg border  px-4 font-black transition sui-hover-border-info  sui-border-default sui-hover-color-info"
                    >
                        Cancel
                    </button>
                </footer>
            </div>
        </div>,
        portalTarget
    );
};
