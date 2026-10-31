# Novel Orchestration - Multi-LLM Writing Pipeline

An n8n workflow that writes full-length novels by orchestrating multiple AI models, each assigned a specialized role in a multi-phase pipeline. Chapters are drafted, reviewed, revised, and saved incrementally to Google Sheets and Google Docs.

## Architecture Overview

```
Manual Trigger / Webhook
        │
        ▼
  Initialize Project State
        │
        ▼
  ┌─────────────────────────────┐
  │   PLANNING PHASE (parallel) │
  │                             │
  │  ChatGPT ─── Plot Outline  │
  │  Claude ──── Characters     │
  │  Perplexity ─ Research      │
  └─────────────────────────────┘
        │
        ▼
  Aggregate Planning Data
        │
        ▼
  Save Project to Sheets
        │
        ▼
  ┌─────────────────────────────────────────────────┐
  │              CHAPTER LOOP                        │
  │                                                  │
  │  Start Drafting Phase                            │
  │       │                                          │
  │       ▼                                          │
  │  Claude: Write Chapter Draft                     │
  │       │                                          │
  │       ▼                                          │
  │  Grok: Creative Enhancements                     │
  │       │                                          │
  │       ▼                                          │
  │  Combine Draft & Suggestions                     │
  │       │                                          │
  │       ├──► Gemini: Comprehensive Review           │
  │       ├──► Claude: Consistency Check              │
  │       └──► Claude: Line Editing                   │
  │              │                                    │
  │              ▼                                    │
  │       Aggregate Review Feedback                  │
  │              │                                    │
  │              ▼                                    │
  │       Needs Revision? ──yes──► Claude: Revise    │
  │              │                      │             │
  │              no                     ▼             │
  │              │              Update Chapter Draft  │
  │              ▼                      │             │
  │       Finalize Chapter ◄────────────┘             │
  │              │                                    │
  │              ▼                                    │
  │       All Chapters Done?                         │
  │         │           │                             │
  │        yes          no ──► Save to Sheets        │
  │         │                  Append to Doc          │
  │         │                  Save Pipeline Log      │
  │         │                  Save Spare Text        │
  │         │                  Continue to Next ──┐   │
  │         │                                     │   │
  │         │              ┌──────────────────────┘   │
  │         │              └──► (loop back to Start)  │
  └─────────│─────────────────────────────────────────┘
            ▼
     Compile Summary
            │
            ▼
     Export to Google Docs
            │
            ▼
     Return Success Response
```

## AI Models and Their Roles

| Model | Role | Why This Model |
|-------|------|----------------|
| **GPT-4o** | Plot outline / story structure | Strong logical plot architecture and Story Circle mapping |
| **Claude Opus** | Chapter drafting, character development, revision | Nuanced prose, character psychology, dialogue voice |
| **Grok 3** | Creative enhancements | Unexpected creative flourishes, wit, and memorable details |
| **Gemini 2.5 Flash** | Developmental review | Long context window ideal for full chapter analysis |
| **Claude Sonnet** | Consistency check, line editing | Fast, precise analytical feedback |
| **Perplexity Sonar Pro** | Research and factual grounding | Accurate details with source citations |

## Input Configuration

All novel configuration is set in the **Manual Test Trigger** node's `manualTriggerData` JSON (or via the webhook POST body). Here are all available fields:

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `projectSlug` | string | URL-safe project identifier (e.g., `"miskatonic-boys"`) |
| `concept` | string | Novel premise in 2-5 sentences. This is the core prompt that all AI nodes reference. |
| `genre` | string | Genre label (e.g., `"Lovecraftian horror comedy"`, `"literary fiction"`, `"sci-fi thriller"`) |
| `targetChapters` | number | Total number of chapters to generate |

### Voice, Tone, and Style

