const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual service with deterministic source responses, without
// requiring LinkedIn availability or installing a separate test framework.
const serviceCode = ts.transpileModule(
  readFileSync(path.join(__dirname, '../lib/job-service.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
).outputText;

function loadService(fetchJobs) {
  const module = { exports: {} };
  vm.runInNewContext(serviceCode, {
    Error,
    module,
    exports: module.exports,
    require: () => ({
      fetchLinkedInJobs: fetchJobs,
      fetchJobindexJobs: fetchJobs,
      fetchWorkindenmarkJobs: fetchJobs,
      fetchWorkdayJobs: fetchJobs,
    }),
  });
  return module.exports;
}

function job(id, postedAt, location = 'Copenhagen', canonicalId) {
  return {
    id, canonicalId, title: 'Engineer', company: 'Example', location,
    type: 'Full-time', posted: postedAt ?? 'Unknown', postedAt,
    description: '', source: 'LinkedIn',
  };
}

async function search(fetchJobs, overrides = {}) {
  const service = loadService(fetchJobs);
  const report = await service.getJobsReportFromSources(['linkedin'], {
    keywords: 'engineer', linkedinLocations: 'Copenhagen; Switzerland',
    resultLimit: 10, ...overrides,
  });
  // Convert VM objects into ordinary objects for strict assertions.
  return JSON.parse(JSON.stringify(report));
}

test('mixes locations chronologically regardless of query completion order', async () => {
  const report = await search(async ({ location }) => {
    if (location === 'Copenhagen') {
      await new Promise((resolve) => setTimeout(resolve, 15));
      return [job('dk-old', '2026-07-01'), job('dk-new', '2026-09-30')];
    }
    return [job('ch-middle', '2026-09-26', location)];
  });
  assert.deepEqual(report.jobs.map((job) => job.id), ['dk-new', 'ch-middle', 'dk-old']);
  assert.deepEqual(report.results[0].queries.map((query) => query.location), ['Copenhagen', 'Switzerland']);
});

test('interleaves equal dates before applying the combined limit', async () => {
  const report = await search(async ({ location }) => [
    job(`${location}-1`, '2026-09-30', location),
    job(`${location}-2`, '2026-09-30', location),
  ], { resultLimit: 2 });
  assert.deepEqual(report.jobs.map((job) => job.id), ['Copenhagen-1', 'Switzerland-1']);
});

test('keeps missing and invalid dates last and mixes tied unknown dates', async () => {
  const report = await search(async ({ location }) => location === 'Copenhagen'
    ? [job('dk-unknown'), job('dk-invalid', 'bad-date')]
    : [job('ch-known', '2026-09-01', location), job('ch-unknown', undefined, location)]);
  assert.deepEqual(report.jobs.map((job) => job.id), ['ch-known', 'dk-unknown', 'ch-unknown', 'dk-invalid']);
});

test('mixes equal dates even when locations have different counts of newer jobs', async () => {
  const report = await search(async ({ location }) => location === 'Copenhagen'
    ? [job('dk-new', '2026-09-30'), job('dk-tie-1', '2026-09-20'), job('dk-tie-2', '2026-09-20')]
    : [job('ch-tie-1', '2026-09-20', location), job('ch-tie-2', '2026-09-20', location)]);
  assert.deepEqual(report.jobs.map((job) => job.id), ['dk-new', 'dk-tie-1', 'ch-tie-1', 'dk-tie-2', 'ch-tie-2']);
});

test('does not discard a location\'s newest candidates by splitting the limit', async () => {
  const calls = [];
  const report = await search(async (params) => {
    calls.push(params);
    const dates = params.location === 'Copenhagen'
      ? ['2026-09-30', '2026-09-29', '2026-09-28', '2026-09-27']
      : ['2026-08-01', '2026-07-31'];
    return dates.slice(0, params.resultLimit).map((date, index) => job(`${params.location}-${index}`, date, params.location));
  }, { resultLimit: 4 });
  assert.ok(calls.every((call) => call.resultLimit === 4));
  assert.equal(report.jobs.length, 4);
  assert.ok(report.jobs.every((job) => job.location === 'Copenhagen'));
  assert.equal(report.results[0].queries[1].jobCount, 2);
});

test('deduplicates overlapping locations before applying the result limit', async () => {
  const report = await search(async ({ location }) => [
    job(`shared-${location}`, '2026-09-30', location, 'shared'),
    job(location, '2026-09-29', location),
  ], { resultLimit: 3 });
  assert.equal(report.jobs.length, 3);
  assert.equal(report.jobs.filter((job) => job.canonicalId === 'shared').length, 1);
  assert.deepEqual(report.jobs.slice(1).map((job) => job.id), ['Copenhagen', 'Switzerland']);
});

test('uses the newer observation when duplicate jobs disagree on posting date', async () => {
  const report = await search(async ({ location }) => [
    job(location, location === 'Copenhagen' ? '2026-09-01' : '2026-09-30', location, 'shared'),
  ]);
  assert.equal(report.jobs.length, 1);
  assert.equal(report.jobs[0].postedAt, '2026-09-30');
});

test('sorts jobs across sources as well as across LinkedIn locations', async () => {
  const service = loadService(async ({ location }) => location === 'Copenhagen'
    ? [job('dk', '2026-09-30')]
    : location === 'Switzerland'
      ? [job('ch', '2026-09-20', location)]
      : [job('other-source', '2026-09-25', location)]);
  const report = await service.getJobsReportFromSources(['linkedin', 'jobindex'], {
    keywords: 'engineer', location: 'Denmark', linkedinLocations: 'Copenhagen; Switzerland',
  });
  assert.deepEqual(Array.from(report.jobs, (job) => job.id), ['dk', 'other-source', 'ch']);
});

test('reports a failed location while preserving other locations\' results', async () => {
  const report = await search(async ({ location }) => {
    if (location === 'Switzerland') throw new Error('LinkedIn returned 429');
    return [job('dk', '2026-09-30')];
  });
  const source = report.results[0];
  assert.equal(source.status, 'success');
  assert.equal(source.queries[1].status, 'error');
  assert.match(source.queries[1].error, /429/);
  assert.match(source.error, /1 of 2 searches failed/);
  assert.equal(report.jobs[0].id, 'dk');
});

test('distinguishes an empty location from a failed query', async () => {
  const report = await search(async ({ location }) => location === 'Switzerland' ? [] : [job('dk', '2026-09-30')]);
  assert.equal(report.results[0].queries[1].status, 'empty');
  assert.equal(report.results[0].queries[1].jobCount, 0);
  assert.equal(report.results[0].error, undefined);
});

test('reports every location when all queries fail', async () => {
  const report = await search(async () => { throw new Error('Network unavailable'); });
  assert.equal(report.results[0].status, 'error');
  assert.ok(report.results[0].queries.every((query) => query.status === 'error'));
  assert.equal(report.jobs.length, 0);
});

test('applies all search filters to every role/location with bounded concurrency', async () => {
  const calls = [];
  let active = 0;
  let peak = 0;
  await search(async (params) => {
    calls.push(params);
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return [];
  }, {
    keywords: 'engineer, developer', company: 'Example', datePosted: 'week',
    experienceLevel: 'entry', workplaceType: 'hybrid', jobType: 'full-time',
  });
  assert.equal(calls.length, 4);
  assert.equal(peak, 2);
  for (const call of calls) {
    assert.equal(call.company, 'Example');
    assert.equal(call.datePosted, 'week');
    assert.equal(call.experienceLevel, 'entry');
    assert.equal(call.workplaceType, 'hybrid');
    assert.equal(call.jobType, 'full-time');
  }
  assert.equal(new Set(calls.map((call) => `${call.keywords}/${call.location}`)).size, 4);
});
