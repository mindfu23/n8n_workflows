// Simulates the n8n run of jobsearcher-workflow.fixed.json Code nodes (no n8n, no network).
// Run: node workflows/jobsearcher-workflow.fixed.test.js

const assert = require('assert');
const wf = require(process.argv[2] || "./jobsearcher-workflow.fixed.json");
const code = n => wf.nodes.find(x => x.name === n).parameters.jsCode;
const run = (src, ctx) => new Function('$', '$input', '$getWorkflowStaticData', `return (function(){${src}\n})()`)(ctx.$, ctx.$input, ctx.sd);

function scenario(name, outputs /* [ok items, err items] */, staticInit = {}) {
  const static_ = JSON.parse(JSON.stringify(staticInit));
  const sd = () => static_;
  const store = {};
  const mk = (node, branches) => ({ first: () => branches[0][0], all: (b = 0) => branches[b] || [] });
  const $ = n => store[n];
  // Initialize Config
  const init = run(code('Initialize Config'), { $, $input: null, sd });
  store['Initialize Config'] = mk('Initialize Config', [init]);
  store['Gemini: Search Jobs'] = mk('Gemini: Search Jobs', outputs);
  let aggRuns = 0, emails = [];
  const runAgg = () => {
    aggRuns++;
    const agg = run(code('Aggregate & Deduplicate'), { $, $input: null, sd });
    const rep = run(code('Build Report'), { $, $input: { first: () => agg[0] }, sd });
    const html = run(code('Format HTML Email'), { $, $input: { first: () => rep[0] }, sd });
    emails.push(html[0].json.subject);
    const saved = run(code('Save State for Next Run'), { $, $input: { first: () => html[0] }, sd });
    return { agg: agg[0].json, rep: rep[0].json, saved: saved[0].json };
  };
  let res;
  if (outputs[0].length) res = runAgg();                       // success branch
  if (outputs[1].length) {                                     // error branch -> guard
    const g = run(code('Search Failed Guard'), { $, $input: null, sd });
    if (g.length) res = runAgg();
  }
  console.log(`\n== ${name}: aggregate runs=${aggRuns}, emails=${JSON.stringify(emails)}`);
  return { res, aggRuns, emails, static_ };
}

const ok = (jobs, i) => ({ json: { candidates: [{ content: { parts: [{ text: JSON.stringify(jobs) }] }, finishReason: 'STOP' }] }, pairedItem: { item: i } });
const err = i => ({ json: { error: { message: '404 - This model models/gemini-2.0-flash is no longer available' } }, pairedItem: { item: i } });
const job = (t, c, u) => ({ title: t, company: c, location: 'Remote', url: u, isOpen: true });
const prior = { seenJobs: { 'x.com/old': { title: 'Old', company: 'O', firstSeen: '2026-01-01', lastSeen: '2099-01-01' } }, previousResults: [{ title: 'Old', company: 'O', url: 'https://x.com/old', platform: 'Lever' }] };

// A: all 6 searches fail
let A = scenario('all fail', [[], [0,1,2,3,4,5].map(err)], prior);
assert.strictEqual(A.aggRuns, 1); assert.match(A.emails[0], /^SEARCH FAILED/);
assert.match(A.res.rep.report, /6 of 6 searches failed/); assert.match(A.res.rep.report, /no longer available/);
assert.strictEqual(A.res.saved.searchFailed, true);
assert.deepStrictEqual(A.static_.previousResults, prior.previousResults, 'history kept');

// B: mixed: 3 ok with a job each, 3 fail
let B = scenario('mixed', [[0,1,2].map(i => ok([job('Technical Writer', 'Co' + i, `https://jobs.example.com/${i}`)], i)), [3,4,5].map(err)], prior);
assert.strictEqual(B.aggRuns, 1, 'exactly one report'); assert.match(B.emails[0], /^SEARCH FAILED/);
assert.match(B.res.rep.report, /3 of 6 searches failed/); assert.match(B.res.rep.report, /Partial results \(3\)/);
assert.match(B.res.rep.report, /Workable: API error/);

// C: all ok but empty (what gemini-2.5-flash returned in the 2026-10-31 live test)
let C = scenario('all empty', [[0,1,2,3,4,5].map(i => ok([], i)), []], prior);
assert.strictEqual(C.aggRuns, 1); assert.match(C.emails[0], /^SEARCH FAILED/); assert.match(C.res.rep.report, /Zero results/);
assert.deepStrictEqual(C.static_.previousResults, prior.previousResults);

// D: all ok with results (one grounding-redirect URL filtered out)
let D = scenario('all good', [[0,1,2,3,4,5].map(i => ok([job('Senior Technical Writer', 'Co' + i, `https://jobs.example.com/${i}`), job('X', 'Y', 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc')], i)), []], prior);
assert.strictEqual(D.aggRuns, 1); assert.match(D.emails[0], /^Tech Writer Job Search — .* — 6 positions \(6 new\)/);
assert.ok(!/SEARCH FAILED/.test(D.res.rep.report)); assert.strictEqual(D.res.saved.success, true);
assert.strictEqual(D.static_.previousResults.length, 6, 'history updated on success');
console.log('\nALL 4 SCENARIOS PASS');
console.log('\n--- sample failure report (A) ---\n' + A.res.rep.report);
