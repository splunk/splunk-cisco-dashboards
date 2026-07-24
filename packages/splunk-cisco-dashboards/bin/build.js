#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Minimal build orchestrator for the Splunk Cisco Dashboards app.
 *
 * Subcommands:
 *   build   — runs webpack with production React and fast, unminified output
 *             by default; pass --minify for a smaller release build;
 *             webpack's CopyPlugin lays out the app under ./stage
 *   watch   — runs webpack watch with the same production environment
 *   clean   — wipes ./stage
 *   pack    — builds, then creates a Splunk-packaged tarball
 *   link    — symlinks $SPLUNK_HOME/etc/apps/splunk-cisco-dashboards
 *             into ./stage (matches splunk-cisco-app-navigator pattern)
 *   unlink  — removes the symlink (only if it points back into this repo)
 *
 * Usage:
 *   node bin/build.js build [--minify]
 *   node bin/build.js watch
 *   node bin/build.js clean
 *   node bin/build.js pack
 *   node bin/build.js link [/path/to/SPLUNK_HOME]
 *   node bin/build.js unlink [/path/to/SPLUNK_HOME]
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const STAGE_DIR = path.join(REPO_ROOT, 'stage');
const APP_DIR_NAME = 'splunk-cisco-dashboards';
const TARBALL = path.join(REPO_ROOT, `${APP_DIR_NAME}.tar.gz`);

const ALLOWED_COMMANDS = new Set(['build', 'watch', 'clean', 'pack', 'link', 'unlink']);

function run(cmd, args, opts = {}) {
    // We only ever spawn allow-listed binaries with hard-coded arguments;
    // user input is never forwarded to the shell.
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd: REPO_ROOT,
        shell: false,
        ...opts,
    });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function rimraf(target) {
    if (!fs.existsSync(target)) return;
    fs.rmSync(target, { recursive: true, force: true });
}

function clean() {
    console.log('› Cleaning stage/');
    rimraf(STAGE_DIR);
    rimraf(TARBALL);
}

function build({ minify = false } = {}) {
    console.log(
        minify
            ? '› Running webpack (production React, minification enabled — release build)'
            : '› Running webpack (production React, minification disabled)'
    );
    if (minify) {
        console.log(
            '› Minifying the large dashboard bundles can take 10+ minutes'
        );
    }
    const webpackArgs = ['--mode', 'production'];
    if (!minify) {
        webpackArgs.push('--no-optimization-minimize');
    }
    if (process.env.SCD_WEBPACK_PROGRESS === '1') {
        webpackArgs.push('--progress');
    }
    run(
        'node_modules/.bin/webpack',
        webpackArgs,
        {
            // Webpack's CLI mode controls its optimizer, but the inherited
            // Splunk webpack config and Babel preset inspect these process
            // variables while configuration is loading. Minification remains
            // opt-in because these large multi-entry bundles can spend several
            // minutes and gigabytes in Terser.
            env: {
                ...process.env,
                NODE_ENV: 'production',
                BABEL_ENV: 'production',
            },
        }
    );
    run(process.execPath, ['bin/verify_production_assets.js']);
    console.log(`✓ App staged at ${path.relative(REPO_ROOT, STAGE_DIR)}/`);
}

function watch() {
    console.log('› Running webpack watch (production React, fast rebuilds)');
    run(
        'node_modules/.bin/webpack',
        ['--watch', '--mode', 'production', '--no-optimization-minimize'],
        {
            // Fast packaging consumes stage/ directly, so watch output must use
            // production React just like a clean package build. Watch mode stays
            // unminified for responsive rebuilds; release builds opt in explicitly.
            env: {
                ...process.env,
                NODE_ENV: 'production',
                BABEL_ENV: 'production',
            },
        }
    );
}

function pack({ minify = false } = {}) {
    build({ minify });
    console.log('› Packaging Splunk app tarball');
    run('tar', [
        '-czf',
        TARBALL,
        '--exclude=.DS_Store',
        '-C',
        STAGE_DIR,
        '.',
    ]);
    console.log(`✓ Wrote ${path.relative(REPO_ROOT, TARBALL)}`);
}

