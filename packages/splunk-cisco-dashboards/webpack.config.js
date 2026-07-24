const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const { merge: webpackMerge } = require('webpack-merge');
const baseConfig = require('@splunk/webpack-configs').default;
const CopyPlugin = require('copy-webpack-plugin');

/**
 * Build 115.21 — read the canonical `build = NNNN` from
 * `default/app.conf` and the app version from the repo-root
 * `VERSION` file at webpack compile time, then inject them as
 * `process.env.APP_BUILD` and `process.env.APP_VERSION` for
 * the React bundles to read.
 *
 * Why version comes from VERSION (not package.json or app.conf):
 *   • VERSION is the single source of truth for releases —
 *     package_app.sh stamps it into staged app.conf at package
 *     time, matching splunk-cisco-app-navigator.
 *   • package.json's `version` field belongs to the npm
 *     workspace ("0.1.0" today) and intentionally isn't kept
 *     in lock-step with the Splunk app version.
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
const readBuildVersion = () => {
    const versionPath = path.join(__dirname, '..', '..', 'VERSION');
    try {
        const version = fs.readFileSync(versionPath, 'utf8').trim();
        if (version) return version;
    } catch (_e) {
        /* fall through */
    }
    return readAppConfField('version') || '0.0.0';
};
const APP_BUILD = readAppConfField('build') || 'unknown';
const APP_VERSION = readBuildVersion();

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
const workspaceRoot = path.resolve(__dirname, '..', '..');

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
        m365_activity_monitoring: path.join(
            webappRoot,
            'pages/m365_activity_monitoring/render.tsx'
        ),
        macro_index_tuning: path.join(
            webappRoot,
            'pages/macro_index_tuning/render.tsx'
        ),
        user_guide: path.join(webappRoot, 'pages/user_guide/render.tsx'),
        secure_operations_glass: path.join(
            webappRoot,
            'pages/secure_operations_glass/render.tsx'
        ),
        dashboardbuilder: path.join(webappRoot, 'pages/dashboardbuilder/index.jsx'),
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
                        // CDN in CustomerTopologyMap.tsx and don't render the layers
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
                {
                    from: path.join(workspaceRoot, 'LICENSE'),
                    to: path.join(stageRoot, 'LICENSE'),
                    toType: 'file',
                },
                {
                    from: path.join(workspaceRoot, 'NOTICE'),
                    to: path.join(stageRoot, 'NOTICE'),
                    toType: 'file',
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