| Field | Type | Description |
|-------|------|-------------|
| `tone` | string | Brief tone description (e.g., `"darkly humorous, musically passionate, conspiratorial fun"`) |
| `voiceGuide` | string | **Detailed prose style instructions.** This is injected into every chapter drafting and revision prompt. Can include sentence length targets, dialogue percentages, POV instructions, word choice rules, humor approach, and explicit "AVOID" lists. See example below. |
| `authorFeedback` | string | Ongoing feedback applied to all subsequent chapters (e.g., `"Make dialogue snappier"`, `"More internal monologue from Korwen"`) |

#### Voice Guide Example

The `voiceGuide` field accepts detailed, multi-paragraph prose instructions:

```
IMMERSIVE, CHARACTER-DRIVEN PROSE. The reader should be inside
the characters' experiences.

SHORT SENTENCES (60-70% at 12 words or fewer). Fragments for
in-the-moment reactions: 'The sound again.' / 'Closer this time.'

DIALOGUE-DRIVEN (45-55% of text). Characters speak like real
college students. Almost exclusively 'said'/'asked'.

HUMOR FROM SITUATIONS, NOT NARRATOR. Scott Pilgrim energy:
mundane and epic coexist without winking at the camera.

CLOSE THIRD PERSON rotating POV. Stay inside their experience.

AVOID: Meta narrator commentary, purple prose, humor undercutting
stakes, adverb-heavy attribution.
```

### Story Circle Integration

| Field | Type | Description |
|-------|------|-------------|
| `useStoryCircle` | boolean | Enable Dan Harmon's Story Circle beat mapping (default: `true`) |
| `protagonistGoal` | string | External goal driving the plot |
| `protagonistInternalGoal` | string | Emotional/psychological arc |
| `antagonistGoal` | string | What the antagonist wants and how it conflicts with the protagonist |
| `supportingCharacterArcs` | string | Secondary character development threads |

When `useStoryCircle` is enabled, each chapter is automatically mapped to one of the 8 Story Circle beats based on its position in the total chapter count:

1. **YOU** (comfort zone) — Establish the protagonist in their ordinary world
2. **NEED** (want something) — The protagonist recognizes a desire or lack
3. **GO** (enter unfamiliar) — Cross the threshold into the unknown
4. **SEARCH** (adapt) — Struggle to adapt to new circumstances
5. **FIND** (get what they wanted) — Achieve the goal or a version of it
6. **TAKE** (pay a heavy price) — The cost of success; reversal
7. **RETURN** (back to familiar) — Return changed
8. **CHANGE** (transformed) — Fundamental transformation; new equilibrium

The beat mapping is injected into the chapter drafting prompt along with the emotional arc direction (ascending/peak/descending) and how the protagonist's state should affect the people around them.

### Chapter Outlines

| Field | Type | Description |
|-------|------|-------------|
| `chapterOutlines` | object | Per-chapter plot outlines as `{ "1": "outline...", "2": "outline...", ... }` |
| `finalChapterSummary` | string | How the story ends — all chapters build toward this |

You can provide outlines for some chapters and leave others blank. The AI will:
- Follow your outlines exactly for chapters that have them
- Generate connecting plot for unoutlined chapters that bridges between your outlined chapters
- Always build toward the `finalChapterSummary`

### Operational Settings

| Field | Type | Description |
|-------|------|-------------|
| `chapterLengthMode` | string | `"adaptive"` (let the story dictate length) or `"fixed"` (2000-3000 words) |
| `startFromChapter` | number | Resume from a specific chapter (e.g., `6` to skip chapters 1-5) |

## Google Sheets Storage

The workflow saves data to a Google Spreadsheet with these tabs:

| Tab | Contents |
|-----|----------|
| `{slug}-projects` | Project metadata snapshot from the planning phase |
| `{slug}-chapters` | Completed chapters with: Project Slug, Chapter Number, Word Count, Final Score, Revision Count, Completed At, Chapter Text |
| `{slug}-log` | Pipeline execution log with per-node timing and token counts |
| `{slug}-spare` | Unused creative material: Grok suggestions, line edits, pre-revision drafts |

