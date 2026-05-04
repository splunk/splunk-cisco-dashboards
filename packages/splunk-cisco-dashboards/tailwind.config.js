/** @type {import('tailwindcss').Config} */
module.exports = {
    // Scope generated utilities with a parent selector so Tailwind's reset
    // (Preflight) and utility classes don't bleed into Splunk Web's own
    // chrome around the dashboard panel.
    important: '#scan-root',
    // Class-based dark mode. We toggle the `dark` class on the page-level
    // wrapper (still inside #scan-root), so Splunk Web's own chrome is
    // unaffected — only the dashboard surface flips between palettes.
    darkMode: 'class',
    corePlugins: {
        // Disable Preflight to avoid stomping on Splunk Web's base styles
        // for headings, buttons, etc. We re-introduce only the resets we
        // need scoped to #scan-root in our entry CSS.
        preflight: false,
    },
    content: [
        './src/main/webapp/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    'ui-sans-serif',
                    'system-ui',
                    '-apple-system',
                    'BlinkMacSystemFont',
                    '"Segoe UI"',
                    'Roboto',
                    '"Helvetica Neue"',
                    'Arial',
                    'sans-serif',
                ],
                mono: [
                    'ui-monospace',
                    'SFMono-Regular',
                    'Menlo',
                    'Monaco',
                    'Consolas',
                    '"Liberation Mono"',
                    'monospace',
                ],
            },
        },
    },
    plugins: [],
};
