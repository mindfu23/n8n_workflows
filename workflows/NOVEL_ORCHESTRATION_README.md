# Novel Orchestration Workflow - Multi-LLM Writing Pipeline

A sophisticated n8n workflow that orchestrates multiple LLM models to collaboratively write, review, and refine novel chapters.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PLANNING PHASE                                     │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────────┐            │
│  │   ChatGPT    │  │      Claude      │  │    Perplexity       │            │
│  │ Plot Outline │  │   Characters     │  │     Research        │            │
│  └──────┬───────┘  └────────┬─────────┘  └──────────┬──────────┘            │
│         └──────────────────┬┴───────────────────────┘                       │
│                            ▼                                                 │
│                   [Aggregate Planning]                                       │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DRAFTING PHASE (per chapter)                        │
│  ┌──────────────────┐     ┌─────────────────────┐                           │
│  │      Claude      │────▶│        Grok         │                           │
│  │  Write Chapter   │     │ Creative Flourishes │                           │
│  └──────────────────┘     └──────────┬──────────┘                           │
│                                      ▼                                       │
│                            [Combine Draft]                                   │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REVIEW PHASE (parallel)                            │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐                │
│  │    Gemini    │  │     ChatGPT      │  │     Claude      │                │
│  │ Developmental│  │   Consistency    │  │   Line Edit     │                │
│  └──────┬───────┘  └────────┬─────────┘  └────────┬────────┘                │
│         └──────────────────┬┴─────────────────────┘                         │
│                            ▼                                                 │
│                   [Aggregate Reviews]                                        │
│                            │                                                 │
│                   ┌────────┴────────┐                                        │
│                   ▼                 ▼                                        │
│            [Needs Revision?]  [Score >= 7]                                   │
│                   │                 │                                        │
│                   ▼                 ▼                                        │
│            [Claude Revise]   [Finalize Chapter]                              │
│                   │                 │                                        │
│                   └────────┬────────┘                                        │
│                            ▼                                                 │
│                   [Loop or Complete]                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Model Assignments

| Model | Role | Why This Model |
|-------|------|----------------|
| **Claude** | Character dev, drafting, line editing, revisions | Nuanced psychology, natural dialogue, prose quality |
| **ChatGPT** | Plot structure, consistency checking | Logical organization, world-building coherence |
| **Perplexity** | Research, fact-checking | Real-time search with citations |
| **Gemini** | Developmental review, synthesis | Long context window for full chapter analysis |
| **Grok** | Creative enhancements | Unexpected ideas, wit, unconventional elements |

## Setup Instructions

### 1. Import the Workflow

1. Open your n8n instance at `http://35.188.141.23:5678`
2. Go to **Workflows** → **Import from File**
3. Select `novel-orchestration-workflow.json`

### 2. Configure Credentials

Create these credentials in n8n (**Settings** → **Credentials**):

#### OpenAI API (for ChatGPT)
- Type: `OpenAI API`
- API Key: Your OpenAI API key

#### Anthropic/Claude (HTTP Header Auth)
- Type: `Header Auth`
- Name: `x-api-key`
- Value: Your Anthropic API key

#### Perplexity (HTTP Header Auth)
- Type: `Header Auth`
- Name: `Authorization`
- Value: `Bearer YOUR_PERPLEXITY_API_KEY`

#### Gemini (HTTP Query Auth)
- Type: `Query Auth`
- Name: `key`
- Value: Your Google AI API key

#### Grok/xAI (HTTP Header Auth)
- Type: `Header Auth`
- Name: `Authorization`
- Value: `Bearer YOUR_XAI_API_KEY`

#### Google Sheets (OAuth2)
- Type: `Google Sheets OAuth2`
- Follow n8n's Google OAuth setup

### 3. Set Environment Variables

In n8n settings or your `.env` file:

```env
NOVEL_TRACKING_SHEET_ID=your-google-sheet-id
NOVEL_OUTPUT_DOC_ID=your-google-doc-id
```

### 4. Create Google Sheet Structure

Create a Google Sheet with two tabs:

**Tab 1: Projects**
| Project ID | Concept | Genre | Status | Target Chapters | Created At | Planning Data |
|------------|---------|-------|--------|-----------------|------------|---------------|

**Tab 2: Chapters**
| Chapter Number | Word Count | Final Score | Revision Count | Completed At | Chapter Text |
|----------------|------------|-------------|----------------|--------------|--------------|

## Usage

### Via Webhook (Production)

```bash
curl -X POST http://35.188.141.23:5678/webhook/novel-orchestrator \
  -H "Content-Type: application/json" \
  -d '{
    "concept": "A detective in 1920s Chicago investigates murders connected to jazz clubs",
    "genre": "noir mystery",
    "tone": "hardboiled",
    "targetChapters": 5
  }'
```

### Via Manual Trigger (Testing)

1. Open the workflow in n8n
2. Edit the "Manual Test Trigger" node with your concept
3. Click "Execute Workflow"

## Input Parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `concept` | Yes | Your story concept/premise |
| `genre` | No | Genre (default: "literary fiction") |
| `tone` | No | Writing tone (default: "engaging") |
| `targetChapters` | No | Number of chapters to generate (default: 5) |

## Customization

### Adjusting Quality Threshold

In the "Aggregate Review Feedback" node, change this line:
```javascript
needsRevision: avgScore < 7  // Lower for faster, raise for higher quality
```

### Limiting Revision Cycles

In the "Update Chapter Draft" node:
```javascript
needsRevision: revisionCount < 3  // Max revision cycles per chapter
```

### Skipping Grok

If you don't have Grok API access, you can:
1. Delete the "Grok: Creative Enhancements" node
2. Connect "Claude: Write Chapter Draft" directly to "Combine Draft & Suggestions"
3. Update the combine code to handle missing Grok data

### Adding More Models

To add another LLM (e.g., Llama, Mistral):
1. Add an HTTP Request node with the API configuration
2. Connect it to the appropriate aggregation node
3. Update the aggregation code to parse the new model's response

## Cost Considerations

Approximate costs per chapter (as of 2024):
- Claude (Sonnet): ~$0.10-0.30
- ChatGPT (GPT-4 Turbo): ~$0.05-0.15
- Gemini (1.5 Pro): ~$0.05-0.10
- Perplexity: ~$0.01-0.05
- Grok: ~$0.05-0.15

**Estimated total per chapter: $0.25-0.75**
**5-chapter novel: ~$1.25-3.75**

## Troubleshooting

### "Parse error" in aggregation nodes
- The LLM didn't return valid JSON
- Check the raw response in the node output
- Adjust the prompt to be more explicit about JSON formatting

### Timeout errors
- Increase timeout in HTTP Request node settings
- Consider using webhook-based async patterns for long operations

### Google Sheets quota errors
- Reduce frequency of writes
- Batch multiple updates together
- Consider using Airtable instead

## Extending the Workflow

Ideas for enhancement:
- Add a "Cover Art Generator" using DALL-E or Midjourney
- Include a "Synopsis Generator" for marketing copy
- Add a "Beta Reader Simulation" stage with multiple personas
- Implement "Style Matching" to mimic specific authors
- Add "Sensitivity Reader" checks using specific prompts