Currently configured for the spreadsheet ID `1vSGcfSPmDKBUAvk7vJK7Y76PX5rJNr3L82ipCP5xsjI`. Tab names are hardcoded to `miskatonic-boys-*` in the current version — update these in the four Google Sheets nodes when switching projects.

## Google Docs Output

Each chapter is appended incrementally to a Google Doc as it's finalized, so you have a running manuscript even if the workflow crashes mid-run. Currently configured for document ID `1Ikyr4XOq4Bi8C2Jqs0tILKwQ7_9Lij5RK2IsRQcJgDE`.

## Quality Gate

After each chapter is drafted, three review models score it independently:
- Gemini: overall developmental score (1-10)
- Claude Sonnet: consistency score (1-10)
- Claude Sonnet: prose quality score (1-10)

If the **average score < 7.0**, the chapter enters a revision cycle where Claude Opus rewrites it incorporating all feedback. The revised chapter then goes directly to finalization (no re-review loop — single revision pass).

## Memory Management

To run on a 1GB e2-micro VM, the workflow uses several memory-saving strategies:

- **Incremental saves**: Chapters, logs, and spare text are saved to Google Sheets/Docs after each chapter, then cleared from in-memory state
- **Slim chapter references**: `completedChapters` stores only metadata (word count, score, timestamp) — not full chapter text
- **Token/log flushing**: `tokenUsage`, `pipelineLog`, and `spareText` arrays are flushed to output each iteration and cleared from the carried state
- **Side-effect saves**: Google Sheets saves run as parallel branches, not inline in the loop-back data path, preventing API response data from corrupting project state

For additional safety on constrained VMs, consider adding a swap file:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Lorebook MCP Server

The Lorebook is a companion tool (MCP server) for managing world-building context across writing sessions. It stores characters, settings, plot threads, themes, and other entries with trigger keywords, enabling **selective context injection** — only relevant entries are pulled in based on what's being written.

### How It Works

The Lorebook MCP server runs locally and is configured in `.mcp.json`:

```json
{
  "mcpServers": {
    "lorebook": {
      "command": "node",
      "args": ["/Users/jamesbeach/.claude/mcp-servers/lorebook/index.js"],
      "env": {
        "GOOGLE_SERVICE_ACCOUNT_KEY": "/path/to/service-account.json",
        "LOREBOOK_SHEET_ID": "your-spreadsheet-id"
      }
    }
  }
}
```

Data is stored locally in `.lorebook/lorebook.json` within the project directory, and can be synced bidirectionally with Google Sheets.

### Entry Categories

| Category | Use For |
|----------|---------|
| `character` | Character profiles, traits, relationships, speech patterns |
| `setting` | Locations, environments, atmosphere |
| `plot_thread` | Ongoing storylines, mysteries, conflicts |
| `theme` | Thematic elements, motifs, symbolism |
| `item` | Significant objects, artifacts, MacGuffins |
| `faction` | Groups, organizations, alliances |
| `concept` | World-building rules, magic systems, technology |
| `voice` | Writing style notes, POV rules, tone references |

### Key Tools

| Tool | Description |
|------|-------------|
| `init_lorebook` | Create a new lorebook for a project |
| `add_entry` | Add an entry with name, category, keywords, content, and tags |
| `update_entry` | Modify an existing entry by ID or name |
| `remove_entry` | Delete an entry |
| `get_context_for_text` | **Core tool** — pass chapter text, get back only the entries whose keywords match |
| `search_entries` | Full-text search across all entries |
| `list_entries` | List all entries, optionally filtered by category or tag |
| `auto_populate_from_planning` | Bulk-create entries from planning phase output (characters, settings, plot threads, themes) |
| `sync_to_sheets` | Push local lorebook to a Google Sheets tab |
| `sync_from_sheets` | Pull from Google Sheets back to local (merges by ID, last-write-wins) |

### Setting Up for a New Novel

