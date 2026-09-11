"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const appPackage = JSON.parse(
  fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
);
const rootPackage = JSON.parse(
  fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
);
const lockfile = fs.readFileSync(path.join(repositoryRoot, "yarn.lock"), "utf8");

const parseVersion = (range, dependency, { allowMinimum = false } = {}) => {
  const match = range.match(
    allowMinimum
      ? /^(?:\^|>=)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/
      : /^\^?(\d+)\.(\d+)\.(\d+)$/,
  );
  assert.ok(match, `${dependency} must use a concrete semver range`);
  return match.slice(1).map((part) => Number(part || 0));
};

const atLeast = (actual, minimum) =>
  actual[0] > minimum[0] ||
  (actual[0] === minimum[0] &&
    (actual[1] > minimum[1] ||
      (actual[1] === minimum[1] && actual[2] >= minimum[2])));

const lockEntryFor = (dependency, range) => {
  const entry = lockfile.split("\n\n").find((candidate) => {
    const header = candidate.split("\n", 1)[0];
    return (
      header.startsWith(`${dependency}@`) &&
      (header.includes(`${dependency}@${range}:`) ||
        header.includes(`${dependency}@${range},`))
    );
  });
  assert.ok(entry, `yarn.lock must contain ${dependency}@${range}`);
  return entry;
};

const domRange = appPackage.dependencies["react-router-dom"];
const domVersion = parseVersion(domRange, "react-router-dom");
const routerRange = rootPackage.resolutions["react-router"];
const routerVersion = parseVersion(routerRange, "react-router");

assert.ok(
  atLeast(domVersion, [7, 18, 2]),
  "react-router-dom must stay on a supported release that includes the 7.18.2 security fixes",
);
assert.deepEqual(
  routerVersion,
  domVersion,
  "the root resolution must pin react-router to the same release line as react-router-dom",
);
assert.ok(
  atLeast(parseVersion(appPackage.engines.node, "Node.js", { allowMinimum: true }), [20, 0, 0]),
  "the declared Node.js baseline must satisfy React Router 7",
);
assert.match(
  lockEntryFor("react-router-dom", domRange),
  new RegExp(`\\n  version "${domVersion.join("\\.")}"`),
  "yarn.lock must resolve the declared react-router-dom release",
);
assert.match(
  lockEntryFor("react-router", routerRange),
  new RegExp(`\\n  version "${routerVersion.join("\\.")}"`),
  "yarn.lock must resolve the root react-router security resolution",
);
assert.doesNotMatch(
  lockfile,
  /^react-router(?:-dom)?@\^?6\./m,
  "the unsupported React Router 6 line must not remain in the lockfile",
);

const reactRange = appPackage.dependencies.react;
const reactDomRange = appPackage.dependencies["react-dom"];
const reactVersion = parseVersion(reactRange, "react");
const reactDomVersion = parseVersion(reactDomRange, "react-dom");
assert.deepEqual(
  reactVersion,
  [18, 3, 1],
  "the app must stay on React 18.3.1, the latest 18.x Splunk UI supports",
);
assert.deepEqual(
  reactDomVersion,
  reactVersion,
  "react-dom must stay on the same React 18.3.1 release as react",
);
assert.equal(
  rootPackage.resolutions.react,
  "18.3.1",
  "the root resolution must pin a single React 18.3.1 copy",
);
assert.equal(
  rootPackage.resolutions["react-dom"],
  "18.3.1",
  "the root resolution must pin a single react-dom 18.3.1 copy",
);
assert.equal(
  rootPackage.resolutions["@types/react"],
  "18.3.31",
  "the root resolution must keep TypeScript on React 18 types",
);
assert.equal(
  rootPackage.resolutions["@types/react-dom"],
  "18.3.7",
  "the root resolution must keep TypeScript on react-dom 18 types",
);
assert.match(
  lockEntryFor("react", reactRange),
  /\n  version "18\.3\.1"/,
  "yarn.lock must resolve the declared React 18.3.1 release",
);
assert.match(
  lockEntryFor("react-dom", reactDomRange),
  /\n  version "18\.3\.1"/,
  "yarn.lock must resolve the declared react-dom 18.3.1 release",
);
assert.doesNotMatch(
  lockfile,
  /^react(?:-dom)?@\^?19\./m,
  "React 19 must not enter the lockfile while Splunk UI peers stop at 18",
);
assert.doesNotMatch(
  lockfile,
  /^"?@types\/react@[^"\n]*"?\n  version "19\./m,
  "React 19 TypeScript types must not remain in the lockfile",
);

console.log("React Router resolves to the supported security-maintenance line.");
console.log("React 18.3.1 and matching types stay pinned below Splunk UI's peer ceiling.");
