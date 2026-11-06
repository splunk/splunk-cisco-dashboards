"""Install missing compilation dependencies without changing project configuration."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
PROBE = """
const path = require('path');
const root = process.argv[1];
const app = path.join(root, 'packages/splunk-cisco-dashboards');
for (const name of ['webpack', 'webpack-cli', 'webpack-merge', '@splunk/webpack-configs',
 'copy-webpack-plugin', 'minimizer-webpack-plugin', 'fast-xml-parser', 'typescript',
 'babel-loader', '@babel/core', 'postcss-loader', 'tailwindcss', 'css-loader',
 'style-loader', 'patch-package']) require.resolve(name, {paths: [app, root]});
"""


def ensure():
    if not shutil.which('node'):
        raise RuntimeError('Dependency failure: Node.js >=20 is required.')
    env = dict(os.environ, NODE_OPTIONS='--max-old-space-size=4096', COREPACK_ENABLE_AUTO_PIN='0')
    def ready():
        return subprocess.run(['node', '-e', PROBE, str(ROOT)], cwd=ROOT, env=env,
                              capture_output=True, timeout=30).returncode == 0
    if ready():
        print('[dependencies] Compilation dependencies already installed.')
        return
    manager = ['yarn'] if shutil.which('yarn') else ['corepack', 'yarn']
    if not shutil.which(manager[0]):
        raise RuntimeError('Dependency failure: Yarn Classic 1.22.22 or Corepack is required.')
    version = subprocess.run(manager + ['--version'], cwd=ROOT, env=env,
                             capture_output=True, text=True, timeout=60)
    if version.returncode or version.stdout.strip() != '1.22.22':
        raise RuntimeError('Dependency failure: this project requires Yarn Classic 1.22.22.')
    files = [ROOT / name for name in ['yarn.lock', 'package.json', '.npmrc', '.yarnrc', '.yarnrc.yml']]
    files += list((ROOT / 'packages').glob('*/package.json'))
    def digest(p):
        return hashlib.sha256(p.read_bytes()).digest() if p.exists() else None
    before = {p: digest(p) for p in files}
    print('[dependencies] Installing locked dependencies, including development dependencies.', flush=True)
    result = subprocess.run(manager + ['install', '--frozen-lockfile', '--production=false', '--non-interactive'],
                            cwd=ROOT, env=env, timeout=900)
    if any(digest(p) != previous for p, previous in before.items()):
        raise RuntimeError('Dependency failure: package manager changed locked configuration; inspect changes before proceeding.')
    if result.returncode or not ready():
        raise RuntimeError('Dependency failure: locked dependency installation failed; compilation was not started.')


if __name__ == '__main__':
    try:
        ensure()
    except (RuntimeError, OSError, subprocess.TimeoutExpired) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
