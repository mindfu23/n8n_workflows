# JobSearcher n8n Workflow — Integration Guide

Replaces the GitHub Actions + Claude web_search pipeline with an n8n workflow that has proper deduplication, persistent state tracking, and email delivery.

## What's Different from the Current Script

| Feature | Current (Python/GH Actions) | n8n Workflow |
|---------|----------------------------|--------------|
| **Deduplication** | Claude identifies dupes but still shows them | Code-based URL + title/company dedup, excluded from report |
| **"Already seen" tracking** | Google Sheets (optional, URL-only) | Built-in persistent state (`$getWorkflowStaticData`) |
| **"Already applied" tracking** | Google Sheets column | Persistent state + webhook to mark applied |
| **New vs repeat** | Compares to yesterday's file | Compares to all previously seen URLs (60-day window) |
| **Search execution** | Claude web_search tool (single LLM call) | Gemini with Google Search grounding (per-platform) |
| **Email** | Gmail SMTP via Python | Gmail node (OAuth) or SMTP fallback |
| **Schedule** | GitHub Actions cron | n8n Schedule Trigger |
| **Debugging** | Log files | Visual execution history per node |
| **Manual trigger** | Run GH Action manually | POST to webhook |

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              TRIGGERS                                     │
│  ┌─────────────────┐    ┌──────────────────────┐                         │
│  │ Daily Schedule   │    │ Manual Webhook (POST)│                         │
│  │ Mon-Fri 7am PT   │    │ /jobsearch-trigger   │                         │
│  └────────┬─────────┘    └──────────┬───────────┘                         │
│           └──────────┬──────────────┘                                     │
│                      ▼                                                    │
│           ┌──────────────────┐                                            │
│           │ Initialize Config │  ← Loads saved state (seen jobs,          │
│           │                  │    applied jobs, previous results)          │
│           └────────┬─────────┘                                            │
│                    ▼                                                      │
│           ┌──────────────────┐                                            │
│           │ Split Searches   │  ← Fans out 6 platform-specific searches  │
│           └────────┬─────────┘                                            │
└────────────────────┼─────────────────────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        SEARCH (per platform)                              │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Gemini 2.0 Flash + Google Search Grounding                      │    │
│  │                                                                   │    │
│  │  Greenhouse → Ashby → Lever → Workable → Indeed → LinkedIn       │    │
│  │  (batched 2 at a time, 3s interval to respect rate limits)       │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    AGGREGATE & DEDUPLICATE                                 │
│                                                                           │
│  1. Parse all search results into structured jobs                         │
│  2. Deduplicate by normalized URL                                         │
│  3. Deduplicate by company + title similarity                             │
│  4. Classify: New / Previously Found / Applied                            │
│  5. Identify removed jobs (in previous run, not today)                    │
│  6. Update seen-jobs tracking state                                       │
└──────────────────────────────────────────────────────────────────────────┘
                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      REPORT & EMAIL                                       │
│                                                                           │
│  Build Report → Format HTML → Send Gmail → Save State                    │
│                                                                           │
│  Report sections:                                                         │
│  🆕 New Positions (not seen before)                                       │
│  📁 Previously Found (seen before, still active)                          │
│  ⚠️ Duplicate Postings (cross-platform groups)                            │
│  📋 All Positions (deduplicated)                                          │
│  ❌ Removed Since Last Search                                             │
│  📊 Search Summary (per-platform table)                                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/jobsearch-trigger` | POST | Manually trigger a search run |
| `/webhook/jobsearch-applied` | POST | Mark a job URL as "applied" |
| `/webhook/jobsearch-status` | GET | View current tracking state |

---

## Setup Instructions

### 1. Import Workflow

1. Go to `http://35.188.141.23:5678`
2. Workflows → Import from File
3. Select `jobsearcher-workflow.json`

### 2. Configure Credentials

#### Gemini API (Required)
- Settings → Credentials → Add → "Query Auth"
- Name: `gemini-api`
- Query Parameter Name: `key`
- Value: Your Gemini API key

#### Gmail (Option A — OAuth, recommended)
- Settings → Credentials → Add → "Gmail OAuth2"
- Follow n8n's Gmail setup guide
- This allows sending as your Gmail account

