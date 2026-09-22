// PewPew reports statistics but has no built-in pass/fail thresholds the way k6
// does, so it always exits 0 no matter how slow the run was. This script reads
// PewPew's JSON output from stdin and fails the run when the thresholds defined
// for the login load test are breached, which is what makes it usable as a gate.
//
// Usage:
//   pewpew run -f json test/loadTesting/login.yml | node test/loadTesting/checkThreshold.js

const P95_THRESHOLD_MS = Number(process.env.P95_THRESHOLD_MS || 500);

let raw = '';
process.stdin.on('data', (chunk) => {
  raw += chunk;
});

process.stdin.on('end', () => {
  // PewPew streams one JSON object per line, and echoes the human-readable
  // output alongside it, so anything that is not parseable JSON is skipped.
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

  const summary = records.filter((r) => r.type === 'summary' && r.summaryType === 'test').pop();

  if (!summary) {
    console.error('FAIL: no test summary found in the PewPew output');
    process.exit(1);
  }

  const failures = [];

  if (summary.p95 >= P95_THRESHOLD_MS) {
    failures.push(`p(95) was ${summary.p95}ms, threshold is < ${P95_THRESHOLD_MS}ms`);
  }

  const nonSuccess = (summary.statusCounts || []).filter((s) => s.status !== 200);
  if (nonSuccess.length > 0) {
    const detail = nonSuccess.map((s) => `${s.count}x ${s.status}`).join(', ');
    failures.push(`every login should return 200, but saw ${detail}`);
  }

  if (summary.testErrorCount > 0) {
    failures.push(`${summary.testErrorCount} test error(s) occurred`);
  }

  if (summary.requestTimeouts > 0) {
    failures.push(`${summary.requestTimeouts} request(s) timed out`);
  }

  console.log('');
  console.log('Threshold check');
  console.log('================');
  console.log(`calls made ....... ${summary.callCount}`);
  console.log(`p50 / p95 / p99 .. ${summary.p50}ms / ${summary.p95}ms / ${summary.p99}ms`);
  console.log(`min / mean / max . ${summary.min}ms / ${summary.mean}ms / ${summary.max}ms`);
  console.log(`p(95) < ${P95_THRESHOLD_MS}ms ..... ${summary.p95 < P95_THRESHOLD_MS ? 'PASS' : 'FAIL'}`);

  if (failures.length > 0) {
    console.error('');
    failures.forEach((failure) => console.error(`FAIL: ${failure}`));
    process.exit(1);
  }

  console.log('');
  console.log('All thresholds passed.');
});
