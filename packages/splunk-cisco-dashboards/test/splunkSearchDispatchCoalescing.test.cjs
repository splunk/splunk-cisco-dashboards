const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { transformSync } = require('@babel/core');

const servicePath = path.resolve(
  __dirname,
  '../src/main/webapp/common/services/splunkSearchService.js',
);

const loadService = (fetchImpl) => {
  const source = fs.readFileSync(servicePath, 'utf8');
  const transformed = transformSync(source, {
    filename: servicePath,
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const module = { exports: {} };
  const previous = {
    document: global.document,
    fetch: global.fetch,
    window: global.window,
  };

  global.window = { $C: {}, location: { search: '' } };
  global.document = { cookie: '' };
  global.fetch = fetchImpl;

  const requireStub = (id) => {
    if (id === '@splunk/splunk-utils/search') {
      return {
        addLeadingSearchCommand: (spl) =>
          spl.startsWith('|') || spl.startsWith('search ') ? spl : `search ${spl}`,
      };
    }
    if (id === '@splunk/splunk-utils/url') {
      return { createRESTURL: () => '/services/search/v2/jobs' };
    }
    if (id === '@splunk/splunk-utils/fetch') {
      return {
        findErrorMessage: () => null,
        getDefaultFetchInit: () => ({}),
        handleResponse: () => async (response) => response.json(),
      };
    }
    return require(id);
  };

  const evaluate = new Function('require', 'module', 'exports', transformed);
  evaluate(requireStub, module, module.exports);

  return {
    service: module.exports,
    restore: () => {
      global.window = previous.window;
      global.document = previous.document;
      global.fetch = previous.fetch;
    },
  };
};

const nextTurn = () => new Promise((resolve) => setImmediate(resolve));

test('identical concurrent searches share one Splunk job', async () => {
  const pending = [];
  let fetchCount = 0;
  const loaded = loadService((_url, init) => {
    fetchCount += 1;
    return new Promise((resolve) => pending.push({ init, resolve }));
  });

  try {
    const params = {
      spl: '| makeresults | stats count',
      earliestTime: '-4h',
      latestTime: 'now',
      appContext: 'splunk-cisco-dashboards',
    };
    const first = loaded.service.runSearch({ ...params, tag: 'rail' });
    const second = loaded.service.runSearch({ ...params, tag: 'tile' });

    await nextTurn();
    assert.equal(fetchCount, 1);
    pending[0].resolve({
      status: 200,
      json: async () => ({ results: [{ count: '1' }] }),
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.deepEqual(firstResult, { results: [{ count: '1' }] });
    assert.deepEqual(secondResult, firstResult);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test('one consumer can abort without cancelling another consumer', async () => {
  const pending = [];
  const loaded = loadService((_url, init) =>
    new Promise((resolve) => pending.push({ init, resolve })),
  );

  try {
    const firstController = new AbortController();
    const secondController = new AbortController();
    const params = {
      spl: '| makeresults | stats count',
      earliestTime: '-4h',
      latestTime: 'now',
    };
    const first = loaded.service.runSearch({
      ...params,
      tag: 'rail',
      signal: firstController.signal,
    });
    const second = loaded.service.runSearch({
      ...params,
      tag: 'tile',
      signal: secondController.signal,
    });

    await nextTurn();
    firstController.abort();
    await assert.rejects(first, (err) => err?.name === 'AbortError');
    assert.equal(pending[0].init.signal.aborted, false);

    pending[0].resolve({
      status: 200,
      json: async () => ({ results: [{ count: '1' }] }),
    });
    assert.deepEqual(await second, { results: [{ count: '1' }] });
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test('a completed search is not reused by a later refresh', async () => {
  let fetchCount = 0;
  const loaded = loadService(async () => {
    fetchCount += 1;
    return {
      status: 200,
      json: async () => ({ results: [{ count: String(fetchCount) }] }),
    };
  });

  try {
    const params = {
      spl: '| makeresults | stats count',
      earliestTime: '-4h',
      latestTime: 'now',
    };
    assert.deepEqual(await loaded.service.runSearch(params), {
      results: [{ count: '1' }],
    });
    assert.deepEqual(await loaded.service.runSearch(params), {
      results: [{ count: '2' }],
    });
    assert.equal(fetchCount, 2);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});
