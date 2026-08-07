import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Filter, Search, X } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';
import type {
    KPISectionId,
    KPITemplate,
} from '@/data/kpi-templates';
import { KPI_SECTION_TITLES } from '@/data/kpi-templates';
import { iconRegistry } from './MetricCard';

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

    useEffect(() => {
        if (!open) return;
        setQuery(initialQuery);
    }, [open, initialQuery]);

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

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
            className="fixed inset-0 z-[9996] flex items-start justify-center overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Browse KPI library"
        >
            <div className="flex max-h-[88vh] w-[min(560px,96vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-950 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                <header className="flex items-start justify-between gap-4 px-6 py-5">
                    <div>
                        <h2 className="text-xl font-black tracking-tight">Browse KPI Library</h2>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            Select a KPI for {KPI_SECTION_TITLES[targetSectionId]}.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close KPI library"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="px-6 pb-4">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Filter by name, description, or tag..."
                            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-100 pl-10 pr-3 text-sm font-semibold outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 dark:border-slate-700 dark:bg-slate-900"
                        />
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        <Filter className="h-4 w-4 text-slate-500" />
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
                                <span className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                    {filter.label}
                                </span>
                                <select
                                    value={filter.value}
                                    onChange={(event) => filter.onChange(event.target.value)}
                                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 text-sm font-semibold outline-none focus:border-sky-400 dark:border-slate-700 dark:bg-slate-900"
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

                <div className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200 px-6 py-4 dark:border-slate-800">
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
                                            ? 'border-sky-300 bg-sky-50/70 dark:border-sky-800 dark:bg-sky-950/30'
                                            : 'border-slate-200 hover:border-sky-300 dark:border-slate-800 dark:hover:border-sky-600'
                                    )}
                                >
                                    {binding && (
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                            <span className="rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                Bound: {KPI_SECTION_TITLES[binding.sectionId]}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onJumpTo(binding.instanceId);
                                                    onClose();
                                                }}
                                                className="text-xs font-black uppercase tracking-wide text-slate-700 transition hover:text-sky-600 dark:text-slate-200 dark:hover:text-sky-300"
                                            >
                                                Jump To
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex gap-3">
                                        {Icon && (
                                            <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-500" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="text-base font-black leading-tight text-slate-900 dark:text-white">
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
                                                        'inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
                                                        binding
                                                            ? 'text-sky-600 hover:bg-sky-100 dark:text-sky-300 dark:hover:bg-sky-950'
                                                            : 'text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800'
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
                                            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                                {template.description}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-1.5">
                                                {template.tags.slice(0, 4).map((tag) => (
                                                    <span
                                                        key={tag}
                                                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                            <p className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
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
                            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                No KPIs match the selected filters.
                            </div>
                        )}
                    </div>
                </div>

                <footer className="flex items-center justify-between border-t border-slate-200 px-6 py-4 text-sm dark:border-slate-800">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                        Showing {filteredTemplates.length} of {templates.length} KPIs
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-10 rounded-lg border border-slate-200 px-4 font-black transition hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:hover:text-sky-300"
                    >
                        Cancel
                    </button>
                </footer>
            </div>
        </div>,
        portalTarget
    );
};
