// PewPew reports statistics but has no built-in pass/fail thresholds the way k6
// does, so it always exits 0 no matter how slow the run was. This script reads
// PewPew's JSON output from stdin and fails the run when the thresholds defined
// for the load tests are breached, which is what makes it usable as a gate.
//
// PewPew emits one test summary per endpoint, so every endpoint is checked
// independently and the run fails if any of them breaches.
//
// Usage:
//   pewpew run -f json test/loadTesting/login.yml | node test/loadTesting/checkThreshold.js

const P95_THRESHOLD_MS = Number(process.env.P95_THRESHOLD_MS || 500);

// Endpoints tagged with a name in the config are held to the status their
// Swagger response documents. Anything not listed is expected to return 200.
const EXPECTED_STATUS = {
  healthcheck: 200,
  login: 200,
  register: 201,
  checkout: 200
};

let raw = '';
process.stdin.on('data', (chunk) => {
  raw += chunk;
});

process.stdin.on('end', () => {
  // PewPew streams one JSON object per line, so anything that is not parseable
  // JSON is skipped.
  const records = raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);

  const summaries = records.filter((r) => r.type === 'summary' && r.summaryType === 'test');

  if (summaries.length === 0) {
    console.error('FAIL: no test summary found in the PewPew output');
    process.exit(1);
  }

  const failures = [];
  const rows = [];

  summaries.forEach((summary) => {
    const name = (summary.tags && summary.tags.name) || `${summary.method} ${summary.url}`;
    const expectedStatus = EXPECTED_STATUS[name] || 200;
    const endpointFailures = [];

    if (summary.p95 >= P95_THRESHOLD_MS) {
      endpointFailures.push(`p(95) was ${summary.p95}ms, threshold is < ${P95_THRESHOLD_MS}ms`);
    }

    const unexpected = (summary.statusCounts || []).filter((s) => s.status !== expectedStatus);
    if (unexpected.length > 0) {
      const detail = unexpected.map((s) => `${s.count}x ${s.status}`).join(', ');
      endpointFailures.push(`expected ${expectedStatus} on every call, but saw ${detail}`);
    }

    if (summary.testErrorCount > 0) {
      endpointFailures.push(`${summary.testErrorCount} test error(s) occurred`);
    }

    if (summary.requestTimeouts > 0) {
      endpointFailures.push(`${summary.requestTimeouts} request(s) timed out`);
    }

    rows.push({
      name,
      calls: summary.callCount,
      p50: summary.p50,
      p95: summary.p95,
      p99: summary.p99,
      max: summary.max,
      status: endpointFailures.length === 0 ? 'PASS' : 'FAIL'
    });

    endpointFailures.forEach((failure) => failures.push(`${name}: ${failure}`));
  });

  const pad = (value, width) => String(value).padEnd(width);
  const nameWidth = Math.max(8, ...rows.map((r) => r.name.length));

  console.log('');
  console.log(`Threshold check (p95 < ${P95_THRESHOLD_MS}ms)`);
  console.log('='.repeat(nameWidth + 48));
  console.log(
    `${pad('endpoint', nameWidth)}  ${pad('calls', 6)}  ${pad('p50', 9)}  ${pad('p95', 9)}  ${pad('p99', 9)}  result`
  );
  rows.forEach((row) => {
    console.log(
      `${pad(row.name, nameWidth)}  ${pad(row.calls, 6)}  ${pad(row.p50 + 'ms', 9)}  ${pad(row.p95 + 'ms', 9)}  ${pad(row.p99 + 'ms', 9)}  ${row.status}`
    );
  });

  if (failures.length > 0) {
    console.error('');
    failures.forEach((failure) => console.error(`FAIL: ${failure}`));
    process.exit(1);
  }

  console.log('');
  console.log(`All thresholds passed across ${rows.length} endpoint(s).`);
});
