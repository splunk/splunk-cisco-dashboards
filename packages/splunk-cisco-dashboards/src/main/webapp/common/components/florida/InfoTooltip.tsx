/**
 * InfoTooltip — small hover/focus-revealed help bubble.
 *
 * Renders an `Info` icon that, on hover or keyboard focus, exposes a
 * popover with the supplied description. No state; visibility is
 * driven entirely by `:hover` and `:focus-within` Tailwind variants
 * so it remains accessible without trapping focus and adds no React
 * tree churn.
 *
 * The popover supports two anchor variants ("auto"=below, "left"=
 * appears beneath but right-aligned to the trigger) so we can use it
 * inside narrow flex rows without overflowing the section bounds.
 */

import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/common/lib/utils';

export type InfoTooltipAnchor = 'auto' | 'left' | 'right';

interface InfoTooltipProps {
    /** Heading shown bold at the top of the popover. */
    title?: string;
    /** Body text — supports a few short lines. */
    description: string;
    /** Optional micro-caption shown italic at the bottom (e.g. SPL stanza name). */
    footnote?: string;
    /** Where to anchor the popover relative to the icon. */
    anchor?: InfoTooltipAnchor;
    /**
     * Accessible label for the icon button when no surrounding label
     * makes the purpose obvious. Defaults to "What does this mean?".
     */
    iconAriaLabel?: string;
    className?: string;
}

const POSITION_CLASSES: Record<InfoTooltipAnchor, string> = {
    auto: 'left-1/2 -translate-x-1/2',
    left: 'left-0',
    right: 'right-0',
};

export const InfoTooltip: React.FC<InfoTooltipProps> = ({
    title,
    description,
    footnote,
    anchor = 'auto',
    iconAriaLabel = 'What does this mean?',
    className,
}) => {
    return (
        <span
            className={cn(
                'relative inline-flex group/info focus-within:outline-none',
                className
            )}
        >
            <button
                type="button"
                aria-label={iconAriaLabel}
                className="p-0.5 -my-0.5 text-slate-300 hover:text-sky-600 focus:text-sky-600 transition-colors rounded focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
                <Info className="w-3 h-3 stroke-[2.5px]" />
            </button>
            <span
                role="tooltip"
                className={cn(
                    'pointer-events-none absolute top-full mt-1.5 z-50',
                    'opacity-0 invisible translate-y-1',
                    'group-hover/info:opacity-100 group-hover/info:visible group-hover/info:translate-y-0',
                    'group-focus-within/info:opacity-100 group-focus-within/info:visible group-focus-within/info:translate-y-0',
                    'transition-all duration-150',
                    'w-[220px] max-w-[240px] p-2.5 rounded-md',
                    'bg-slate-900 text-slate-100 shadow-xl',
                    'text-[10.5px] leading-snug normal-case tracking-normal text-left',
                    POSITION_CLASSES[anchor]
                )}
            >
                {title && (
                    <span className="block font-bold text-white mb-0.5 normal-case">
                        {title}
                    </span>
                )}
                <span className="block text-slate-200 font-normal normal-case">
                    {description}
                </span>
                {footnote && (
                    <span className="block mt-1.5 pt-1.5 border-t border-slate-700 text-slate-400 italic text-[9.5px] font-mono break-all">
                        {footnote}
                    </span>
                )}
            </span>
        </span>
    );
};