#### Gmail (Option B — SMTP with App Password)
If OAuth is complex, replace the Gmail node with an **Email Send** node:
- Host: `smtp.gmail.com`
- Port: `465`
- SSL: Yes
- User: Your Gmail address
- Password: Gmail App Password (16 chars)

### 3. Set Email Recipient

In the "Format HTML Email" or "Send Email" node, update the recipient:
- Edit the "Send Email (Gmail)" node
- Set the `sendTo` field to your email address

Alternatively, add it to the Initialize Config node as a variable.

### 4. Activate the Workflow

Toggle the workflow to **Active** to enable the daily schedule.

---

## Testing

```bash
# Manual trigger
curl -X POST http://35.188.141.23:5678/webhook/jobsearch-trigger \
  -H "Content-Type: application/json" \
  -d '{}'

# Check status / tracked jobs
curl http://35.188.141.23:5678/webhook/jobsearch-status

# Mark a job as applied
curl -X POST http://35.188.141.23:5678/webhook/jobsearch-applied \
  -H "Content-Type: application/json" \
  -d '{"url": "https://boards.greenhouse.io/company/jobs/12345"}'
```

---

## How Deduplication Works

The n8n workflow fixes the duplicate issue with a multi-layer approach:

### Layer 1: URL Normalization
```
https://boards.greenhouse.io/acme/jobs/123?gh_jid=456
→ boards.greenhouse.io/acme/jobs/123

https://Boards.Greenhouse.io/acme/jobs/123/
→ boards.greenhouse.io/acme/jobs/123
```
- Strips protocol, www, query params, trailing slashes
- Case-insensitive comparison

### Layer 2: Company + Title Match
```
"Technical Writer" at "Acme Corp" (Greenhouse)
"Technical Writer" at "Acme Corp" (Indeed)
→ Identified as same position, grouped as duplicate
```

### Layer 3: Cross-Run Tracking
```
Run 1: Found AAAA, BBBB, CCCC → All shown as "New"
Run 2: Found BBBB, CCCC, DDDD →
  - DDDD shown as "New"
  - BBBB, CCCC shown as "Previously Found"
  - AAAA shown as "Removed"
```

### Layer 4: Applied Jobs
```
POST /jobsearch-applied { "url": "https://..." }
→ URL added to applied list
→ Future runs: job appears in "Applied" section, NOT in "New"
```

---

## Customizing Search Queries

Edit the `Initialize Config` node to modify searches:

```javascript
const searches = [
  {
    name: 'Greenhouse — AI/SaaS Tech Writer',
    query: 'site:boards.greenhouse.io "Technical Writer" "AI"',
    platform: 'Greenhouse'
  },
  // Add more searches here...
  {
    name: 'Custom — API Documentation',
    query: 'site:boards.greenhouse.io "API Documentation" "Developer Experience"',
    platform: 'Greenhouse'
  }
];
```

---

## Email Format

The email matches the current script's format:

**Subject:** `Tech Writer Job Search — 2026-02-18 — 14 positions (3 new)`

**Sections:**
1. Header with stats
2. 🆕 New Positions (with full details)
3. 📁 Previously Found (compact list with first-seen date)
4. ⚠️ Duplicate Postings (grouped with recommendations)
5. 📋 All Positions (full details, deduplicated)
6. ❌ Removed Since Last Search
7. 📊 Search Summary table

---

## Cost Estimate

| Service | Cost |
|---------|------|
| Gemini 2.0 Flash | Free (1,500 req/day) |
| n8n (self-hosted) | Already running on GCP |
| Gmail sending | Free |

**Total: $0.00/day** (within Gemini free tier)

vs. current script: ~$0.10-0.50/day (Claude API with web_search)

---

## Migration Checklist

- [ ] Import workflow into n8n
- [ ] Configure Gemini API credential
- [ ] Configure Gmail (OAuth or SMTP)
- [ ] Set email recipient
- [ ] Test with manual trigger webhook
- [ ] Verify email arrives with correct format
- [ ] Activate workflow for daily schedule
- [ ] Optionally disable GitHub Actions cron job
- [ ] Mark any already-applied jobs via webhook
