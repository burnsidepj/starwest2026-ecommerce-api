// Builds an HTML report from PewPew's JSON output.
//
// The figures are read straight out of the stats stream rather than transcribed,
// so the charts cannot drift from the run they describe.
//
// Usage:
//   pewpew run -f json test/loadTesting/allEndpoints.yml > run.json
//   node test/loadTesting/generateReport.js run.json docs/loadTestReport.html
//
// Reads stdin when no input file is given.

const fs = require('fs');
const path = require('path');

const P95_THRESHOLD_MS = Number(process.env.P95_THRESHOLD_MS || 500);

// Categorical slots 1-4 of the validated palette, light and dark steps.
const PALETTE = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500']
};

function parseRecords(raw) {
  return raw
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
}

function extract(raw) {
  const records = parseRecords(raw);
  const tests = records.filter((r) => r.type === 'summary' && r.summaryType === 'test');
  const bucketRecords = records.filter((r) => r.type === 'summary' && r.summaryType === 'bucket');

  if (tests.length === 0) {
    throw new Error('no test summary found in the PewPew output');
  }

  const label = (r) => (r.tags && r.tags.name) || `${r.method} ${r.url}`;
  const order = tests.map(label);

  const totals = {};
  tests.forEach((r) => {
    totals[label(r)] = {
      calls: r.callCount,
      min: r.min,
      p50: r.p50,
      mean: r.mean,
      p95: r.p95,
      p99: r.p99,
      max: r.max,
      statuses: (r.statusCounts || []).map((s) => `${s.status}`).join('/'),
      errors: r.testErrorCount,
      timeouts: r.requestTimeouts
    };
  });

  const t0 = Math.min(...bucketRecords.map((r) => r.timestamp));
  const buckets = {};
  bucketRecords.forEach((r) => {
    const name = label(r);
    (buckets[name] = buckets[name] || []).push({
      t: r.timestamp - t0,
      p50: r.p50,
      p95: r.p95,
      p99: r.p99,
      calls: r.callCount
    });
  });

  // The run's duration and rate must come from the unfiltered buckets. Deriving
  // them after dropping the partial ones understates both.
  const allT = [...new Set(Object.values(buckets).flat().map((b) => b.t))].sort((a, b) => a - b);
  const step = allT.length > 1 ? allT[1] - allT[0] : 30;
  const durationSec = allT[allT.length - 1];

  // PewPew opens a bucket the moment the test starts and closes one when it ends,
  // so the first and last hold only a handful of calls. Their percentiles are noise.
  const maxCalls = Math.max(...Object.values(buckets).flat().map((b) => b.calls));
  Object.keys(buckets).forEach((name) => {
    buckets[name] = buckets[name].sort((a, b) => a.t - b.t).filter((b) => b.calls > maxCalls * 0.5);
  });

  const bucketSpan = Object.values(buckets)[0].length;
  const totalCalls = Object.values(totals).reduce((sum, t) => sum + t.calls, 0);
  const totalErrors = Object.values(totals).reduce((sum, t) => sum + t.errors + t.timeouts, 0);

  return { order, totals, buckets, bucketSpan, totalCalls, totalErrors, step, durationSec };
}

function describeRun(data) {
  const { step, durationSec } = data;
  const perEndpoint = data.order.length
    ? Math.round(Object.values(data.totals)[0].calls / durationSec)
    : 0;
  const minutes = durationSec % 60 === 0 ? durationSec / 60 : (durationSec / 60).toFixed(1);
  return {
    step,
    durationSec,
    perEndpoint,
    title: `Load test — all ${data.order.length} endpoints, ${perEndpoint} hits/sec each, ${minutes} minutes`
  };
}

