

## Upgrade the Chatbot: Orchestrator, Deeper Analysis, and Structured Responses

### Overview

Transform the current single-prompt chatbot into a two-stage orchestrated pipeline that dynamically adjusts depth, always provides structured answers (full analysis + key takeaways), and can query the database for content, sentiment, and graph-level analysis.

---

### Architecture

The current edge function sends a single prompt to `gemini-3-flash-preview` with a static data summary. The new design introduces:

1. **Stage 1 -- Orchestrator** (fast, cheap call to `gemini-3-flash-preview`): Classifies the user's question and decides what data to fetch and how deep the answer should be.
2. **Stage 2 -- Analyst** (deep call to `gemini-3-pro-preview`): Receives the enriched data context and produces the final structured response.

```text
User question
    |
    v
[Orchestrator - gemini-3-flash-preview]
  - Classifies intent (content, sentiment, graph, general)
  - Decides depth: "brief" | "detailed" | "deep-dive"
  - Lists which DB queries to run
    |
    v
[Dynamic Data Fetcher]
  - Runs targeted queries based on orchestrator output
  - Content search: full-text match on emails.subject/body
  - Sentiment analysis: aggregate polarity by person/topic/time
  - Graph search: find connections, shortest paths, community members
    |
    v
[Analyst - gemini-3-pro-preview]
  - Receives enriched context + depth instruction
  - Always outputs: Full Analysis + Key Takeaways summary
```

---

### Changes

#### 1. Edge Function: `supabase/functions/chat-analysis/index.ts` (full rewrite)

**Orchestrator call (non-streaming):**
- Send user message + conversation summary to `gemini-3-flash-preview` with tool calling
- Define a tool `plan_response` with parameters:
  - `depth`: "brief" | "detailed" | "deep-dive"
  - `intents`: array of `"content_search"` | `"sentiment_analysis"` | `"graph_search"` | `"general"`
  - `search_terms`: string array (names, topics, keywords to query)
  - `time_focus`: optional year/month range to narrow queries

**Dynamic data fetching based on orchestrator output:**
- `content_search`: Query `emails` table filtering by `subject`/`body` ILIKE on search terms, return top 20 matching emails with sender, recipient, date, subject, polarity
- `sentiment_analysis`: Query `emails` joined with `persons` to compute avg polarity by person or topic for the specified search terms; also pull sentiment distribution (positive/negative/neutral counts)
- `graph_search`: Query `edges` + `persons` to find direct connections of named persons, their communities, top collaborators, message counts, and avg sentiment per relationship
- `general`: Use the existing summary stats (total counts, top persons, top topics, communities)

**Analyst call (streaming):**
- Switch model to `google/gemini-3-pro-preview`
- Build an enriched system prompt with:
  - The fetched data context (much richer than before)
  - Depth instruction from orchestrator
  - Mandatory output format: always end with a `## Key Takeaways` section containing 3-5 bullet points summarizing the answer
- Stream this response back to the client (same SSE pattern as current)

**Response format instruction in system prompt:**
```
Always structure your response as follows:
1. A complete, thorough analysis section answering the user's question
2. A final section titled "## Key Takeaways" with 3-5 concise bullet points summarizing the most important findings

Adjust the depth of your analysis:
- Brief: 2-3 paragraphs + takeaways
- Detailed: full analysis with data citations + takeaways  
- Deep-dive: exhaustive multi-section analysis with all available evidence + takeaways
```

#### 2. Frontend: `src/components/dashboard/ChatPanel.tsx`

- Render assistant messages with basic markdown support (bold, headers, lists) using simple regex replacements or a lightweight renderer
- No other structural changes needed -- the streaming pipeline stays the same

---

### Data Query Examples

**Content search** (when user asks "What did Ghislaine talk about?"):
```sql
SELECT from_name, to_names, subject, date, polarity, topics
FROM emails
WHERE (from_name ILIKE '%ghislaine%' OR from_email ILIKE '%ghislaine%')
ORDER BY date DESC LIMIT 30
```

**Sentiment analysis** (when user asks "What's the sentiment around legal topics?"):
```sql
SELECT avg(polarity), count(*),
  count(CASE WHEN polarity > 0.1 THEN 1 END) as positive,
  count(CASE WHEN polarity < -0.1 THEN 1 END) as negative
FROM emails
WHERE 'Legal Counsel & Strategy' = ANY(topics)
```

**Graph search** (when user asks "Who are Epstein's closest contacts?"):
```sql
SELECT p.name, e.message_count, e.avg_polarity, e.edge_sentiment
FROM edges e
JOIN persons p ON p.email = e.recipient_id
WHERE e.sender_id IN (SELECT email FROM persons WHERE name ILIKE '%epstein%')
ORDER BY e.message_count DESC LIMIT 15
```

These will be implemented as Supabase client queries (not raw SQL) inside the edge function.

---

### Technical Summary

| Item | Detail |
|------|--------|
| Files modified | `supabase/functions/chat-analysis/index.ts`, `src/components/dashboard/ChatPanel.tsx` |
| Model change | Flash (orchestrator) + Pro (analyst) replacing single Flash call |
| New capabilities | Content search, sentiment queries, graph relationship queries |
| Output format | Always: full analysis + Key Takeaways section |
| DB schema changes | None |
| New dependencies | None |

