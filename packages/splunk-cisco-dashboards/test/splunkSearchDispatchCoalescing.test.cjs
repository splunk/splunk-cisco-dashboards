const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { transformSync } = require("@babel/core");

const servicePath = path.resolve(
  __dirname,
  "../src/main/webapp/common/services/splunkSearchService.js",
);

const loadService = (fetchImpl) => {
  const source = fs.readFileSync(servicePath, "utf8");
  const transformed = transformSync(source, {
    filename: servicePath,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const module = { exports: {} };
  const previous = {
    document: global.document,
    fetch: global.fetch,
    window: global.window,
  };

  global.window = { $C: {}, location: { search: "" } };
  global.document = { cookie: "" };
  global.fetch = fetchImpl;

  const requireStub = (id) => {
    if (id === "@splunk/splunk-utils/search") {
      return {
        addLeadingSearchCommand: (spl) =>
          spl.startsWith("|") || spl.startsWith("search ")
            ? spl
            : `search ${spl}`,
      };
    }
    if (id === "@splunk/splunk-utils/url") {
      return { createRESTURL: () => "/services/search/v2/jobs" };
    }
    if (id === "@splunk/splunk-utils/fetch") {
      return {
        findErrorMessage: (payload) => payload?.messages?.find((entry) => entry.text),
        getDefaultFetchInit: () => ({}),
        handleResponse: () => async (response) => response.json(),
      };
    }
    return require(id);
  };

  const evaluate = new Function("require", "module", "exports", transformed);
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

const parseSearchTrace = ([message]) => {
  const match = /^\[SSNE Search\] ([A-Z ]+) (\{.*\})$/.exec(message);
  assert.ok(match, `Expected serialized search trace, received: ${message}`);
  return { outcome: match[1], detail: JSON.parse(match[2]) };
};

test("managed searches create a SID, report progress, and fetch results", async () => {
  const requests = [];
  const responses = [
    { status: 201, json: async () => ({ sid: "cim-model-job" }) },
    {
      status: 200,
      json: async () => ({
        entry: [
          {
            content: {
              dispatchState: "DONE",
              doneProgress: "1",
              isDone: "1",
              isFinalized: "0",
            },
          },
        ],
      }),
    },
    { status: 200, json: async () => ({ results: [{ events: "42" }] }) },
  ];
  const loaded = loadService(async (url, init) => {
    requests.push({ url, init });
    return responses.shift();
  });

  try {
    const progress = [];
    const result = await loaded.service.runManagedSearch({
      spl: "| tstats count FROM datamodel=Network_Traffic",
      earliestTime: "-15m",
      latestTime: "now",
      maxTimeSeconds: 60,
      onProgress: (update) => progress.push(update),
    });

    assert.deepEqual(result, {
      results: [{ events: "42" }],
      sid: "cim-model-job",
      timedOut: false,
    });
    assert.equal(requests.length, 3);
    const dispatchBody = new URLSearchParams(requests[0].init.body);
    assert.equal(dispatchBody.get("exec_mode"), null);
    assert.equal(dispatchBody.get("max_time"), "60");
    assert.equal(dispatchBody.get("earliest_time"), "-15m");
    assert.deepEqual(progress, [
      { sid: "cim-model-job", dispatchState: "DONE", progress: 1 },
    ]);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("aborting a managed search cancels its server-side job", async () => {
  const requests = [];
  const loaded = loadService((url, init) => {
    requests.push({ url, init });
    if (requests.length === 1) {
      return Promise.resolve({
        status: 201,
        json: async () => ({ sid: "cancel-me" }),
      });
    }
    if (requests.length === 2) {
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener(
          "abort",
          () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          },
          { once: true },
        );
      });
    }
    return Promise.resolve({ status: 200, json: async () => ({}) });
  });

  try {
    const controller = new AbortController();
    const result = loaded.service.runManagedSearch({
      spl: "| tstats count FROM datamodel=Endpoint",
      signal: controller.signal,
    });
    await nextTurn();
    controller.abort();
    await assert.rejects(result, (error) => error?.name === "AbortError");
    assert.equal(requests.length, 3);
    assert.equal(
      new URLSearchParams(requests[2].init.body).get("action"),
      "cancel",
    );
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("identical concurrent searches share one Splunk job", async () => {
  const pending = [];
  let fetchCount = 0;
  const loaded = loadService((_url, init) => {
    fetchCount += 1;
    return new Promise((resolve) => pending.push({ init, resolve }));
  });

  try {
    const params = {
      spl: "| makeresults | stats count",
      earliestTime: "-4h",
      latestTime: "now",
      appContext: "splunk-cisco-dashboards",
    };
    const first = loaded.service.runSearch({ ...params, tag: "rail" });
    const second = loaded.service.runSearch({ ...params, tag: "tile" });

    await nextTurn();
    assert.equal(fetchCount, 1);
    pending[0].resolve({
      status: 200,
      json: async () => ({ results: [{ count: "1" }] }),
    });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.deepEqual(firstResult, { results: [{ count: "1" }] });
    assert.deepEqual(secondResult, firstResult);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("one consumer can abort without cancelling another consumer", async () => {
  const pending = [];
  const loaded = loadService(
    (_url, init) => new Promise((resolve) => pending.push({ init, resolve })),
  );

  try {
    const firstController = new AbortController();
    const secondController = new AbortController();
    const params = {
      spl: "| makeresults | stats count",
      earliestTime: "-4h",
      latestTime: "now",
    };
    const first = loaded.service.runSearch({
      ...params,
      tag: "rail",
      signal: firstController.signal,
    });
    const second = loaded.service.runSearch({
      ...params,
      tag: "tile",
      signal: secondController.signal,
    });

    await nextTurn();
    firstController.abort();
    await assert.rejects(first, (err) => err?.name === "AbortError");
    assert.equal(pending[0].init.signal.aborted, false);

    pending[0].resolve({
      status: 200,
      json: async () => ({ results: [{ count: "1" }] }),
    });
    assert.deepEqual(await second, { results: [{ count: "1" }] });
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("a replacement consumer never coalesces onto an already-aborted job", async () => {
  const pending = [];
  let fetchCount = 0;
  const loaded = loadService((_url, init) => {
    fetchCount += 1;
    return new Promise((resolve, reject) => {
      const onAbort = () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        reject(error);
      };
      init.signal.addEventListener("abort", onAbort, { once: true });
      pending.push({ init, resolve });
    });
  });

  try {
    const params = {
      spl: "| makeresults | stats count",
      earliestTime: "-4h",
      latestTime: "now",
      dispatchPriority: 0,
    };
    const firstController = new AbortController();
    const first = loaded.service.runSearch({
      ...params,
      tag: "rail-before-preference-hydration",
      signal: firstController.signal,
    });

    await nextTurn();
    assert.equal(fetchCount, 1);
    firstController.abort();
    await assert.rejects(first, (err) => err?.name === "AbortError");

    const replacement = loaded.service.runSearch({
      ...params,
      tag: "rail-after-preference-hydration",
    });
    await nextTurn();
    assert.equal(fetchCount, 2, "replacement receives a fresh Splunk job");
    pending[1].resolve({
      status: 200,
      json: async () => ({ results: [{ count: "2" }] }),
    });
    assert.deepEqual(await replacement, { results: [{ count: "2" }] });
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("a completed search is not reused by a later refresh", async () => {
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
      spl: "| makeresults | stats count",
      earliestTime: "-4h",
      latestTime: "now",
    };
    assert.deepEqual(await loaded.service.runSearch(params), {
      results: [{ count: "1" }],
    });
    assert.deepEqual(await loaded.service.runSearch(params), {
      results: [{ count: "2" }],
    });
    assert.equal(fetchCount, 2);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("opt-in diagnostics report queue, runtime, completion, and no data", async () => {
  const loaded = loadService(async () => ({
    status: 200,
    json: async () => ({ results: [] }),
  }));
  const messages = [];
  const originalInfo = console.info;

  try {
    global.window.location.search = "?canvasDebug=1";
    console.info = (...args) => messages.push(args);
    assert.deepEqual(
      await loaded.service.runSearch({
        spl: "| makeresults | where 1=0",
        tag: "agentic_soc_no_data_test",
        dispatchPriority: 10,
      }),
      { results: [] },
    );

    const traces = messages.map(parseSearchTrace);
    assert.deepEqual(
      traces.map(({ outcome }) => outcome),
      ["QUEUED", "RUNNING", "NO DATA"],
    );
    assert.equal(traces[0].detail.search, "agentic_soc_no_data_test");
    assert.equal(traces[0].detail.stage, "Section stage 1");
    assert.equal(traces[2].detail.rows, 0);
    assert.equal(typeof traces[2].detail.queueWaitMs, "number");
    assert.equal(typeof traces[2].detail.runMs, "number");
    assert.equal(typeof traces[2].detail.totalMs, "number");
  } finally {
    console.info = originalInfo;
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("opt-in diagnostics classify failed searches", async () => {
  const loaded = loadService(async () => ({
    status: 400,
    json: async () => ({ messages: [{ text: "invalid accelerated model" }] }),
  }));
  const messages = [];
  const originalInfo = console.info;
  const originalError = console.error;

  try {
    global.window.location.search = "?canvasDebug=1";
    console.info = (...args) => messages.push(args);
    console.error = () => {};
    await assert.rejects(
      loaded.service.runSearch({
        spl: "| tstats count FROM datamodel=Missing.All_Data",
        tag: "agentic_soc_failure_test",
        dispatchPriority: 20,
      }),
      /Search dispatch failed|invalid accelerated model/,
    );

    const failed = messages.map(parseSearchTrace).find(
      ({ outcome }) => outcome === "FAILED",
    );
    assert.ok(failed, "Expected a readable failed-search diagnostic");
    assert.equal(failed.detail.search, "agentic_soc_failure_test");
    assert.equal(failed.detail.stage, "Section stage 2");
    assert.equal(failed.detail.httpStatus, 400);
    assert.equal(failed.detail.reason, "dispatch_failed");
    assert.equal(typeof failed.detail.totalMs, "number");
  } finally {
    console.info = originalInfo;
    console.error = originalError;
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("priority groups dispatch in stages at the configured concurrency", async () => {
  const pending = [];
  const started = [];
  const loaded = loadService((_url, init) => {
    const search = new URLSearchParams(String(init.body)).get("search");
    started.push(search);
    return new Promise((resolve) => pending.push({ resolve, search }));
  });

  const finish = (search) => {
    const request = pending.find((entry) => entry.search === search);
    assert.ok(request, `expected pending request for ${search}`);
    request.resolve({
      status: 200,
      json: async () => ({ results: [{ count: "1" }] }),
    });
  };

  try {
    loaded.service.setTileSearchConcurrency(2);
    const rail = [1, 2, 3].map((id) =>
      loaded.service.runSearch({
        spl: `| makeresults | eval rail=${id}`,
        dispatchPriority: 0,
      }),
    );
    const firstSection = [1, 2].map((id) =>
      loaded.service.runSearch({
        spl: `| makeresults | eval section=${id}`,
        dispatchPriority: 10,
      }),
    );

    await nextTurn();
    assert.deepEqual(started, [
      "| makeresults | eval rail=1",
      "| makeresults | eval rail=2",
    ]);

    finish("| makeresults | eval rail=1");
    await nextTurn();
    assert.deepEqual(started, [
      "| makeresults | eval rail=1",
      "| makeresults | eval rail=2",
      "| makeresults | eval rail=3",
    ]);

    finish("| makeresults | eval rail=2");
    await nextTurn();
    assert.equal(started.length, 3, "section waits for all rail searches");

    finish("| makeresults | eval rail=3");
    await nextTurn();
    assert.deepEqual(started.slice(3), [
      "| makeresults | eval section=1",
      "| makeresults | eval section=2",
    ]);

    finish("| makeresults | eval section=1");
    finish("| makeresults | eval section=2");
    await Promise.all([...rail, ...firstSection]);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("a late higher-priority rail search preempts queued section work", async () => {
  const pending = [];
  const started = [];
  const loaded = loadService((_url, init) => {
    const search = new URLSearchParams(String(init.body)).get("search");
    started.push(search);
    return new Promise((resolve) => pending.push({ resolve, search }));
  });

  const finish = (search) => {
    const request = pending.find((entry) => entry.search === search);
    assert.ok(request, `expected pending request for ${search}`);
    request.resolve({
      status: 200,
      json: async () => ({ results: [{ count: "1" }] }),
    });
  };

  try {
    loaded.service.setTileSearchConcurrency(1);
    const sectionOne = loaded.service.runSearch({
      spl: "| makeresults | eval section=1",
      dispatchPriority: 10,
    });
    const sectionTwo = loaded.service.runSearch({
      spl: "| makeresults | eval section=2",
      dispatchPriority: 10,
    });
    await nextTurn();
    assert.deepEqual(started, ["| makeresults | eval section=1"]);

    const rail = loaded.service.runSearch({
      spl: "| makeresults | eval rail=1",
      dispatchPriority: 0,
    });
    finish("| makeresults | eval section=1");
    await nextTurn();
    assert.deepEqual(started, [
      "| makeresults | eval section=1",
      "| makeresults | eval rail=1",
    ]);

    finish("| makeresults | eval rail=1");
    await nextTurn();
    assert.equal(started[2], "| makeresults | eval section=2");
    finish("| makeresults | eval section=2");
    await Promise.all([sectionOne, sectionTwo, rail]);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("concurrency changes apply to queued work and clamp to one through four", async () => {
  const pending = [];
  let fetchCount = 0;
  const loaded = loadService((_url, init) => {
    fetchCount += 1;
    return new Promise((resolve) => pending.push({ init, resolve }));
  });

  try {
    for (const concurrency of [1, 2, 3, 4]) {
      assert.equal(
        loaded.service.setTileSearchConcurrency(concurrency),
        concurrency,
      );
    }
    assert.equal(loaded.service.setTileSearchConcurrency(0), 1);
    const searches = [1, 2, 3].map((id) =>
      loaded.service.runSearch({
        spl: `| makeresults | eval search_id=${id}`,
        dispatchPriority: 0,
      }),
    );
    await nextTurn();
    assert.equal(fetchCount, 1);

    assert.equal(loaded.service.setTileSearchConcurrency(99), 4);
    await nextTurn();
    assert.equal(fetchCount, 3);

    for (const request of pending) {
      request.resolve({
        status: 200,
        json: async () => ({ results: [{ count: "1" }] }),
      });
    }
    await Promise.all(searches);
    assert.equal(loaded.service.getTileSearchConcurrency(), 4);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

test("aborting queued work removes it without blocking the priority group", async () => {
  const pending = [];
  const started = [];
  const loaded = loadService((_url, init) => {
    const search = new URLSearchParams(String(init.body)).get("search");
    started.push(search);
    return new Promise((resolve) => pending.push({ resolve, search }));
  });

  try {
    loaded.service.setTileSearchConcurrency(1);
    const first = loaded.service.runSearch({
      spl: "| makeresults | eval search_id=1",
      dispatchPriority: 10,
    });
    const queuedController = new AbortController();
    const aborted = loaded.service.runSearch({
      spl: "| makeresults | eval search_id=2",
      dispatchPriority: 10,
      signal: queuedController.signal,
    });
    const third = loaded.service.runSearch({
      spl: "| makeresults | eval search_id=3",
      dispatchPriority: 10,
    });

    await nextTurn();
    assert.deepEqual(started, ["| makeresults | eval search_id=1"]);
    queuedController.abort();
    await assert.rejects(aborted, (err) => err?.name === "AbortError");

    pending[0].resolve({
      status: 200,
      json: async () => ({ results: [{ count: "1" }] }),
    });
    await nextTurn();
    assert.deepEqual(started, [
      "| makeresults | eval search_id=1",
      "| makeresults | eval search_id=3",
    ]);

    pending[1].resolve({
      status: 200,
      json: async () => ({ results: [{ count: "1" }] }),
    });
    await Promise.all([first, third]);
  } finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
  }
});

const quotaResponse = (retryAfter) => ({
  status: 503,
  headers: { get: () => retryAfter ?? null },
  json: async () => ({ messages: [{ type: "ERROR", text:
    'Search not executed: role-based concurrency limit of historical searches has been reached (usage=3, quota=3), current_concurrency=3, concurrency_limit=3' }] }),
});
const successfulResponse = () => ({ status: 200, json: async () => ({ results: [{ count: "1" }] }) });

const withCapacityTest = async (t, fetchImpl, check) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100000 });
  t.mock.method(Math, "random", () => 0.5);
  const loaded = loadService(fetchImpl);
  const originalError = console.error;
  console.error = () => {};
  try { await check(loaded.service); }
  finally {
    loaded.service.__resetDispatchQueue();
    loaded.restore();
    console.error = originalError;
    t.mock.timers.reset();
  }
};

test("quota rejection pauses queued work and recovers without caching the failure", async (t) => {
  const starts = [];
  await withCapacityTest(t, async (_url, init) => {
    starts.push(new URLSearchParams(String(init.body)).get("search"));
    return starts.length === 1 ? quotaResponse() : successfulResponse();
  }, async (service) => {
    service.setTileSearchConcurrency(1);
    const first = service.runSearch({ spl: "| makeresults | eval tile=1" });
    const second = service.runSearch({ spl: "| makeresults | eval tile=2" });
    await nextTurn();
    assert.equal(starts.length, 1);
    t.mock.timers.tick(1999); await nextTurn();
    assert.equal(starts.length, 1, "no retry or queued tile during cooldown");
    t.mock.timers.tick(1); await nextTurn();
    await Promise.all([first, second]);
    assert.deepEqual(starts, [starts[0], starts[0], "| makeresults | eval tile=2"]);
    await service.runSearch({ spl: "| makeresults | eval tile=1" });
    assert.equal(starts.length, 4, "later refresh executes after quota recovery");
  });
});

test("a free slot does not drain queued tiles during another search's quota cooldown", async (t) => {
  const starts = [];
  let finishOther;
  await withCapacityTest(t, async (_url, init) => {
    const spl = new URLSearchParams(String(init.body)).get("search");
    starts.push(spl);
    if (starts.length === 1) return quotaResponse();
    if (starts.length === 2) return new Promise((resolve) => { finishOther = resolve; });
    return successfulResponse();
  }, async (service) => {
    service.setTileSearchConcurrency(2);
    const jobs = [1, 2, 3].map((tile) => service.runSearch({ spl: `| makeresults | eval tile=${tile}` }));
    await nextTurn();
    finishOther(successfulResponse()); await nextTurn();
    assert.equal(starts.length, 2, "freed slot remains paused");
    t.mock.timers.tick(2000); await nextTurn();
    await Promise.all(jobs);
    assert.equal(starts.length, 4);
  });
});

test("persistent quota exhaustion stops after four attempts and stays a capacity failure", async (t) => {
  let starts = 0;
  await withCapacityTest(t, async () => { starts += 1; return quotaResponse(); }, async (service) => {
    let announcements = 0;
    const unsubscribe = service.subscribeSearchCapacityFailures(() => { announcements += 1; });
    const result = service.runSearch({ spl: "| makeresults" });
    const rejection = assert.rejects(result, (err) => {
      assert.equal(service.classifySearchDispatchError(err).reason, "capacity_limited");
      assert.equal(err.httpStatus, 503);
      return true;
    });
    await nextTurn();
    for (const delay of [2000, 5000, 10000]) { t.mock.timers.tick(delay); await nextTurn(); }
    await rejection;
    assert.equal(announcements, 1, "notify only after bounded retries are exhausted");
    unsubscribe();
    assert.equal(starts, 4);
    t.mock.timers.tick(60000); await nextTurn();
    assert.equal(starts, 4, "no automatic fifth attempt");
  });
});

test("capacity retries honor Retry-After with a 30-second bound", async (t) => {
  let starts = 0;
  await withCapacityTest(t, async () => ++starts === 1 ? quotaResponse("120") : successfulResponse(), async (service) => {
    const job = service.runSearch({ spl: "| makeresults" });
    await nextTurn();
    t.mock.timers.tick(29999); await nextTurn();
    assert.equal(starts, 1);
    t.mock.timers.tick(1); await nextTurn();
    await job;
    assert.equal(starts, 2);
  });
});

test("aborting during quota backoff prevents another request", async (t) => {
  let starts = 0;
  await withCapacityTest(t, async () => { starts += 1; return quotaResponse(); }, async (service) => {
    const controller = new AbortController();
    const job = service.runSearch({ spl: "| makeresults", signal: controller.signal });
    const rejected = assert.rejects(job, (err) => err.name === "AbortError");
    await nextTurn(); controller.abort(); await rejected;
    t.mock.timers.tick(60000); await nextTurn();
    assert.equal(starts, 1);
  });
});

test("authorization failures do not retry or become capacity failures", async (t) => {
  let starts = 0;
  await withCapacityTest(t, async () => {
    starts += 1;
    return { status: 403, json: async () => ({ messages: [{ type: "ERROR", text: "Access denied" }] }) };
  }, async (service) => {
    await assert.rejects(service.runSearch({ spl: "| makeresults" }), (err) => {
      assert.equal(service.classifySearchDispatchError(err).reason, "dispatch_failed");
      return true;
    });
    assert.equal(starts, 1);
  });
});