1. **Initialize**: `init_lorebook` with your project directory and name
2. **Populate**: Use `auto_populate_from_planning` with your planning data, or manually `add_entry` for each character, setting, etc.
3. **Set keywords carefully**: Keywords trigger context injection. For a character named "Margin Hawthorne," good keywords are `["Margin", "Hawthorne", "Miskatonic Boys"]`. When any of these appear in the chapter text being worked on, that character's full profile is injected as context.
4. **Sync to Sheets**: Use `sync_to_sheets` to back up and enable collaborative editing in Google Sheets
5. **Sync back**: After editing in Sheets, use `sync_from_sheets` to pull changes back (merges by ID with last-write-wins)

### Lorebook and the n8n Workflow

The Lorebook MCP server is currently a **companion tool used during interactive writing sessions** (e.g., with Claude Code or other MCP-aware agents). It is not yet directly integrated into the n8n workflow's automated pipeline — the n8n workflow uses its own planning phase (ChatGPT plot + Claude characters + Perplexity research) and passes that context through the chapter loop.

A future enhancement could have the n8n workflow call the Lorebook to inject selective context per chapter, replacing the current approach of carrying the full planning blob through every iteration.

## Adapting for a Different Novel

To use this workflow for a new novel:

1. **Update the Manual Test Trigger** `manualTriggerData` with your new novel's configuration:
   - New `projectSlug`, `concept`, `genre`, `tone`
   - New `voiceGuide` tailored to your desired prose style
   - New `chapterOutlines` (as many or few as you want)
   - New `finalChapterSummary`
   - Set Story Circle fields or set `useStoryCircle: false`
   - Set `startFromChapter: 1`

2. **Update the Initialize Project State** fallback data (the `src` object in the Code node) to match — this is used when the Manual Test Trigger doesn't pass data through.

3. **Update Google Sheets tab names** in the four Sheets nodes:
   - Save Project to Sheets: `{new-slug}-projects`
   - Save Chapter to Sheets: `{new-slug}-chapters`
   - Save Pipeline Log: `{new-slug}-log`
   - Save Spare Text: `{new-slug}-spare`

4. **Create the tabs** in your Google Spreadsheet (or let the first run create them if your Sheets API permissions allow it).

5. **Update the Google Docs document ID** in "Append Chapter to Doc" and "Export to Google Docs" if using a different manuscript document.

6. **Set up a new Lorebook** (optional): Initialize and populate a lorebook for the new project's world-building data.

## Credentials Required

| Credential | n8n Credential Type | Used By |
|------------|-------------------|---------|
| OpenAI API | `openAiApi` | ChatGPT: Plot Outline |
| Anthropic API | `anthropicApi` | All Claude nodes (5 total) |
| Perplexity API | `perplexityApi` | Perplexity: Research & Facts |
| xAI API | `xAiApi` | Grok: Creative Enhancements |
| Google PaLM/Gemini API | `googlePalmApi` | Gemini: Comprehensive Review |
| Google Service Account | `googleApi` | All Google Sheets and Docs nodes (6 total) |

## Infrastructure

- **n8n**: Self-hosted on GCP Compute Engine (e2-micro, free tier)
- **OS**: Ubuntu 22.04
- **Stack**: Docker Compose + Caddy (reverse proxy/SSL)
- **VM IP**: `35.188.141.23:5678`

## Cost Estimate

Per chapter (no revision): ~$0.79
Per revision pass: ~$0.85
Planning phase (one-time): ~$1.00

A full 12-chapter novel run costs approximately **$15-20** depending on how many chapters need revision.

## Known Limitations

- Tab names in Google Sheets nodes are currently hardcoded — must be updated manually per project
- The quality gate does not re-review after revision (single revision pass only)
- No Lorebook integration in the automated n8n pipeline yet (companion tool only)
- The e2-micro VM (1GB RAM) can struggle with very long runs; swap file recommended
- Chapter continuity relies on summaries of previous chapters, not full text — some detail may be lost between chapters
