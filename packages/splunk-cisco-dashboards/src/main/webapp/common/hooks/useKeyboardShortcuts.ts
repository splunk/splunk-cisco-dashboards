/**
 * useKeyboardShortcuts — declarative keymap binding.
 *
 * Supports two-key combos in the Vim/Gmail style: press `g` to enter a
 * "go" mode (within 1.2 s), then a second key dispatches navigation.
 * Single-key shortcuts dispatch immediately.
 *
 * Bindings are skipped while focus is inside an input / textarea /
 * contenteditable so the dashboard's controls don't hijack typing.
 */

import { useEffect, useRef } from 'react';

export interface ShortcutBinding {
    /**
     * Either a single key (e.g. "r", "?") or a two-character "go"
     * combo whose first char must be `g` (e.g. "g i", "g s").
     */
    keys: string;
    description: string;
    handler: () => void;
}

const isEditable = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

export const useKeyboardShortcuts = (
    bindings: ShortcutBinding[],
    enabled = true
): void => {
    // Stash the latest bindings in a ref so the effect doesn't tear
    // down / rebuild every render.
    const bindingsRef = useRef(bindings);
    bindingsRef.current = bindings;

    useEffect(() => {
        if (!enabled) return undefined;
        let goMode = false;
        let goTimer: number | undefined;

        const onKey = (e: KeyboardEvent) => {
            if (isEditable(e.target)) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;

            // Build candidate strings: single key OR "g <key>" while in go mode.
            const key = e.key.length === 1 ? e.key : e.key;
            const candidates: string[] = [];
            if (goMode) candidates.push(`g ${key.toLowerCase()}`);
            candidates.push(key.toLowerCase());

            for (const cand of candidates) {
                const match = bindingsRef.current.find(
                    (b) => b.keys.toLowerCase() === cand
                );
                if (match) {
                    e.preventDefault();
                    match.handler();
                    goMode = false;
                    if (goTimer) window.clearTimeout(goTimer);
                    return;
                }
            }

            // Enter go mode on `g` so the next key can be combined.
            if (!goMode && key.toLowerCase() === 'g') {
                goMode = true;
                if (goTimer) window.clearTimeout(goTimer);
                goTimer = window.setTimeout(() => {
                    goMode = false;
                }, 1200);
            } else {
                goMode = false;
                if (goTimer) window.clearTimeout(goTimer);
            }
        };

        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            if (goTimer) window.clearTimeout(goTimer);
        };
    }, [enabled]);
};