function resolveSplunkHome() {
    const cliArg = process.argv[3];
    const fromEnv = process.env.SPLUNK_HOME;
    const candidate = cliArg || fromEnv || '/opt/splunk';
    // Reject anything that isn't an absolute, normalized path so we
    // can't be tricked into traversing somewhere unexpected.
    const resolved = path.resolve(candidate);
    if (!fs.existsSync(path.join(resolved, 'etc', 'apps'))) {
        throw new Error(
            `SPLUNK_HOME does not contain etc/apps: ${resolved}\n` +
                'Pass an explicit path: node bin/build.js link /path/to/SPLUNK_HOME'
        );
    }
    return resolved;
}

function link() {
    const splunkHome = resolveSplunkHome();
    const target = path.join(splunkHome, 'etc', 'apps', APP_DIR_NAME);

    if (!fs.existsSync(STAGE_DIR)) {
        console.log('› stage/ not present, running build first');
        build();
    }

    if (fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink()) {
        const isLink = fs.lstatSync(target).isSymbolicLink();
        if (isLink) {
            const current = fs.readlinkSync(target);
            if (path.resolve(current) === STAGE_DIR) {
                console.log(`✓ Symlink already up to date: ${target}`);
                return;
            }
            console.log(`› Removing stale symlink: ${target} -> ${current}`);
            fs.unlinkSync(target);
        } else {
            throw new Error(
                `Refusing to overwrite ${target} — it exists and is not a symlink. ` +
                    'Move or delete it manually first.'
            );
        }
    }

    fs.symlinkSync(STAGE_DIR, target);
    console.log(`✓ Linked ${target} -> ${STAGE_DIR}`);
    console.log(
        '› Restart Splunk (or visit Settings → Apps to discover) so the new app is registered.'
    );
}

function unlink() {
    const splunkHome = resolveSplunkHome();
    const target = path.join(splunkHome, 'etc', 'apps', APP_DIR_NAME);

    if (!fs.existsSync(target) && !fs.existsSync(target + '.broken')) {
        // lstat throws on missing path; check separately.
        try {
            fs.lstatSync(target);
        } catch (_) {
            console.log(`✓ No link present at ${target}`);
            return;
        }
    }

    let stat;
    try {
        stat = fs.lstatSync(target);
    } catch (_) {
        console.log(`✓ No link present at ${target}`);
        return;
    }

    if (!stat.isSymbolicLink()) {
        throw new Error(
            `Refusing to unlink ${target} — it is not a symlink. ` +
                'Inspect and remove manually.'
        );
    }

    const current = path.resolve(fs.readlinkSync(target));
    if (current !== STAGE_DIR) {
        throw new Error(
            `Refusing to unlink ${target} — it points at ${current}, not at this repo's stage/.`
        );
    }
    fs.unlinkSync(target);
    console.log(`✓ Unlinked ${target}`);
}

function main() {
    const cmd = process.argv[2];
    const commandArgs = process.argv.slice(3);
    if (!cmd || !ALLOWED_COMMANDS.has(cmd)) {
        console.error(
            `Usage: node bin/build.js <${[...ALLOWED_COMMANDS].join('|')}> [--minify]`
        );
        process.exit(2);
    }
    const supportsMinify = cmd === 'build' || cmd === 'pack';
    const invalidArgs = supportsMinify
        ? commandArgs.filter((arg) => arg !== '--minify')
        : cmd === 'link' || cmd === 'unlink'
          ? commandArgs.slice(1)
          : commandArgs;
    if (
        invalidArgs.length > 0 ||
        (!supportsMinify && commandArgs.includes('--minify'))
    ) {
        console.error(
            `ERROR: unsupported option for ${cmd}: ${
                invalidArgs[0] || '--minify'
            }`
        );
        console.error('--minify is supported only by build and pack.');
        process.exit(2);
    }
    const minify = supportsMinify && commandArgs.includes('--minify');
    switch (cmd) {
        case 'build':
            build({ minify });
            break;
        case 'watch':
            watch();
            break;
        case 'clean':
            clean();
            break;
        case 'pack':
            pack({ minify });
            break;
        case 'link':
            link();
            break;
        case 'unlink':
            unlink();
            break;
        default:
            // Defensive: ALLOWED_COMMANDS already gated above.
            process.exit(2);
    }
}

main();
