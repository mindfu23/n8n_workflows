# ValueApe + n8n Integration Guide

This workflow provides a complete stock research pipeline for the ValueApe app, replacing the client-side orchestration with server-side n8n workflows.

## Workflow Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUERY PROCESSING                                   │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐                │
│  │   Webhook    │─▶│ Gemini: Classify │─▶│  Is Educational? │               │
│  │  (POST)      │  │  Query Type      │  │                  │               │
│  └──────────────┘  └──────────────────┘  └────────┬─────────┘               │
│                                                    │                         │
│                          ┌────────────────────────┴─────────────────┐       │
│                          ▼                                          ▼       │
│                  [Educational Path]                        [Research Path]  │
│                          │                                          │       │
│                          ▼                                          ▼       │
│              ┌───────────────────┐                   ┌──────────────────┐   │
│              │ Gemini: Explain   │                   │ Gemini: Parse    │   │
│              │ Concept           │                   │ Query Params     │   │
│              └─────────┬─────────┘                   └────────┬─────────┘   │
│                        ▼                                      ▼             │
│              ┌───────────────────┐                   ┌──────────────────┐   │
│              │ Return Answer     │                   │ Yahoo Finance    │   │
│              └───────────────────┘                   │ Fetch Data       │   │
│                                                      └────────┬─────────┘   │
└───────────────────────────────────────────────────────────────┼─────────────┘
                                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCORING ENGINE                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Calculate Composite Scores                         │   │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌───────────┐       │   │
│  │  │  Value  │ │ Momentum │ │ Quality │ │ Growth │ │ Sentiment │       │   │
│  │  │ Signal  │ │  Signal  │ │ Signal  │ │ Signal │ │  Signal   │       │   │
│  │  └────┬────┘ └────┬─────┘ └────┬────┘ └───┬────┘ └─────┬─────┘       │   │
│  │       └───────────┴───────────┬┴──────────┴────────────┘             │   │
│  │                               ▼                                       │   │
│  │                    [Weighted by Objective]                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┬───────────────┘
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SENTIMENT ENRICHMENT (Optional)                       │
│                                                                              │
│  ┌─────────────────────┐    ┌───────────────────────┐                       │
│  │  Include Sentiment? │───▶│ Perplexity: Market    │                       │
│  │                     │    │ News & Sentiment      │                       │
│  └─────────────────────┘    └───────────┬───────────┘                       │
│                                         ▼                                    │
│                              ┌───────────────────────┐                       │
│                              │  Merge with Scores    │                       │
│                              └───────────────────────┘                       │
└─────────────────────────────────────────────────────────────┬───────────────┘
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ANALYSIS GENERATION                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Gemini: Generate Analysis                          │   │
│  │  - Overview of results                                                │   │
│  │  - Top picks with rationale                                           │   │
│  │  - Risk factors                                                       │   │
│  │  - Contrarian considerations                                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                         ▼                                    │
│                              ┌───────────────────────┐                       │
│                              │   Return Response     │                       │
│                              └───────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Scoring System

| Signal | Factors | Weight by Objective |
|--------|---------|---------------------|
| **Value** | P/E ratio, P/B ratio | max_return: 15%, min_risk: 30%, balanced: 20% |
| **Momentum** | Price vs MA50/MA200, 52-week position | max_return: 35%, min_risk: 10%, balanced: 20% |
| **Quality** | ROE, debt/equity, current ratio | max_return: 15%, min_risk: 35%, balanced: 20% |
| **Growth** | Revenue growth, earnings growth | max_return: 25%, min_risk: 10%, balanced: 20% |
| **Sentiment** | News sentiment, market context | max_return: 10%, min_risk: 15%, balanced: 20% |

---

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/valueape-query` | POST | Main stock research endpoint |
| `/webhook/valueape-health` | GET | Health check |

---

## Setup Instructions

### 1. Import Workflow

1. Go to `http://35.188.141.23:5678`
2. Workflows → Import from File
3. Select `valueape-stock-research-workflow.json`

