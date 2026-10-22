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
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        target.getAttribute('role') === 'textbox';
};

export const useKeyboardShortcuts = (
    bindings: ShortcutBinding[],
    enabled = true,
    scopeRef: { readonly current: HTMLElement | null } | undefined = undefined
): void => {
    // Stash the latest bindings in a ref so the effect doesn't tear
    // down / rebuild every render.
    const bindingsRef = useRef(bindings);
    bindingsRef.current = bindings;

    useEffect(() => {
        if (!enabled) return undefined;
        let goMode = false;
        let goTimer: number | undefined;
        const resetGoMode = () => {
            goMode = false;
            if (goTimer) window.clearTimeout(goTimer);
        };

        const onKey = (e: KeyboardEvent) => {
            // Shadow DOM retargets e.target to the component host. The
            // composed path retains the editable element in open roots.
            // Scoping also protects closed-root editors and external portals.
            const path = e.composedPath();
            const isPageBackground =
                (e.target === document.body || e.target === document.documentElement) &&
                (document.activeElement === document.body || document.activeElement === document.documentElement);
            if (
                e.defaultPrevented || e.isComposing || e.repeat ||
                e.metaKey || e.ctrlKey || e.altKey ||
                path.some(isEditable) || isEditable(e.target) ||
                (scopeRef && (!scopeRef.current ||
                    (!path.includes(scopeRef.current) && !isPageBackground)))
            ) {
                resetGoMode();
                return;
            }

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
                    resetGoMode();
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
                resetGoMode();
            }
        };

        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            if (goTimer) window.clearTimeout(goTimer);
        };
    }, [enabled, scopeRef]);
};
