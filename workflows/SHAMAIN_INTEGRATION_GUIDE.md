# ShamAIn + n8n Integration Guide

This workflow provides smart LLM routing for the ShamAIn chatbot, automatically selecting the best model based on query type and enforcing concise responses.

## Workflow Features

### Smart Routing

| Query Type | Detected By | Model Used | Why |
|------------|-------------|------------|-----|
| **Quick** | ≤5 words | Claude Haiku | Fast, cheap, concise |
| **Deep** | "explain", "why", "help me understand", "advice" | Claude Sonnet | Nuanced, thoughtful |
| **Realtime** | "latest", "news", "today", "current" | Perplexity | Web search capability |
| **Creative** | "write", "story", "poem", "imagine" | GPT-4o-mini | More expressive |
| **General** | Default | Claude Haiku | Good balance |

### Conciseness Enforcement

The workflow automatically:
- Removes filler phrases ("Great question!", "I'd be happy to help!")
- Strips trailing pleasantries ("Let me know if you need anything else!")
- Flags verbose responses (>200 words) in metadata
- Uses concise system prompts for all models

### Fallback Logic

```
Primary Model → Parse Response → Check for Error
                                      ↓
                         [Error?] → Gemini Flash (fallback)
                                      ↓
                         [Still Error?] → Generic apology message
```

---

## Workflow File

**Location**: `n8n/workflows/shamain-smart-routing-workflow.json`

**Endpoints**:
- Chat: `POST http://35.188.141.23:5678/webhook/shamain-chat`
- Health: `GET http://35.188.141.23:5678/webhook/shamain-health`

---

## Setup Instructions

### 1. Import Workflow

1. Go to `http://35.188.141.23:5678`
2. Workflows → Import from File
3. Select `shamain-smart-routing-workflow.json`

### 2. Configure Credentials

| Credential Name | Type | For Node |
|-----------------|------|----------|
| `anthropic-api` | Header Auth (`x-api-key`) | Claude Haiku, Claude Sonnet |
| `perplexity-api` | Header Auth (`Authorization: Bearer`) | Perplexity |
| `gemini-api` | Query Auth (`key`) | Gemini Flash (fallback) |
| `openai-api` | OpenAI API (built-in) | GPT-4o-mini |

### 3. Test Endpoint

```bash
# Health check
curl http://35.188.141.23:5678/webhook/shamain-health

# Simple query (routes to Haiku)
curl -X POST http://35.188.141.23:5678/webhook/shamain-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2+2?"}'

# Deep query (routes to Sonnet)
curl -X POST http://35.188.141.23:5678/webhook/shamain-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Can you help me understand why I feel anxious about my job?"}'

# Realtime query (routes to Perplexity)
curl -X POST http://35.188.141.23:5678/webhook/shamain-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What are the latest news about AI?"}'
```

---

## Integrating with ShamAIn

### Option 1: Update Netlify Function

Replace the AI service call in `/netlify/functions/chat.js`:

```javascript
// netlify/functions/chat.js

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://35.188.141.23:5678/webhook/shamain-chat';

exports.handler = async (event, context) => {
  try {
    const { message, conversationHistory, userId } = JSON.parse(event.body);

    // Call n8n workflow instead of direct AI service
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversationHistory: conversationHistory || [],
        userId: userId || 'anonymous'
      })
    });

    if (!response.ok) {
      throw new Error(`n8n error: ${response.statusText}`);
    }

    const result = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: result.message,
        model: result.model,
        queryType: result.queryType,
        citations: result.citations,
        meta: result.meta
      })
    };
  } catch (error) {
    console.error('Chat error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

### Option 2: Update Frontend Service Directly

If you want to bypass Netlify functions entirely:

```javascript
// web/src/services/gptService.js

const N8N_URL = 'http://35.188.141.23:5678/webhook/shamain-chat';

export async function sendMessage(message, conversationHistory = []) {
  const response = await fetch(N8N_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      conversationHistory: conversationHistory.map(m => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.text
      }))
    })
  });

  if (!response.ok) {
    throw new Error('Failed to get response');
  }

  const result = await response.json();

  return {
    text: result.message,
    model: result.model,
    queryType: result.queryType,
    citations: result.citations
  };
}
```

---

## API Request/Response Format

### Request

```json
{
  "message": "What's the meaning of life?",
  "conversationHistory": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi there! How can I help?" }
  ],
  "userId": "user_123"
}
```

### Response

```json
{
  "success": true,
  "requestId": "shamain_1708456789_abc123",
  "message": "The meaning of life is a deeply personal question...",
  "queryType": "deep",
  "model": "claude-3-5-sonnet-20241022",
  "usedFallback": false,
  "citations": null,
  "meta": {
    "wordCount": 45,
    "sentenceCount": 3,
    "wasVerbose": false,
    "responseTimeMs": 1234
  }
}
```

---

## Customization

### Adjust Routing Keywords

In the "Classify Query & Route" node, modify the keyword arrays:

```javascript
// Add more "deep conversation" triggers
const deepKeywords = ['explain', 'why', 'how does', 'help me understand',
  'tell me about', 'what do you think', 'advice', 'feeling', 'struggling',
  'confused', 'worried', 'scared', 'excited'];  // Add your own

// Add more "realtime" triggers
const realtimeKeywords = ['latest', 'news', 'recent', 'today', 'current',
  'now', '2024', '2025', '2026', 'happening', 'update', 'stock', 'weather'];
```

### Adjust System Prompts

Each model node has its own system prompt. To make responses even more concise:

```javascript
// In Claude Haiku node, make max_tokens smaller:
max_tokens: 300  // Was 500

// Or add stricter instructions:
system: `You are ShamAIn. MAXIMUM 2 sentences per response. No filler.`
```

### Add More Models

To add Grok or another model:

1. Add a new output to the Switch node
2. Create a new HTTP Request node with the API configuration
3. Connect it to "Parse Primary Response"
4. Update the classification logic to route to it

---

## Monitoring

### View Execution Logs

In n8n UI:
1. Go to Executions (left sidebar)
2. Filter by "shamain-smart-routing"
3. Click any execution to see the full data flow

### Key Metrics to Track

| Metric | Location | What It Tells You |
|--------|----------|-------------------|
| `queryType` | Response | Which routing path was used |
| `usedFallback` | Response | Whether primary model failed |
| `responseTimeMs` | Response meta | Total latency |
| `wasVerbose` | Response meta | If conciseness filter flagged it |

---

## Cost Comparison

| Model | Cost per 1K tokens | Typical Response | Cost per Query |
|-------|-------------------|------------------|----------------|
| Claude Haiku | $0.00025 in / $0.00125 out | ~100 tokens | ~$0.0001 |
| Claude Sonnet | $0.003 in / $0.015 out | ~200 tokens | ~$0.003 |
| Perplexity Sonar | ~$0.005 / 1K | ~150 tokens | ~$0.001 |
| GPT-4o-mini | $0.00015 in / $0.0006 out | ~200 tokens | ~$0.0001 |
| Gemini Flash | $0.000075 in / $0.0003 out | ~150 tokens | ~$0.00005 |

**Estimated average cost**: ~$0.001 per query (vs ~$0.01+ with GPT-4 Turbo)

By routing most queries to Haiku, you'll save significantly on API costs while improving response quality (conciseness).
