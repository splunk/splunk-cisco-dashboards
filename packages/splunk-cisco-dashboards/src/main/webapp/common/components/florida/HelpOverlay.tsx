import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUpRight, Keyboard, Settings2, X } from 'lucide-react';

interface ShortcutRow {
    keys: string;
    description: string;
}

interface HelpOverlayProps {
    open: boolean;
    onClose: () => void;
    shortcuts: ShortcutRow[];
}

const renderKeys = (keys: string): React.ReactNode =>
    keys.split(' ').map((k, i, arr) => (
        <React.Fragment key={`${k}-${i}`}>
            <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200">
                {k.length === 1 ? k.toUpperCase() : k}
            </kbd>
            {i < arr.length - 1 && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mx-1">
                    then
                </span>
            )}
        </React.Fragment>
    ));

/**
 * Scope-contract table for the "Customizing tiles" section (Build
 * 1205). Documents what each KPI-picker knob affects so the operator
 * has a single source of truth for per-tile vs. per-section vs.
 * drill-down semantics. The picker itself is the right place to *do*
 * customisation; this overlay is the right place to *explain* it.
 *
 * Keeping the data table-shaped (rather than prose) so it stays
 * scannable as the picker grows — adding a new scope tier later is a
 * one-row change, not a paragraph rewrite. Each row is a fact, not a
 * sentence.
 */
interface ScopeRow {
    action: string;
    scope: string;
}

const CUSTOMIZATION_SCOPE: ScopeRow[] = [
    {
        action: 'Data mapping, Value field, Label, Chart style, Thresholds',
        scope: 'This tile only',
    },
    {
        action: 'Display toggles + "Apply to all tiles in <section>"',
        scope: 'Every tile in the chosen section',
    },
    {
        action: 'Section title / section keyboard shortcut',
        scope: 'Opens the section dashboard in a new tab (drill-down)',
    },
    {
        action: '"Reset tile" button (picker footer)',
        scope: 'Clears every customisation on this tile',
    },
    {
        action: '"Factory reset" button (picker footer)',
        scope: 'Clears every customisation across the whole dashboard',
    },
];

export const HelpOverlay: React.FC<HelpOverlayProps> = ({ open, onClose, shortcuts }) => {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="help-overlay-title"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[3000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ y: 16, opacity: 0, scale: 0.97 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 8, opacity: 0, scale: 0.98 }}
                        // Build 1205: widened from max-w-md (~28rem) to
                        // max-w-2xl (~42rem) so the scope-contract
                        // table can sit side-by-side with the
                        // keyboard-shortcuts list on desktop without
                        // either getting cramped. Falls back to a
                        // single column on smaller viewports via the
                        // `lg:` breakpoint on the inner grid.
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2
                                id="help-overlay-title"
                                className="text-sm font-black text-sky-900 dark:text-sky-200 uppercase tracking-widest"
                            >
                                Help &amp; reference
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close help"
                                className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* KEYBOARD SHORTCUTS column.
                              *
                              * Unchanged from the original overlay
                              * (Build 1198 vintage). Visual treatment
                              * is identical so power users who learned
                              * the previous overlay aren't disoriented
                              * by the wider modal — same kbd chips,
                              * same row layout, same "then" connector
                              * for chord-style shortcuts. */}
                            <section>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <Keyboard className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                                    <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                        Keyboard shortcuts
                                    </h3>
                                </div>
                                <ul className="space-y-2">
                                    {shortcuts.map((s) => (
                                        <li
                                            key={s.keys}
                                            className="flex items-center justify-between gap-3 text-[12px]"
                                        >
                                            <span className="text-slate-700 dark:text-slate-200 leading-tight">
                                                {s.description}
                                            </span>
                                            <span className="flex items-center flex-shrink-0">
                                                {renderKeys(s.keys)}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            {/* CUSTOMIZING TILES column (Build 1205,
                              * closing the loop on Atef's "global vs
                              * per-KPI settings" framing from the
                              * 2026-05-19 review).
                              *
                              * Documents the picker's scope contract
                              * so operators know which actions are
                              * tile-local, which fan out to a section,
                              * and which open external dashboards.
                              * Lives here instead of inside the picker
                              * itself for two reasons:
                              *
                              *   1. The picker should be biased toward
                              *      *doing*, not *explaining* —
                              *      another text block per knob would
                              *      drown the form, so the full
                              *      reference lives here instead.
                              *
                              *   2. The `?` overlay is the canonical
                              *      "how does this dashboard work"
                              *      surface; users already learn to
                              *      open it for shortcuts, so adding
                              *      tile semantics here uses an
                              *      existing habit rather than
                              *      inventing a new one. */}
                            <section>
                                <div className="flex items-center gap-1.5 mb-3">
                                    <Settings2 className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                                    <h3 className="text-[11px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                        Customizing tiles
                                    </h3>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-300 mb-3 leading-snug">
                                    Right-click any tile to open the picker. Most
                                    customisations stay scoped to the tile you
                                    opened it from — a few fan out further, summarised
                                    below.
                                </p>
                                <ul className="space-y-2">
                                    {CUSTOMIZATION_SCOPE.map((row) => (
                                        <li
                                            key={row.action}
                                            className="text-[11px] leading-snug"
                                        >
                                            <div className="text-slate-700 dark:text-slate-200 font-semibold">
                                                {row.action}
                                            </div>
                                            <div className="text-slate-500 dark:text-slate-400 text-[10px]">
                                                → {row.scope}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 leading-snug flex items-start gap-1.5">
                                    <ArrowUpRight className="w-3 h-3 mt-0.5 text-sky-500 dark:text-sky-400 flex-shrink-0" />
                                    <span>
                                        KPI tiles stay single-value by design. For
                                        tables, breakdowns, or alternative
                                        visualisations open the section dashboard via
                                        the section title or keyboard shortcuts.
                                    </span>
                                </p>
                            </section>
                        </div>

                        <p className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 dark:text-slate-500">
                            Shortcuts are disabled while typing in inputs. Press{' '}
                            <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono">
                                Esc
                            </kbd>{' '}
                            or click outside to close.
                        </p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