### 2. Configure Credentials

| Credential Name | Type | For Node |
|-----------------|------|----------|
| `gemini-api` | Query Auth (`key`) | Gemini nodes |
| `perplexity-api` | Header Auth (`Authorization: Bearer`) | Perplexity Sentiment |
| `finnhub-api` | Query Auth (`token`) | Finnhub (optional) |

**Note:** Yahoo Finance requires no API key.

### 3. Test Endpoint

```bash
# Health check
curl http://35.188.141.23:5678/webhook/valueape-health

# Screening query
curl -X POST http://35.188.141.23:5678/webhook/valueape-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the best value stocks in the S&P 500?",
    "options": {
      "objective": "balanced",
      "topN": 10,
      "includeSentiment": true
    }
  }'

# Analysis query
curl -X POST http://35.188.141.23:5678/webhook/valueape-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Compare AAPL vs MSFT for long-term growth",
    "options": {
      "objective": "max_return"
    }
  }'

# Educational query
curl -X POST http://35.188.141.23:5678/webhook/valueape-query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the difference between P/E and P/B ratio?"
  }'
```

---

## API Request/Response Format

### Request

```json
{
  "query": "What are the top 5 undervalued tech stocks?",
  "userId": "user_123",
  "options": {
    "universe": "nasdaq100",
    "topN": 5,
    "objective": "balanced",
    "includeSentiment": true,
    "includeSEC": false
  }
}
```

### Request Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `universe` | string | `sp500` | Stock universe: sp500, nasdaq100, dow30 |
| `topN` | number | 10 | Number of results to return |
| `objective` | string | `balanced` | Scoring objective (see below) |
| `includeSentiment` | boolean | true | Include Perplexity sentiment analysis |
| `includeSEC` | boolean | false | Include SEC filing data (future) |

### Objectives

| Objective | Description |
|-----------|-------------|
| `max_return` | Aggressive growth, momentum-weighted |
| `min_risk` | Conservative, quality and value-weighted |
| `sharpe_ratio` | Risk-adjusted returns focus |
| `balanced` | Equal weight across all signals |
| `income` | Dividend and stability focus |

### Response

```json
{
  "success": true,
  "requestId": "valueape_1708456789_abc123",
  "query": "What are the top 5 undervalued tech stocks?",
  "queryType": "screening",
  "objective": "balanced",
  "analysis": "Based on current valuations and fundamentals, here are the top picks...",
  "rankedStocks": [
    {
      "ticker": "INTC",
      "name": "Intel Corporation",
      "price": 42.50,
      "marketCap": 180000000000,
      "pe": 12.5,
      "pb": 1.2,
      "signals": {
        "value": 85,
        "momentum": 45,
        "quality": 70,
        "growth": 55,
        "sentiment": 60
      },
      "compositeScore": 63,
      "sentimentSummary": "Recent restructuring announcements..."
    }
  ],
  "totalAnalyzed": 100,
  "meta": {
    "hasSentiment": true,
    "dataSource": "yahoo-finance",
    "responseTimeMs": 3450,
    "timestamp": "2024-02-20T15:30:00Z"
  }
}
```

---

## Integrating with ValueApe Frontend

### Option 1: Update API Service

```typescript
// src/lib/api/n8n-service.ts

const N8N_URL = 'http://35.188.141.23:5678/webhook/valueape-query';

export interface ValueApeQuery {
  query: string;
  userId?: string;
  options?: {
    universe?: 'sp500' | 'nasdaq100' | 'dow30';
    topN?: number;
    objective?: 'max_return' | 'min_risk' | 'sharpe_ratio' | 'balanced' | 'income';
    includeSentiment?: boolean;
  };
}

export async function queryStocks(request: ValueApeQuery) {
  const response = await fetch(N8N_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`n8n error: ${response.statusText}`);
  }

  return response.json();
}
```

