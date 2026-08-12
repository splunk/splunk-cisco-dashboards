import React from 'react';
import DOMPurify from 'dompurify';

import { ChevronDown } from '@/common/icons/SuiIcon';
import { cn } from '@/common/lib/utils';

export interface SearchbaseDrilldownMetadata {
    title: string;
    category: string;
    subCategory: string;
    description: string;
    explanation: string;
    solution: string;
    relatedInfo: string;
    executionPlan: string;
}

interface SearchbaseDrilldownGuidanceProps {
    metadata: SearchbaseDrilldownMetadata;
    appearance?: 'manager' | 'workspace';
    defaultExpanded?: boolean;
}

interface MetadataBlockProps {
    title: string;
    html: string;
    appearance: 'manager' | 'workspace';
}

const openMetadataLinksInNewTabs = (html: string): string => {
    if (!html || typeof document === 'undefined') {return html;}

    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((anchor) => {
        anchor.setAttribute('target', '_blank');
        anchor.setAttribute('rel', 'noopener noreferrer');
    });
    return template.innerHTML;
};

const sanitizeMetadataHtml = (value: string): string => {
    const sanitized = DOMPurify.sanitize(value || '', {
        USE_PROFILES: { html: true },
        ADD_ATTR: ['target'],
    });
    return openMetadataLinksInNewTabs(sanitized);
};

const MetadataBlock: React.FC<MetadataBlockProps> = ({ title, html, appearance }) => {
    if (!html) {return null;}

    if (appearance === 'manager') {
        return (
            <section className="dashboard-builder-drilldown-metadata-block">
                <h3>{title}</h3>
                {/* Searchbase metadata is sanitized before it reaches this renderer. */}
                {/* eslint-disable-next-line react/no-danger */}
                <div dangerouslySetInnerHTML={{ __html: html }} />
            </section>
        );
    }

    return (
        <section className="min-w-0 rounded-lg border sui-border-weak sui-bg-page p-3">
            <h4 className="mb-1.5  font-black uppercase tracking-[0.16em] sui-color-info">
                {title}
            </h4>
            {/* Searchbase metadata is sanitized before it reaches this renderer. */}
            {/* eslint-disable-next-line react/no-danger */}
            <div
                className="sui-guidance-content text-xs leading-relaxed sui-color-default [&_a]:font-semibold [&_a]:underline [&_code]:rounded [&_code]:border [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_li]:mb-1 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:my-1 [&_ul]:ml-4 [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </section>
    );
};

/**
 * Shared Searchbase guidance used by Dashboard Manager and Insights Workspace.
 * It renders metadata already present in the loaded catalogue and never
 * dispatches a search or performs a second catalogue request.
 */
export const SearchbaseDrilldownGuidance: React.FC<SearchbaseDrilldownGuidanceProps> = ({
    metadata,
    appearance = 'workspace',
    defaultExpanded = true,
}) => {
    const [expanded, setExpanded] = React.useState(defaultExpanded);
    const guidanceId = React.useId();
    const sanitized = React.useMemo(
        () => ({
            description: sanitizeMetadataHtml(metadata.description),
            explanation: sanitizeMetadataHtml(metadata.explanation),
            solution: sanitizeMetadataHtml(metadata.solution),
            relatedInfo: sanitizeMetadataHtml(metadata.relatedInfo),
            executionPlan: sanitizeMetadataHtml(metadata.executionPlan),
        }),
        [metadata]
    );
    const sectionCount = Object.values(sanitized).filter(Boolean).length;

    if (sectionCount === 0) {return null;}

    const columns = (
        <>
            <div>
                <MetadataBlock
                    title="Description"
                    html={sanitized.description}
                    appearance={appearance}
                />
                <MetadataBlock
                    title="Explanation"
                    html={sanitized.explanation}
                    appearance={appearance}
                />
                <MetadataBlock
                    title="Related information"
                    html={sanitized.relatedInfo}
                    appearance={appearance}
                />
            </div>
            <div>
                <MetadataBlock
                    title="Solution"
                    html={sanitized.solution}
                    appearance={appearance}
                />
                <MetadataBlock
                    title="Execution plan"
                    html={sanitized.executionPlan}
                    appearance={appearance}
                />
            </div>
        </>
    );

    if (appearance === 'manager') {
        return (
            <div
                className="dashboard-builder-drilldown-metadata"
                data-searchbase-drilldown-guidance="manager"
            >
                {columns}
            </div>
        );
    }

    return (
        <section
            className={cn(
                'border-t sui-border-weak sui-bg-page',
                expanded ? 'flex min-h-[120px] flex-1 flex-col' : 'shrink-0'
            )}
            data-searchbase-drilldown-guidance="workspace"
        >
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls={guidanceId}
                onClick={() => setExpanded((current) => !current)}
                className="flex h-10 w-full items-center gap-2 px-4 text-left transition-colors sui-hover-bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-inset sui-focus-visible-ring"
            >
                <span className="sui-color-default font-black uppercase tracking-[0.14em] sui-color-default">
                    Search guidance
                </span>
                <span className="text-xs sui-color-default">
                    Description, explanation, remediation, and references
                </span>
                <span className="ml-auto rounded-full border sui-border-info sui-bg-accent px-2 py-0.5  font-bold sui-color-info">
                    {sectionCount} sections
                </span>
                <ChevronDown
                    className={cn(
                        'h-3.5 w-3.5 sui-color-default transition-transform',
                        expanded && 'rotate-180'
                    )}
                    aria-hidden="true"
                />
            </button>
            {expanded && (
                <div
                    id={guidanceId}
                    className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto overscroll-contain border-t sui-border-weak p-3 lg:grid-cols-2"
                >
                    {columns}
                </div>
            )}
        </section>
    );
};

export default SearchbaseDrilldownGuidance;
