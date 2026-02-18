# Metabot + n8n Integration Guide

This guide shows how to integrate your Metabot app with n8n workflows for enhanced orchestration.

## Workflow Created

**File**: `metabot-enhanced-workflow.json`

**Improvements over current Metabot backend**:
- Visual workflow editing (no code changes needed)
- Query type classification with smart engine routing
- Optional critique round (Claude reviews synthesis)
- Built-in health check endpoint
- Easier debugging via n8n execution logs
- Simple A/B testing of different synthesis approaches

---

## Integration Options

### Option 1: Replace Express Backend Entirely

Update your Metabot frontend to call n8n directly:

```typescript
// web/src/services/api.ts

const N8N_BASE_URL = 'http://35.188.141.23:5678/webhook';

export async function queryAllEngines(
  query: string,
  engines?: string[],
  options?: QueryOptions
): Promise<MetabotResponse> {
  const response = await fetch(`${N8N_BASE_URL}/metabot-query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      engines: engines || ['openai', 'anthropic', 'gemini', 'perplexity'],
      synthesisEngine: 'gemini',
      options: {
        maxTokens: options?.maxTokens || 2000,
        temperature: options?.temperature || 0.7,
        enableCritique: options?.enableCritique || false
      }
    })
  });

  if (!response.ok) {
    throw new Error(`n8n error: ${response.statusText}`);
  }

  return response.json();
}

// Health check
export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${N8N_BASE_URL}/metabot-health`);
  return response.json();
}
```

### Option 2: Hybrid - Route Complex Queries to n8n

Keep Express for simple queries, use n8n for enhanced features:

```typescript
// backend/src/routes/query.ts

import axios from 'axios';

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/metabot-query';

router.post('/query', async (req, res) => {
  const { query, engines, options } = req.body;

  // Use n8n for critique-enabled queries or complex orchestration
  if (options?.enableCritique || options?.useN8n) {
    try {
      const n8nResponse = await axios.post(N8N_WEBHOOK_URL, {
        query,
        engines,
        options
      }, { timeout: 120000 });

      return res.json(n8nResponse.data);
    } catch (error) {
      console.error('n8n error, falling back to direct:', error.message);
      // Fall through to direct execution
    }
  }

  // Direct execution (existing logic)
  const responses = await aiService.queryAll(query, engines);
  // ... rest of existing logic
});
```

### Option 3: n8n as Middleware (Async Processing)

Use n8n for background processing with callbacks:

```typescript
// Start async processing
router.post('/query/async', async (req, res) => {
  const jobId = generateJobId();

  // Trigger n8n workflow (fire and forget)
  axios.post(`${N8N_WEBHOOK_URL}`, {
    ...req.body,
    callbackUrl: `${process.env.API_URL}/webhook/n8n-complete`,
    jobId
  }).catch(console.error);

  res.json({ jobId, status: 'processing' });
});

// Callback from n8n when complete
router.post('/webhook/n8n-complete', async (req, res) => {
  const { jobId, result } = req.body;

  // Store result, notify client via WebSocket, etc.
  await storeResult(jobId, result);
  notifyClient(jobId, result);

  res.sendStatus(200);
});
```

---

## API Request/Response Format

### Request

```bash
curl -X POST http://35.188.141.23:5678/webhook/metabot-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the best practices for microservices architecture?",
    "engines": ["openai", "anthropic", "gemini", "perplexity"],
    "synthesisEngine": "gemini",
    "options": {
      "maxTokens": 2000,
      "temperature": 0.7,
      "enableCritique": true
    }
  }'
```

### Response