### Option 2: Hybrid - Use n8n for Screening, Keep Gemini Direct for Analysis

```typescript
// src/lib/services/query-router.ts

import { classifyQuery } from './gemini';
import { queryStocks } from './n8n-service';
import { analyzeStocks } from './local-analysis';

export async function routeQuery(query: string, options: QueryOptions) {
  const queryType = await classifyQuery(query);

  if (queryType === 'screening') {
    // Use n8n for multi-step screening pipeline
    return queryStocks({ query, options });
  } else if (queryType === 'analysis') {
    // Keep local for faster single-stock analysis
    return analyzeStocks(query, options);
  } else {
    // Educational queries stay local
    return getEducationalResponse(query);
  }
}
```

### Option 3: Replace Netlify Function

```typescript
// netlify/functions/stock-query.ts

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://35.188.141.23:5678/webhook/valueape-query';

export const handler = async (event: any) => {
  try {
    const body = JSON.parse(event.body);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

---

## Extending the Workflow

### Add SEC Filing Enrichment

To add SEC EDGAR data fetching:

1. Add an HTTP Request node after "Calculate Scores":
```
URL: https://data.sec.gov/submissions/CIK{cik}.json
```

2. Create a Code node to extract risk factors and financial data

3. Merge with scored data before analysis generation

### Add More Data Providers

To add Alpha Vantage, FMP, or Tiingo:

1. Duplicate the Yahoo Finance node
2. Update the URL and query parameters
3. Connect to a "Merge Data Sources" code node
4. Synthesize data from multiple providers

### Add Backtesting

To add historical performance analysis:

1. Add a "Detect Backtest Request" IF node
2. Fetch historical prices from Yahoo Finance
3. Calculate returns, Sharpe ratio, max drawdown
4. Include in response

---

## Cost Estimates

| Service | Cost | Per Query |
|---------|------|-----------|
| Gemini 2.0 Flash | Free tier: 1,500 req/day | ~$0.00 |
| Yahoo Finance | Free | $0.00 |
| Perplexity Sonar | ~$0.005/1K tokens | ~$0.002 |
| n8n (self-hosted) | GCP VM cost | ~$0.0001 |

**Estimated cost per query: ~$0.002** (mostly Perplexity for sentiment)

**Without sentiment: ~$0.00** (all free tier)

---

## Comparison: Current vs n8n Architecture

| Aspect | Current (Client-side) | n8n (Server-side) |
|--------|----------------------|-------------------|
| **API Keys** | Exposed in env vars | Secured in n8n credentials |
| **Rate Limiting** | Per-client | Centralized |
| **Debugging** | Console logs | Visual execution history |
| **Modifications** | Code changes + deploy | Visual editor, instant |
| **Fallback Logic** | Manual implementation | Built-in node options |
| **Cost Tracking** | Custom implementation | n8n execution logs |
| **A/B Testing** | Feature flags | Duplicate workflows |

---

## Troubleshooting

### Yahoo Finance Returns Empty Data

Yahoo Finance occasionally blocks requests. Solutions:
- Add retry logic in n8n (built-in)
- Use Finnhub as fallback
- Add random delays between requests

### Gemini Rate Limits

Free tier is 1,500 req/day. If exceeded:
- Reduce classification calls (cache common queries)
- Use rule-based classification for obvious patterns
- Upgrade to paid tier

### Slow Response Times

Target: <5 seconds. If slower:
- Disable sentiment enrichment for faster results
- Reduce `topN` parameter
- Cache common universe data

---

## Future Enhancements

- [ ] Add HuggingFace FinBERT for deeper sentiment analysis
- [ ] Integrate SEC EDGAR for 10-K/10-Q data
- [ ] Add portfolio backtesting workflow
- [ ] Create scheduled screening workflow (daily alerts)
- [ ] Add Schwab API integration for paper trading
