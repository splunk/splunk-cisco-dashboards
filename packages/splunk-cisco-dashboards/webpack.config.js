const path = require('path');
const { merge: webpackMerge } = require('webpack-merge');
const baseConfig = require('@splunk/webpack-configs').default;
const CopyPlugin = require('copy-webpack-plugin');

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
    ],
});

module.exports = commonConfig;
