import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

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
                        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2
                                id="help-overlay-title"
                                className="text-sm font-black text-sky-900 dark:text-sky-200 uppercase tracking-widest"
                            >
                                Keyboard shortcuts
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
                        <ul className="space-y-2">
                            {shortcuts.map((s) => (
                                <li
                                    key={s.keys}
                                    className="flex items-center justify-between text-[12px]"
                                >
                                    <span className="text-slate-700 dark:text-slate-200">
                                        {s.description}
                                    </span>
                                    <span className="flex items-center">
                                        {renderKeys(s.keys)}
                                    </span>
                                </li>
                            ))}
                        </ul>
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