function render(data, meta) {
  const worst = data.order.reduce((a, b) => (data.totals[a].p95 >= data.totals[b].p95 ? a : b));
  const widest = data.order.reduce((a, b) => {
    const ra = data.totals[a].p95 / data.totals[a].p50;
    const rb = data.totals[b].p95 / data.totals[b].p50;
    return ra >= rb ? a : b;
  });
  const w = data.totals[widest];
  const allPass = data.order.every(
    (n) => data.totals[n].p95 < P95_THRESHOLD_MS && data.totals[n].errors === 0 && data.totals[n].timeouts === 0
  );

  const cssVars = (mode) =>
    PALETTE[mode].map((hex, i) => `    --series-${i + 1}: ${hex};`).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${meta.title}</title>
<style>
  .viz-root {
    color-scheme: light;
    --surface-1: #fcfcfb;
    --surface-2: #f4f4f1;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #77756f;
    --grid: #e3e2dd;
    --axis: #c9c8c2;
${cssVars('light')}
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) .viz-root {
      color-scheme: dark;
      --surface-1: #1a1a19;
      --surface-2: #232322;
      --text-primary: #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted: #96958c;
      --grid: #32322f;
      --axis: #45443f;
${cssVars('dark')}
    }
  }
  :root[data-theme="dark"] .viz-root {
    color-scheme: dark;
    --surface-1: #1a1a19;
    --surface-2: #232322;
    --text-primary: #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted: #96958c;
    --grid: #32322f;
    --axis: #45443f;
${cssVars('dark')}
  }

  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .viz-root { background: var(--surface-1); color: var(--text-primary); min-height: 100vh; padding: 32px 28px 56px; }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1 { font-size: 21px; font-weight: 600; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { font-size: 13px; color: var(--text-secondary); margin: 0 0 4px; }
  .meta { font-size: 12px; color: var(--text-muted); margin: 0 0 28px; }
  h2 { font-size: 15px; font-weight: 600; margin: 40px 0 2px; }
  .note { font-size: 12.5px; color: var(--text-secondary); margin: 0 0 16px; line-height: 1.5; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 22px; }
  button { font: inherit; font-size: 12px; padding: 5px 11px; border-radius: 7px; border: 1px solid var(--axis); background: var(--surface-2); color: var(--text-secondary); cursor: pointer; }
  button:hover { color: var(--text-primary); }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
  .tile { background: var(--surface-2); border-radius: 10px; padding: 14px 16px; }
  .tile .label { font-size: 11.5px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .tile .value { font-size: 25px; font-weight: 600; margin-top: 5px; letter-spacing: -0.02em; }
  .tile .foot { font-size: 11.5px; color: var(--text-secondary); margin-top: 3px; }
  .legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 0 0 12px; font-size: 12.5px; color: var(--text-secondary); }
  .legend span { display: inline-flex; align-items: center; gap: 6px; }
  .swatch { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
  figure { margin: 0; position: relative; }
  svg { display: block; width: 100%; height: auto; overflow: visible; }
  text.tick { font-size: 11px; fill: var(--text-muted); }
  text.axis-title { font-size: 11.5px; fill: var(--text-secondary); }
  text.dl { font-size: 11.5px; font-weight: 600; }
  text.row-label { font-size: 12px; }
  text.key { font-size: 11px; }
  .tip { position: absolute; pointer-events: none; opacity: 0; background: var(--surface-1); border: 1px solid var(--axis); border-radius: 8px; padding: 9px 11px; font-size: 12px; box-shadow: 0 4px 14px rgb(0 0 0 / 0.13); min-width: 150px; transition: opacity 90ms; }
  .tip h4 { margin: 0 0 6px; font-size: 12px; font-weight: 600; }
  .tip .row { display: flex; justify-content: space-between; gap: 14px; color: var(--text-secondary); line-height: 1.7; }
  .tip .row b { color: var(--text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }
  table { border-collapse: collapse; width: 100%; font-size: 12.5px; margin-top: 8px; }
  caption { text-align: left; font-size: 12.5px; color: var(--text-secondary); padding-bottom: 8px; }
  th, td { text-align: right; padding: 7px 10px; border-bottom: 1px solid var(--grid); font-variant-numeric: tabular-nums; }
  th:first-child, td:first-child { text-align: left; font-variant-numeric: normal; }
  thead th { color: var(--text-secondary); font-weight: 600; }
  .hidden { display: none; }
</style>
</head>
<body data-palette="${PALETTE.light.join(',')}">
<div class="viz-root">
<div class="wrap">

  <h1>${meta.title}</h1>
  <p class="sub">StarWest 2026 e-commerce API · PewPew · ${data.totalCalls} requests · ${data.totalErrors} errors</p>
  <p class="meta">Generated from the run's own stats stream by test/loadTesting/generateReport.js. Threshold: p95 &lt; ${P95_THRESHOLD_MS}&nbsp;ms.</p>

  <div class="toolbar">
    <button id="theme">Toggle dark mode</button>
    <button id="tableBtn">Show data table</button>
  </div>

  <div class="tiles">
    <div class="tile"><div class="label">${widest} p50</div><div class="value">${w.p50.toFixed(1)} ms</div><div class="foot">median</div></div>
    <div class="tile"><div class="label">${widest} p95</div><div class="value">${w.p95.toFixed(1)} ms</div><div class="foot">${(w.p95 / w.p50).toFixed(0)}× the median</div></div>
    <div class="tile"><div class="label">Slowest p95</div><div class="value">${data.totals[worst].p95.toFixed(1)} ms</div><div class="foot">${worst} · ${((data.totals[worst].p95 / P95_THRESHOLD_MS) * 100).toFixed(0)}% of budget</div></div>
    <div class="tile"><div class="label">Threshold</div><div class="value">${P95_THRESHOLD_MS} ms</div><div class="foot">${allPass ? `all ${data.order.length} endpoints pass` : 'BREACHED'}</div></div>
  </div>

  <h2>Median versus tail, per endpoint</h2>
  <p class="note">
    Each row spans that endpoint's p50 to its p95. A long span means most requests are fast while a
    minority are far slower &mdash; the signature of requests queueing behind blocked work rather
    than of a slow endpoint. A high p50 <em>and</em> a high p95 is the opposite: genuinely slow work.
  </p>
  <div class="legend" id="legend1"></div>
  <figure>
    <svg id="dumbbell" role="img" aria-label="Range chart of p50 to p95 latency per endpoint"></svg>
    <div class="tip" id="tip1"></div>
  </figure>

  <h2>p95 across the run</h2>
  <p class="note">
    ${data.bucketSpan} buckets of ${meta.step} seconds. A rising trend means the API degrades as the run
    proceeds; a flat line means it holds. Buckets at either end holding only a fraction of a full
    interval's requests are excluded, since their percentiles are drawn from too few samples.
  </p>
  <div class="legend" id="legend2"></div>
  <figure>
    <svg id="lines" role="img" aria-label="Line chart of p95 latency over time per endpoint"></svg>
    <div class="tip" id="tip2"></div>
  </figure>

  <div id="tableView" class="hidden">
    <h2>Data table</h2>
    <table>
      <caption>Full run statistics per endpoint, milliseconds.</caption>
      <thead><tr><th>Endpoint</th><th>Status</th><th>Calls</th><th>min</th><th>p50</th><th>mean</th><th>p95</th><th>p99</th><th>max</th><th>Result</th></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
    <table>
      <caption>p95 per ${meta.step}-second bucket, milliseconds.</caption>
      <thead><tr id="thead2"></tr></thead>
      <tbody id="tbody2"></tbody>
    </table>
  </div>

</div>
</div>

<script>
const DATA = ${JSON.stringify({ order: data.order, totals: data.totals, buckets: data.buckets }, null, 1)};
const THRESHOLD = ${P95_THRESHOLD_MS};
const COLOR = {};
DATA.order.forEach((n, i) => { COLOR[n] = "--series-" + ((i % 4) + 1); });

const cvar = (n) => getComputedStyle(document.querySelector(".viz-root")).getPropertyValue(n).trim();
const SVGNS = "http://www.w3.org/2000/svg";
const el = (n, a = {}) => { const e = document.createElementNS(SVGNS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
const fmt = (v) => (v < 10 ? v.toFixed(1) : Math.round(v));
// Axis ticks are round by construction, so only show a decimal when there is one.
const fmtTick = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
// Round the axis up to the next visually tidy value without leaving a wide gap
// above the data, which a plain power-of-ten step does.
const niceMax = (v) => {
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / e;
  const m = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((x) => x >= n) || 10;
  return m * e;
};

function legend(id) {
  document.getElementById(id).innerHTML = DATA.order
    .map(n => '<span><i class="swatch" style="background:var(' + COLOR[n] + ')"></i>' + n + '</span>').join("");
}

function drawDumbbell() {
  const svg = document.getElementById("dumbbell");
  svg.innerHTML = "";
  const rows = DATA.order;
  const H = 54 + rows.length * 48, W = 900, M = { t: 34, r: 84, b: 44, l: 120 };
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const maxX = niceMax(Math.max(...rows.map(n => DATA.totals[n].p95)) * 1.15);
  const x = (v) => M.l + (v / maxX) * iw;
  const band = ih / rows.length;
  const step = maxX / 5;

  for (let g = 0; g <= maxX; g += step) {
    svg.appendChild(el("line", { x1: x(g), x2: x(g), y1: M.t, y2: M.t + ih, stroke: cvar("--grid"), "stroke-width": 1 }));
    const t = el("text", { x: x(g), y: M.t + ih + 18, "text-anchor": "middle", class: "tick" });
    t.textContent = fmtTick(g); svg.appendChild(t);
  }
  const at = el("text", { x: M.l + iw / 2, y: H - 6, "text-anchor": "middle", class: "axis-title" });
  at.textContent = "response time (ms)"; svg.appendChild(at);
  const key = el("text", { x: M.l, y: 14, class: "key", fill: cvar("--text-muted") });
  key.textContent = "hollow marker = p50 (median)   ·   filled marker = p95"; svg.appendChild(key);

  rows.forEach((name, i) => {
    const d = DATA.totals[name], c = cvar(COLOR[name]);
    const cy = M.t + band * i + band / 2;
    const lbl = el("text", { x: M.l - 18, y: cy + 4, "text-anchor": "end", class: "row-label", fill: cvar("--text-secondary") });
    lbl.textContent = name; svg.appendChild(lbl);
    svg.appendChild(el("line", { x1: x(d.p50), x2: x(d.p95), y1: cy, y2: cy, stroke: c, "stroke-width": 2, "stroke-linecap": "round" }));
    svg.appendChild(el("circle", { cx: x(d.p50), cy, r: 5.5, fill: cvar("--surface-1"), stroke: c, "stroke-width": 2 }));
    svg.appendChild(el("circle", { cx: x(d.p95), cy, r: 5.5, fill: c, stroke: cvar("--surface-1"), "stroke-width": 2 }));
    const a = el("text", { x: x(d.p50), y: cy - 13, "text-anchor": "middle", class: "dl", fill: cvar("--text-secondary") });
    a.textContent = fmt(d.p50); svg.appendChild(a);
    const b = el("text", { x: x(d.p95) + 11, y: cy + 4, class: "dl", fill: cvar("--text-primary") });
    b.textContent = fmt(d.p95) + " ms"; svg.appendChild(b);
    const hit = el("rect", { x: M.l, y: cy - band / 2, width: iw, height: band, fill: "transparent" });
    hit.style.cursor = "crosshair";
    hit.addEventListener("mousemove", (ev) => showTip1(ev, name));
    hit.addEventListener("mouseleave", () => (document.getElementById("tip1").style.opacity = 0));
    svg.appendChild(hit);
  });
}

function showTip1(ev, name) {
  const d = DATA.totals[name], tip = document.getElementById("tip1");
  const fig = ev.target.ownerSVGElement.parentElement.getBoundingClientRect();
  tip.innerHTML = "<h4>" + name + "</h4>" +
    [["min", d.min], ["p50", d.p50], ["mean", d.mean], ["p95", d.p95], ["p99", d.p99], ["max", d.max]]
      .map(([k, v]) => '<div class="row"><span>' + k + "</span><b>" + fmt(v) + " ms</b></div>").join("") +
    '<div class="row"><span>calls</span><b>' + d.calls + "</b></div>" +
    '<div class="row"><span>status</span><b>' + d.statuses + "</b></div>";
  tip.style.opacity = 1;
  tip.style.left = Math.min(ev.clientX - fig.left + 16, fig.width - 175) + "px";
  tip.style.top = (ev.clientY - fig.top - 10) + "px";
}

function drawLines() {
  const svg = document.getElementById("lines");
  svg.innerHTML = "";
  const W = 900, H = 300, M = { t: 22, r: 104, b: 46, l: 60 }, PAD = 16;
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  const iw = W - M.l - M.r, ih = H - M.t - M.b;
  const ts = DATA.buckets[DATA.order[0]].map(b => b.t);
  const t1 = ts[0], tN = ts[ts.length - 1];
  const maxY = niceMax(Math.max(...DATA.order.flatMap(n => DATA.buckets[n].map(b => b.p95))) * 1.15);
  const x = (t) => M.l + PAD + ((t - t1) / (tN - t1 || 1)) * (iw - PAD * 2);
  const y = (v) => M.t + ih - (v / maxY) * ih;
  const step = maxY / 5;

  for (let g = 0; g <= maxY; g += step) {
    svg.appendChild(el("line", { x1: M.l, x2: M.l + iw, y1: y(g), y2: y(g), stroke: cvar("--grid"), "stroke-width": 1 }));
    const t = el("text", { x: M.l - 10, y: y(g) + 4, "text-anchor": "end", class: "tick" });
    t.textContent = fmtTick(g); svg.appendChild(t);
  }
  // Thin the x labels so they never collide on a long run.
  const every = Math.ceil(ts.length / 10);
  ts.forEach((t, i) => {
    if (i % every !== 0 && i !== ts.length - 1) return;
    const tx = el("text", { x: x(t), y: M.t + ih + 18, "text-anchor": "middle", class: "tick" });
    tx.textContent = t + "s"; svg.appendChild(tx);
  });
  const yt = el("text", { x: 14, y: M.t + ih / 2, class: "axis-title", transform: "rotate(-90 14 " + (M.t + ih / 2) + ")", "text-anchor": "middle" });
  yt.textContent = "p95 (ms)"; svg.appendChild(yt);
  const xt = el("text", { x: M.l + iw / 2, y: H - 8, "text-anchor": "middle", class: "axis-title" });
  xt.textContent = "elapsed time"; svg.appendChild(xt);

  DATA.order.forEach(name => {
    const c = cvar(COLOR[name]), pts = DATA.buckets[name];
    svg.appendChild(el("path", { d: pts.map((p, i) => (i ? "L" : "M") + x(p.t) + " " + y(p.p95)).join(" "), fill: "none", stroke: c, "stroke-width": 2, "stroke-linejoin": "round" }));
    pts.forEach(p => svg.appendChild(el("circle", { cx: x(p.t), cy: y(p.p95), r: 4, fill: c, stroke: cvar("--surface-1"), "stroke-width": 1.5 })));
  });

  // Series can finish close together, so nudge the end labels apart.
  const ends = DATA.order.map(name => {
    const last = DATA.buckets[name][DATA.buckets[name].length - 1];
    return { name, y: y(last.p95), y0: y(last.p95), x: x(last.t) };
  }).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
  ends.forEach(e => {
    svg.appendChild(el("line", { x1: e.x + 5, x2: e.x + 11, y1: e.y0, y2: e.y, stroke: cvar("--axis"), "stroke-width": 1 }));
    const dl = el("text", { x: e.x + 14, y: e.y + 4, class: "dl", fill: cvar("--text-secondary") });
    dl.textContent = e.name; svg.appendChild(dl);
  });

  const hit = el("rect", { x: M.l, y: M.t, width: iw, height: ih, fill: "transparent" });
  hit.style.cursor = "crosshair";
  const cross = el("line", { y1: M.t, y2: M.t + ih, stroke: cvar("--axis"), "stroke-width": 1, opacity: 0 });
  svg.appendChild(hit); svg.appendChild(cross);
  hit.addEventListener("mousemove", (ev) => {
    const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    let near = ts[0];
    ts.forEach(t => { if (Math.abs(x(t) - px) < Math.abs(x(near) - px)) near = t; });
    cross.setAttribute("x1", x(near)); cross.setAttribute("x2", x(near)); cross.setAttribute("opacity", 1);
    const tip = document.getElementById("tip2"), fig = svg.parentElement.getBoundingClientRect();
    tip.innerHTML = "<h4>up to " + near + "s</h4>" + DATA.order.map(n => {
      const p = DATA.buckets[n].find(v => v.t === near);
      return '<div class="row"><span><i class="swatch" style="background:' + cvar(COLOR[n]) + ';width:9px;height:9px;margin-right:5px"></i>' + n + "</span><b>" + fmt(p.p95) + " ms</b></div>";
    }).join("");
    tip.style.opacity = 1;
    tip.style.left = Math.min(x(near) / W * fig.width + 16, fig.width - 195) + "px";
    tip.style.top = "14px";
  });
  hit.addEventListener("mouseleave", () => { cross.setAttribute("opacity", 0); document.getElementById("tip2").style.opacity = 0; });
}

function drawTable() {
  document.getElementById("tbody").innerHTML = DATA.order.map(n => {
    const d = DATA.totals[n];
    const pass = d.p95 < THRESHOLD && d.errors === 0 && d.timeouts === 0;
    return "<tr><td>" + n + "</td><td>" + d.statuses + "</td><td>" + d.calls + "</td><td>" + fmt(d.min) + "</td><td>" + fmt(d.p50) +
      "</td><td>" + fmt(d.mean) + "</td><td>" + fmt(d.p95) + "</td><td>" + fmt(d.p99) + "</td><td>" + fmt(d.max) +
      "</td><td>" + (pass ? "PASS" : "FAIL") + "</td></tr>";
  }).join("");
  const ts = DATA.buckets[DATA.order[0]].map(b => b.t);
  document.getElementById("thead2").innerHTML = "<th>Endpoint</th>" + ts.map(t => "<th>" + t + "s</th>").join("");
  document.getElementById("tbody2").innerHTML = DATA.order.map(n =>
    "<tr><td>" + n + "</td>" + DATA.buckets[n].map(b => "<td>" + fmt(b.p95) + "</td>").join("") + "</tr>"
  ).join("");
}

function renderAll() { legend("legend1"); legend("legend2"); drawDumbbell(); drawLines(); drawTable(); }
renderAll();

document.getElementById("theme").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const isDark = cur === "dark" || (!cur && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", isDark ? "light" : "dark");
  renderAll();
});
document.getElementById("tableBtn").addEventListener("click", (e) => {
  const v = document.getElementById("tableView");
  v.classList.toggle("hidden");
  e.target.textContent = v.classList.contains("hidden") ? "Show data table" : "Hide data table";
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
</script>
</body>
</html>
`;
}

function main() {
  const [input, output] = process.argv.slice(2);
  const raw = input ? fs.readFileSync(input, 'utf8') : fs.readFileSync(0, 'utf8');
  const data = extract(raw);
  const meta = describeRun(data);
  const html = render(data, meta);
  const target = output || path.join('docs', 'loadTestReport.html');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);

  console.log(`Report written to ${target}`);
  console.log(`  ${meta.title}`);
  console.log(`  ${data.totalCalls} requests across ${data.order.length} endpoints, ${data.totalErrors} errors`);
  data.order.forEach((n) => {
    const d = data.totals[n];
    console.log(`  ${n.padEnd(12)} p50 ${String(d.p50).padEnd(8)} p95 ${String(d.p95).padEnd(8)} ${d.p95 < P95_THRESHOLD_MS ? 'PASS' : 'FAIL'}`);
  });
}

main();