```json
{
  "success": true,
  "requestId": "req_1708123456789_abc123",
  "query": "What are the best practices for microservices architecture?",
  "queryType": "technical",

  "responses": [
    {
      "engine": "openai",
      "text": "Here are key microservices best practices...",
      "model": "gpt-4o-mini"
    },
    {
      "engine": "anthropic",
      "text": "When designing microservices...",
      "model": "claude-3-5-sonnet-20241022"
    },
    {
      "engine": "gemini",
      "text": "Microservices architecture requires...",
      "model": "gemini-1.5-flash"
    },
    {
      "engine": "perplexity",
      "text": "Based on current industry practices...",
      "citations": ["https://..."]
    }
  ],

  "synthesis": {
    "synthesizedAnswer": "A comprehensive approach to microservices...",
    "consensusPoints": [
      "Service isolation is critical",
      "API-first design approach"
    ],
    "divergentViews": [
      {
        "topic": "Database strategy",
        "positions": {
          "openai": "Database per service",
          "anthropic": "Shared database with clear boundaries"
        }
      }
    ],
    "uniqueInsights": [
      {
        "engine": "perplexity",
        "insight": "Recent 2024 studies show..."
      }
    ],
    "confidence": {
      "level": "High",
      "reasoning": "Strong consensus on core principles"
    }
  },

  "critique": {
    "strengths": ["Comprehensive coverage", "Balanced perspectives"],
    "weaknesses": ["Lacks specific tooling recommendations"],
    "improvedAnswer": "Enhanced synthesis with additional context..."
  },

  "keyDifferences": [
    {
      "engine": "openai",
      "wordCount": 450,
      "formatting": { "bullets": true, "code": false }
    }
  ],

  "extractedUrls": ["https://microservices.io/..."],

  "meta": {
    "enginesQueried": 4,
    "successfulResponses": 4,
    "synthesisEngine": "gemini-1.5-pro",
    "critiqueEngine": "claude-3-5-sonnet",
    "totalTimeMs": 8234
  }
}
```

---

## Free Tier Hosting Options for n8n

### 1. Your Existing GCP VM (Recommended)

You already have n8n running at `http://35.188.141.23:5678`. This is the best option:
- No additional cost
- Full control
- No execution limits
- Already configured

### 2. n8n Cloud Free Tier

- **Limit**: 5 active workflows, 500 executions/month
- **Signup**: https://n8n.io/cloud
- **Best for**: Testing before self-hosting

### 3. Railway Free Tier

```bash
# One-click deploy
railway init
railway up
```

- **Limit**: $5/month credit (covers ~100+ hours)
- **Setup**: https://railway.app/template/n8n

### 4. Render Free Tier

```yaml
# render.yaml
services:
  - type: web
    name: n8n
    env: docker
    dockerfilePath: ./Dockerfile
    plan: free  # Sleeps after 15 min inactivity
```

- **Limit**: Free but sleeps (cold start ~30s)
- **Best for**: Low-traffic/development

### 5. Fly.io Free Tier

```bash
fly launch --image n8nio/n8n
```

- **Limit**: 3 shared-cpu VMs free
- **Best for**: Good balance of free + performance

---

## Extending the Workflow

### Add More LLMs

To add Grok, Llama, Mistral, etc.:

1. Open workflow in n8n editor
2. Duplicate an existing "Query X" HTTP node
3. Update the API endpoint and authentication
4. Connect to the aggregation node
5. Update aggregation code to parse new format

### Add Caching

```javascript
// In "Parse & Classify Query" node, add:

const cacheKey = crypto.createHash('md5').update(query).digest('hex');
const cached = await $getWorkflowStaticData('global').cache?.[cacheKey];

if (cached && Date.now() - cached.timestamp < 3600000) {
  // Return cached response (1 hour TTL)
  return { json: { ...cached.data, fromCache: true } };
}
```

### Add Rate Limiting

Use n8n's built-in "Function" node with static data:

```javascript
const staticData = $getWorkflowStaticData('global');
const clientIP = $json.headers?.['x-forwarded-for'] || 'unknown';
const now = Date.now();

// Initialize rate limit data
staticData.rateLimits = staticData.rateLimits || {};
const clientLimits = staticData.rateLimits[clientIP] || { count: 0, resetAt: now + 60000 };

if (now > clientLimits.resetAt) {
  clientLimits.count = 0;
  clientLimits.resetAt = now + 60000;
}

if (clientLimits.count >= 10) {
  throw new Error('Rate limit exceeded. Try again in 1 minute.');
}

clientLimits.count++;
staticData.rateLimits[clientIP] = clientLimits;
```

---

## Next Steps

1. **Import workflow**: n8n UI → Import → Select `metabot-enhanced-workflow.json`
2. **Configure credentials**: Add API keys for each LLM
3. **Test endpoint**: `curl http://35.188.141.23:5678/webhook/metabot-health`
4. **Update Metabot frontend**: Point to n8n webhook URL
5. **Enable critique mode**: Set `enableCritique: true` for enhanced analysis
