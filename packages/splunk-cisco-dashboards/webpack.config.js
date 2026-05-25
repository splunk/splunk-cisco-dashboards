const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const { merge: webpackMerge } = require('webpack-merge');
const baseConfig = require('@splunk/webpack-configs').default;
const CopyPlugin = require('copy-webpack-plugin');

/**
 * Build 115.21 — read the canonical `build = NNNN` and
 * `version = X.Y.Z` lines out of `default/app.conf` at webpack
 * compile time and inject them as `process.env.APP_BUILD` and
 * `process.env.APP_VERSION` for the React bundles to read.
 *
 * Why we read both from app.conf (not package.json):
 *   • app.conf IS the canonical Splunk-app metadata — it's
 *     what splunkd reports for the app version in
 *     `/services/apps/local/...` and what the Splunk Web Apps
 *     page displays. Pulling the same value into our UI badge
 *     keeps every surface that quotes a version in agreement.
 *   • package.json's `version` field belongs to the npm
 *     workspace ("0.1.0" today) and intentionally isn't kept
 *     in lock-step with the Splunk app version. Reading it
 *     for UI display would falsely advertise "v0.1.0" while
 *     splunkd reports "v1.0.10" — the kind of inconsistency
 *     that turns a support ticket into a 20-minute "wait,
 *     which version are you actually on?" detour.
 *
 * Why compile-time injection (not a runtime fetch):
 *   • The displayed value MATCHES the JS bytes that printed
 *     it. A runtime fetch would describe the SERVER's
 *     app.conf today, which can differ from the bundle the
 *     browser is executing if a cache mismatch exists. The
 *     whole point of surfacing the build tag is to detect
 *     exactly that mismatch (see Build 115.20 follow-up).
 *
 * Build 115.22 — fallbacks remain ('unknown' / '0.0.0') for
 * the unreachable case where app.conf is malformed; both keys
 * are required, so a missing match is a hard developer bug,
 * but a sane fallback beats a webpack crash.
 */
const readAppConfField = (key) => {
    try {
        const appConf = fs.readFileSync(
            path.join(__dirname, 'src/main/resources/splunk/default/app.conf'),
            'utf8'
        );
        // Anchor on a [stanza] header and a `key =` LHS so we
        // only match keys at column 0 — avoids false positives
        // on keys that happen to appear in comments or
        // explanation = blocks.
        const re = new RegExp(`^\\s*${key}\\s*=\\s*(\\S.*?)\\s*$`, 'm');
        const m = appConf.match(re);
        return m ? m[1] : null;
    } catch (_e) {
        return null;
    }
};
const APP_BUILD = readAppConfField('build') || 'unknown';
const APP_VERSION = readAppConfField('version') || '0.0.0';

/**
 * Multi-entry config: each Splunk dashboard ("view") has its own React
 * entrypoint that mounts into a `#scan-root` div inside an `<html>` panel
 * of the matching Simple XML view.
 *
 * Build output:
 *   stage/appserver/static/pages/<entry>.js
 *
 * The `default/` Splunk app config (app.conf, nav, views, static assets)
 * is copied verbatim into stage/ via CopyWebpackPlugin so that
 * `bin/build.js` can package the directory as a Splunk .tar.gz.
 *
 * TypeScript is handled by @babel/preset-typescript (declared in
 * .babelrc.js) — Babel strips types in-process; full type-checking is
 * available via `yarn typecheck` (tsc --noEmit).
 */

const webappRoot = path.join(__dirname, 'src/main/webapp');
const splunkRoot = path.join(__dirname, 'src/main/resources/splunk');
const stageRoot = path.join(__dirname, 'stage');

const commonConfig = webpackMerge(baseConfig, {
    entry: {
        overview: path.join(webappRoot, 'pages/overview/render.tsx'),
        health_monitoring: path.join(
            webappRoot,
            'pages/health_monitoring/render.tsx'
        ),
        topology_canvas_v1: path.join(
            webappRoot,
            'pages/topology_canvas_v1/render.tsx'
        ),
        network_diagram: path.join(
            webappRoot,
            'pages/network_diagram/render.tsx'
        ),
        searchbase_canvas: path.join(
            webappRoot,
            'pages/searchbase_canvas/render.tsx'
        ),
    },
    output: {
        path: path.join(stageRoot, 'appserver', 'static', 'pages'),
        filename: '[name].js',
    },
    stats: 'errors-warnings',
    module: {
        rules: [
            {
                test: /\.(t|j)sx?$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: { compact: true },
                },
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        // Disable url()/asset rewriting. Leaflet's CSS
                        // references a couple of PNGs (layers control, marker
                        // shadow) under a relative `images/` path; bundling
                        // them produces oddly-named assets in non-served
                        // locations. We override marker icons via the cdnjs
                        // CDN in FloridaMap.tsx and don't render the layers
                        // control, so the few remaining missing-image
                        // requests are harmless 404s rather than visible
                        // breakage.
                        options: { url: false, importLoaders: 1 },
                    },
                    'postcss-loader',
                ],
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
        alias: {
            '@': webappRoot,
        },
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: splunkRoot,
                    to: stageRoot,
                    globOptions: {
                        ignore: ['**/.DS_Store', '**/__pycache__/**', '**/*.pyc'],
                    },
                },
            ],
        }),
        new webpack.DefinePlugin({
            'process.env.APP_BUILD': JSON.stringify(APP_BUILD),
            'process.env.APP_VERSION': JSON.stringify(APP_VERSION),
        }),
    ],
});

module.exports = commonConfig;
