const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(root, 'bin/build.js'), 'utf8');

function simulateBuild(minify, failure = -1) {
  const calls = [];
  const fakeProcess = {
    argv: ['node', 'bin/build.js', 'build', ...(minify ? ['--minify'] : [])],
    env: {}, execPath: process.execPath,
    exit(code) { throw new Error(`exit ${code}`); },
  };
  const context = {
    __dirname: path.join(root, 'bin'), process: fakeProcess,
    console: { log() {}, error() {} },
    require(name) {
      if (name === 'child_process') return {
        spawnSync(command, args, options) {
          calls.push({ command, args: Array.from(args), options });
          return { status: calls.length - 1 === failure ? 7 : 0 };
        },
      };
      if (name === '../webpack.config.js') return () => ({
        entry: { first: 'first.tsx', second: 'second.tsx' },
      });
      return require(name);
    },
  };
  let error;
  try { vm.runInNewContext(script, context); } catch (e) { error = e; }
  return { calls, error };
}

test('release compilation completes every entry before asset verification', () => {
  const { calls, error } = simulateBuild(true);
  assert.ifError(error);
  assert.deepEqual(calls.map((c) => c.args), [
    ['--mode', 'production', '--env', 'buildEntry=first'],
    ['--mode', 'production', '--env', 'buildEntry=second'],
    ['bin/verify_production_assets.js'],
  ]);
  assert.ok(calls.every((c) => c.options.shell === false));
  assert.equal(calls[0].options.env.NODE_ENV, 'production');
  assert.equal(calls[1].options.env.BABEL_ENV, 'production');
});

test('a failed entry stops the release without claiming complete assets', () => {
  const { calls, error } = simulateBuild(true, 1);
  assert.match(error.message, /exit 7/);
  assert.equal(calls.length, 2);
});

test('fast builds retain one multi-entry compiler', () => {
  const { calls, error } = simulateBuild(false);
  assert.ifError(error);
  assert.deepEqual(calls[0].args, ['--mode', 'production', '--no-optimization-minimize']);
  assert.equal(calls.length, 2);
});

test('entry selection is allowlisted and asynchronous chunk names cannot collide', () => {
  const config = require('../webpack.config.js');
  const all = config();
  assert.ok(Object.keys(all.entry).length > 1);
  for (const name of Object.keys(all.entry)) {
    const selected = config({ buildEntry: name });
    assert.deepEqual(selected.entry, { [name]: all.entry[name] });
    assert.equal(selected.output.path, all.output.path);
    assert.match(selected.output.chunkFilename, /\[contenthash\]/);
  }
  assert.throws(() => config({ buildEntry: '../unlisted' }), /Unknown build entry/);
});
