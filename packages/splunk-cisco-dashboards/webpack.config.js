const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const webpack = require('webpack');
const { merge: webpackMerge } = require('webpack-merge');
const baseConfig = require('@splunk/webpack-configs').default;
const CopyPlugin = require('copy-webpack-plugin');

/**
 * Inject the app version from the repo-root VERSION file and a unique build
 * marker for the React bundles to read. Packaging replaces that marker only in
 * its temporary archive copy after allocating the final [install] build.
 *
 * Why version comes from VERSION (not package.json or app.conf):
 *   • VERSION is the single source of truth for releases —
 *     package_app.sh stamps it into staged app.conf at package
 *     time, matching the packaged Splunk app identity.
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
 * VERSION falls back to the source app.conf template only when the root file
 * cannot be read; that template intentionally remains 0.0.0.
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
// Packaging replaces this unique marker with the allocated package build.
// Reading source app.conf here would make watcher output look release-ready
// before packaging has validated the identity and copied the bundle.
const APP_BUILD = process.env.SCD_APP_BUILD || '__SCD_PACKAGE_BUILD__';
const APP_VERSION = readBuildVersion();
const MEBIBYTE = 1024 * 1024;
const FAST_UNMINIFIED_BUILD = process.argv.includes('--no-optimization-minimize');

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

const SOURCE_MAP_DIRECTIVE_PATTERN = /^[ \t]*(?:\/\/|\/\*)[#@]\s*sourceMappingURL\s*=[^\r\n]*(?:\*\/)?(?:\r?\n|$)/gm;

class StripSourceMapDirectivesPlugin {
    apply(compiler) {
        compiler.hooks.thisCompilation.tap('StripSourceMapDirectivesPlugin', (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: 'StripSourceMapDirectivesPlugin',
                    stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
                },
                (assets) => {
                    Object.keys(assets)
                        .filter((assetName) => assetName.endsWith('.js'))
                        .forEach((assetName) => {
                            const asset = compilation.getAsset(assetName);
                            const source = asset.source.source().toString();
                            const stripped = source.replace(SOURCE_MAP_DIRECTIVE_PATTERN, '');
                            if (stripped !== source) {
                                compilation.updateAsset(assetName, new webpack.sources.RawSource(stripped));
                            }
                        });
                },
            );
        });
    }
}

class StampSplunkMetadataPlugin {
    apply(compiler) {
        compiler.hooks.afterEmit.tap('StampSplunkMetadataPlugin', () => {
            const result = spawnSync(
                'bash',
                [path.join(__dirname, 'bin/stamp_version.sh'), stageRoot],
                {
                    cwd: __dirname,
                    encoding: 'utf8',
                }
            );
            if (result.stdout) process.stdout.write(result.stdout);
            if (result.status !== 0) {
                throw new Error(
                    result.stderr || 'Could not stamp VERSION into staged Splunk metadata.'
                );
            }
        });
    }
}

const commonConfig = webpackMerge(baseConfig, {
    // SplunkBase archives must not expose source maps. Keep this explicit so a
    // future inherited webpack-default change cannot silently publish them.
    devtool: false,
    entry: {
        executive_insights: path.join(
            webappRoot,
            'pages/executive_insights/render.tsx'
        ),
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
        secure_networking_pillars: path.join(
            webappRoot,
            'pages/secure_networking_pillars/render.tsx'
        ),
        dashboardbuilder: path.join(webappRoot, 'pages/dashboardbuilder/index.jsx'),
    },
    output: {
        path: path.join(stageRoot, 'appserver', 'static', 'pages'),
        filename: '[name].js',
    },
    stats: 'errors-warnings',
    // Webpack's default 244 KiB budget targets small public web pages. These
    // are intentionally self-contained Splunk application entrypoints, and
    // watch mode is deliberately unminified for fast rebuilds. Keep warnings
    // meaningful by applying explicit JavaScript-only budgets with modest
    // headroom over the measured baseline instead of warning on every build
    // (or disabling performance hints altogether).
    performance: {
        hints: 'warning',
        maxAssetSize: (FAST_UNMINIFIED_BUILD ? 42 : 12) * MEBIBYTE,
        maxEntrypointSize: (FAST_UNMINIFIED_BUILD ? 42 : 12) * MEBIBYTE,
        assetFilter: (assetFilename) => assetFilename.endsWith('.js'),
    },
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
        new StripSourceMapDirectivesPlugin(),
        new StampSplunkMetadataPlugin(),
        new CopyPlugin({
            patterns: [
                {
                    from: splunkRoot,
                    to: stageRoot,
                    globOptions: {
                        // Keep common local-secret artifacts out of every staged app,
                        // including watcher-linked development installs. SplunkBase
                        // packaging independently rejects *all* ignored source inputs
                        // below src/main/resources/splunk so a clean Git status cannot
                        // mask an archive-only secret.
                        ignore: [
                            '**/.DS_Store',
                            '**/__pycache__/**',
                            '**/*.pyc',
                            '**/.env',
                            '**/.env.*',
                            '**/*.key',
                            '**/*.pem',
                            '**/*.p12',
                            '**/*.pfx',
                        ],
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
