# JobSearcher fix: import notes (prepared 2026-10-31, NOT deployed)

`jobsearcher-workflow.fixed.json` fixes the live workflow "JobSearcher - Daily Tech Writer Job Search",
which has been emailing empty reports since about July 2026.

## What changed (relative to `jobsearcher-workflow.json`, the 2026-03-06 export)

1. **Model:** `Gemini: Search Jobs` calls `gemini-2.5-flash`. `gemini-2.0-flash` returns 404
   ("no longer available"; confirmed with a live call on 2026-10-31).
2. **No more `continueOnFail` on the search node.** Its setting is now *On Error → Continue (using error output)*.
   The error output goes to a new Code node, **Search Failed Guard**. That node continues only when *every*
   search failed, so a mixed run still produces a single report.
3. **Aggregate & Deduplicate** reads both outputs of the search node. It sets `searchFailed` when any
   search call failed **or** there are zero results across all searches.
4. **Build Report:** when `searchFailed` is set, the report starts with `# SEARCH FAILED` and gives the
   reasons, and the subject reads `SEARCH FAILED — Tech Writer Job Search — <date>`. A quiet "no new positions" can't happen any more.
5. **Save State for Next Run** leaves `seenJobs`/`previousResults` alone on a failed run, so one bad day
   doesn't wipe the dedupe history.

Nothing else changed: the triggers, the webhooks, the email node and its credentials are all the same.

## Before you import: the live workflow differs from this export

The March export never sets `emailTo`, but the live workflow sends email, so **the VM copy has edits
that this file lacks.** Pick one of these two routes:

**Route A (recommended): apply the changes to the live workflow by hand** (about 5 minutes in the n8n editor):
1. Open the live workflow. *Workflow menu → Download* to save a backup.
2. `Gemini: Search Jobs` → URL: replace `gemini-2.0-flash` with `gemini-2.5-flash`.
   Then *Settings* tab → **On Error → "Continue (using error output)"**, and turn off "Continue On Fail" if
   it shows as a separate toggle.
3. Copy the `jsCode` of **Aggregate & Deduplicate**, **Build Report** and **Save State for Next Run** from
   `jobsearcher-workflow.fixed.json` into the matching nodes. First check that the live versions don't carry their own edits.
4. Add a Code node named exactly **Search Failed Guard** with the `jsCode` from the fixed file. Wire it as
   `Gemini: Search Jobs` (error output) → `Search Failed Guard` → `Aggregate & Deduplicate`.
5. Save, then click *Test workflow* (Manual Trigger Webhook) once.

**Route B: import the file as a new workflow** and compare it side by side:
1. n8n editor → *Workflows → Add workflow → ⋯ → Import from File* → choose `jobsearcher-workflow.fixed.json`.
   It imports **inactive** and named "(FIXED 2026-10-31)".
2. Re-select the credentials: the Gemini query-auth credential on `Gemini: Search Jobs` and the Gmail OAuth2
   credential on `Send Email (Gmail)` (exports never carry credential secrets). Set the recipient that the live copy uses.
3. The webhook paths (`jobsearch-trigger`, `jobsearch-applied`, `jobsearch-status`) clash with the live
   workflow. Deactivate the old workflow before activating this one. Workflow static data (seen and applied jobs)
   does **not** carry over to a new workflow, so Route A keeps your history.

Needs n8n ≥ 1.x with per-node *On Error* settings (the "error output" option).

## What to expect after the fix

When we tested two of the workflow's queries live against `gemini-2.5-flash` on 2026-10-31, both came back
`[]`. The model swap alone may therefore produce **"SEARCH FAILED: Zero results"** emails instead of real
listings. That's the fix doing its job: the failure is now visible. The longer-term fix is to read the public
ATS boards directly (Greenhouse, Lever, Ashby), as the `JobSearcher` repo now does on branch `fix/loud-failures-ats`.

## Test

`node workflows/jobsearcher-workflow.fixed.test.js` runs the Code nodes' JavaScript through four scenarios:
all searches fail, mixed results, all empty, and all good. It checks that each scenario produces exactly one
report, the right subject, and that history is kept on failure. It simulates n8n with no n8n instance and no
network. Two n8n behaviours are assumed, not tested: `$('node').all(1)` returns the error-output items, and
error items keep `pairedItem`. If `pairedItem` is missing, errors read "Unknown" instead of the platform name,
but the failure is still reported.
