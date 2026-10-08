"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const braces = require("braces");

const repositoryRoot = path.resolve(__dirname, "../../..");
const rootPackage = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const lockfile = fs.readFileSync(path.join(repositoryRoot, "yarn.lock"), "utf8");
const depthError = {
  name: "SyntaxError",
  message: "Brace pattern nesting exceeds maximum depth (100)",
};

const nestedAst = (depth) => {
  const root = { type: "root", nodes: [] };
  let parent = root;
  for (let index = 0; index < depth; index += 1) {
    const node = { type: "paren", nodes: [], parent };
    parent.nodes.push(node);
    parent = node;
  }
  parent.nodes.push({ type: "text", value: "a", parent });
  return root;
};

test("the lockfile retains patched versions for all released Dependabot fixes", () => {
  const minimumVersions = {
    dompurify: [3, 4, 16],
    "fast-uri": [3, 1, 8],
    "source-map-js": [1, 2, 2],
    "postcss-selector-parser": [7, 1, 6],
    "brace-expansion": [1, 1, 21],
  };
  for (const [dependency, minimum] of Object.entries(minimumVersions)) {
    const entries = lockfile
      .split("\n\n")
      .filter((entry) => entry.startsWith(`${dependency}@`));
    assert.ok(entries.length, `${dependency} must be present in the lockfile`);
    for (const entry of entries) {
      const match = entry.match(/\n  version "(\d+)\.(\d+)\.(\d+)"/);
      assert.ok(match, `${dependency} must resolve to a release version`);
      const actual = match.slice(1).map(Number);
      const atLeast =
        actual[0] > minimum[0] ||
        (actual[0] === minimum[0] &&
          (actual[1] > minimum[1] ||
            (actual[1] === minimum[1] && actual[2] >= minimum[2])));
      assert.ok(atLeast, `${dependency} must be at least ${minimum.join(".")}`);
    }
  }
  assert.doesNotMatch(lockfile, /^sprintf-js@/m);
});

test("the braces mitigation is pinned and applied automatically on installation", () => {
  assert.equal(rootPackage.resolutions.braces, "3.0.3");
  assert.equal(rootPackage.scripts.postinstall, "patch-package --error-on-fail");
  assert.ok(rootPackage.devDependencies["patch-package"]);
  assert.ok(
    fs.existsSync(path.join(repositoryRoot, "patches/braces+3.0.3.patch")),
  );
});

for (const method of ["parse", "compile", "expand", "stringify"]) {
  test(`braces.${method} accepts 100 nesting levels and rejects 101 or 4000`, () => {
    for (const [open, close] of [["{", "}"], ["(", ")"]]) {
      const input = (depth) => open.repeat(depth) + "a" + close.repeat(depth);
      assert.doesNotThrow(() => braces[method](input(100)));
      for (const depth of [101, 4000]) {
        assert.throws(() => braces[method](input(depth)), depthError);
      }
    }
    assert.throws(
      () => braces[method]("{(".repeat(51) + "a" + ")}".repeat(51)),
      depthError,
    );
    assert.doesNotThrow(() => braces[method]("\\" + "{".repeat(100) + "a"));
  });
}

for (const method of ["compile", "expand", "stringify"]) {
  test(`braces.${method} bounds caller-supplied AST recursion`, () => {
    assert.doesNotThrow(() => braces[method](nestedAst(100)));
    assert.throws(() => braces[method](nestedAst(101)), depthError);
    assert.throws(() => braces[method](nestedAst(4000)), depthError);
    const cyclic = { type: "root", nodes: [] };
    cyclic.nodes.push(cyclic);
    assert.throws(() => braces[method](cyclic), depthError);
  });
}

test("braces.expand rejects cyclic parent chains instead of hanging", () => {
  const cyclic = { type: "paren", nodes: [] };
  cyclic.parent = cyclic;
  assert.throws(() => braces.expand(cyclic), depthError);
});

test("normal brace patterns and stringify escaping preserve existing behavior", () => {
  assert.deepEqual(braces("a/{b,c}/d"), ["a/(b|c)/d"]);
  assert.deepEqual(braces.expand("a/{b,c}/d"), ["a/b/d", "a/c/d"]);
  assert.deepEqual(braces.expand("file-{01..03}.js"), [
    "file-01.js", "file-02.js", "file-03.js",
  ]);
  assert.deepEqual(braces.expand("{a,a,b}", { nodupes: true }), ["a", "b"]);
  assert.equal(braces.stringify("{a,b}", { escapeInvalid: true }), "{a,b}");
  assert.equal(braces.stringify("{a,b", { escapeInvalid: true }), "{a,b");
  assert.equal(braces.stringify("\\{a,b\\}"), "{a,b}");
  assert.equal(braces.stringify('"{a,b}"', { keepQuotes: true }), '"{a,b}"');
  assert.equal(braces.stringify("{a,b}".repeat(500)), "{a,b}".repeat(500));
});
