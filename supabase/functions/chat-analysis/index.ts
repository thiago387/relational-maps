import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { message, conversation_id } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const db = createClient(supabaseUrl, serviceRoleKey);

    // Create or use conversation
    let convoId = conversation_id;
    if (!convoId) {
      const { data: convo, error: convoErr } = await db.from("chat_conversations").insert({ user_id: userId, title: message.slice(0, 60) }).select("id").single();
      if (convoErr) throw convoErr;
      convoId = convo.id;
    }

    // Save user message
    await db.from("chat_messages").insert({ conversation_id: convoId, role: "user", content: message });

    // Load conversation history (last 20)
    const { data: history } = await db.from("chat_messages").select("role, content").eq("conversation_id", convoId).order("created_at", { ascending: true }).limit(20);

    // ─── STAGE 1: ORCHESTRATOR (Flash) ───
    const orchestratorMessages = [
      {
        role: "system",
        content: `You are an orchestrator for an email network analysis chatbot. Analyze the user's question and decide:
1. What type of data queries are needed
2. How deep the response should be

Call the plan_response function with your analysis. Always include "general" in intents for baseline context.`
      },
      { role: "user", content: message }
    ];

    const orchestratorResp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: orchestratorMessages,
        tools: [{
          type: "function",
          function: {
            name: "plan_response",
            description: "Plan what data to fetch and how deep the analysis should be.",
            parameters: {
              type: "object",
              properties: {
                depth: { type: "string", enum: ["brief", "detailed", "deep-dive"], description: "How thorough the answer should be" },
                intents: {
                  type: "array",
                  items: { type: "string", enum: ["content_search", "sentiment_analysis", "graph_search", "general"] },
                  description: "Which data queries to run"
                },
                search_terms: { type: "array", items: { type: "string" }, description: "Names, topics, or keywords to search for" },
                time_focus: {
                  type: "object",
                  properties: { year_min: { type: "integer" }, year_max: { type: "integer" } },
                  description: "Optional year range to narrow queries"
                }
              },
              required: ["depth", "intents", "search_terms"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "plan_response" } }
      })
    });

    if (!orchestratorResp.ok) {
      const errStatus = orchestratorResp.status;
      if (errStatus === 429 || errStatus === 402) {
        return new Response(JSON.stringify({ error: errStatus === 429 ? "Rate limited" : "Payment required" }), { status: errStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("Orchestrator error:", errStatus, await orchestratorResp.text());
      throw new Error("Orchestrator failed");
    }

    const orchestratorData = await orchestratorResp.json();
    let plan = { depth: "detailed", intents: ["general"], search_terms: [] as string[], time_focus: null as any };

    try {
      const toolCall = orchestratorData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        plan = JSON.parse(toolCall.function.arguments);
      }
    } catch { /* use defaults */ }

    console.log("Orchestrator plan:", JSON.stringify(plan));

    // ─── STAGE 2: DYNAMIC DATA FETCHING ───
    const dataContextParts: string[] = [];

    // Always fetch general stats
    if (plan.intents.includes("general")) {
      const [personsRes, edgesRes, emailsRes, topPersonsRes, topTopicsRes] = await Promise.all([
        db.from("persons").select("id", { count: "exact", head: true }),
        db.from("edges").select("id", { count: "exact", head: true }),
        db.from("emails").select("id", { count: "exact", head: true }),
        db.from("persons").select("name, email_count_sent, email_count_received, community_id, avg_sentiment").order("email_count_sent", { ascending: false }).limit(15),
        db.from("emails").select("topics").not("topics", "is", null).limit(200),
      ]);

      const topicCounts: Record<string, number> = {};
      topTopicsRes.data?.forEach((e: any) => {
        (e.topics || []).forEach((t: string) => { topicCounts[t] = (topicCounts[t] || 0) + 1; });
      });
      const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t, c]) => `${t} (${c})`);

      const communityMap: Record<number, number> = {};
      topPersonsRes.data?.forEach((p: any) => {
        if (p.community_id != null) communityMap[p.community_id] = (communityMap[p.community_id] || 0) + 1;
      });

      dataContextParts.push(`DATASET OVERVIEW:
- Total persons: ${personsRes.count ?? 0}
- Total edges/connections: ${edgesRes.count ?? 0}
- Total emails: ${emailsRes.count ?? 0}

TOP PERSONS (by emails sent):
${topPersonsRes.data?.map((p: any) => `- ${p.name || 'Unknown'}: sent=${p.email_count_sent}, received=${p.email_count_received}, sentiment=${p.avg_sentiment ?? 'N/A'}, community=${p.community_id ?? 'N/A'}`).join('\n') || 'No data'}

TOP TOPICS: ${topTopics.join(', ') || 'No topics'}

COMMUNITIES: ${Object.entries(communityMap).map(([id, count]) => `Community ${id}: ${count} top members`).join(', ') || 'No community data'}`);
    }

    // Content search
    if (plan.intents.includes("content_search") && plan.search_terms.length > 0) {
      const termConditions = plan.search_terms.map(t => `subject.ilike.%${t}%,body.ilike.%${t}%,from_name.ilike.%${t}%,from_email.ilike.%${t}%`);
      let query = db.from("emails").select("from_name, from_email, to_names, subject, date, polarity, topics, sentiment_category");

      // Build OR filter for all terms
      const orParts = plan.search_terms.flatMap(t => [
        `subject.ilike.%${t}%`,
        `body.ilike.%${t}%`,
        `from_name.ilike.%${t}%`,
        `from_email.ilike.%${t}%`
      ]);
      query = query.or(orParts.join(','));

      if (plan.time_focus?.year_min) query = query.gte("year", plan.time_focus.year_min);
      if (plan.time_focus?.year_max) query = query.lte("year", plan.time_focus.year_max);

      const { data: emailResults } = await query.order("date", { ascending: false }).limit(30);

      if (emailResults && emailResults.length > 0) {
        dataContextParts.push(`CONTENT SEARCH RESULTS (${emailResults.length} emails matching "${plan.search_terms.join(', ')}"):
${emailResults.map((e: any) => `- [${e.date?.slice(0, 10) || '?'}] From: ${e.from_name || e.from_email} | To: ${(e.to_names || []).join(', ')} | Subject: "${e.subject || 'N/A'}" | Polarity: ${e.polarity ?? 'N/A'} | Topics: ${(e.topics || []).join(', ')}`).join('\n')}`);
      } else {
        dataContextParts.push(`CONTENT SEARCH: No emails found matching "${plan.search_terms.join(', ')}".`);
      }
    }

    // Sentiment analysis
    if (plan.intents.includes("sentiment_analysis") && plan.search_terms.length > 0) {
      // Sentiment by person
      const personTerms = plan.search_terms;
      const personOrParts = personTerms.flatMap(t => [`name.ilike.%${t}%`, `email.ilike.%${t}%`]);
      const { data: personSentiment } = await db.from("persons")
        .select("name, email, avg_sentiment, email_count_sent, email_count_received, community_id")
        .or(personOrParts.join(','))
        .limit(10);

      if (personSentiment && personSentiment.length > 0) {
        dataContextParts.push(`SENTIMENT BY PERSON (matching "${personTerms.join(', ')}"):
${personSentiment.map((p: any) => `- ${p.name || p.email}: avg_sentiment=${p.avg_sentiment ?? 'N/A'}, sent=${p.email_count_sent}, received=${p.email_count_received}, community=${p.community_id ?? 'N/A'}`).join('\n')}`);
      }

      // Sentiment by topic
      const topicOrParts = personTerms.map(t => `subject.ilike.%${t}%,body.ilike.%${t}%`);
      const { data: topicEmails } = await db.from("emails")
        .select("polarity, sentiment_category, topics")
        .or(personTerms.flatMap(t => [`subject.ilike.%${t}%`, `body.ilike.%${t}%`]).join(','))
        .not("polarity", "is", null)
        .limit(200);

      if (topicEmails && topicEmails.length > 0) {
        const avgPol = topicEmails.reduce((s, e: any) => s + (e.polarity || 0), 0) / topicEmails.length;
        const positive = topicEmails.filter((e: any) => (e.polarity || 0) > 0.1).length;
        const negative = topicEmails.filter((e: any) => (e.polarity || 0) < -0.1).length;
        const neutral = topicEmails.length - positive - negative;

        dataContextParts.push(`SENTIMENT DISTRIBUTION (${topicEmails.length} emails):
- Average polarity: ${avgPol.toFixed(3)}
- Positive (>0.1): ${positive} (${(positive / topicEmails.length * 100).toFixed(1)}%)
- Negative (<-0.1): ${negative} (${(negative / topicEmails.length * 100).toFixed(1)}%)
- Neutral: ${neutral} (${(neutral / topicEmails.length * 100).toFixed(1)}%)`);
      }
    }

    // Graph search
    if (plan.intents.includes("graph_search") && plan.search_terms.length > 0) {
      // Find persons matching search terms
      const personOrParts = plan.search_terms.flatMap(t => [`name.ilike.%${t}%`, `email.ilike.%${t}%`]);
      const { data: matchedPersons } = await db.from("persons")
        .select("id, name, email, community_id, email_count_sent, email_count_received, avg_sentiment")
        .or(personOrParts.join(','))
        .limit(5);

      if (matchedPersons && matchedPersons.length > 0) {
        for (const person of matchedPersons) {
          // Outgoing connections
          const { data: outEdges } = await db.from("edges")
            .select("recipient_id, message_count, avg_polarity, edge_sentiment")
            .eq("sender_id", person.email)
            .order("message_count", { ascending: false })
            .limit(15);

          // Incoming connections
          const { data: inEdges } = await db.from("edges")
            .select("sender_id, message_count, avg_polarity, edge_sentiment")
            .eq("recipient_id", person.email)
            .order("message_count", { ascending: false })
            .limit(15);

          // Resolve names for connected persons
          const connectedEmails = [
            ...(outEdges || []).map((e: any) => e.recipient_id),
            ...(inEdges || []).map((e: any) => e.sender_id)
          ];
          const uniqueEmails = [...new Set(connectedEmails)];
          const { data: connectedPersons } = await db.from("persons")
            .select("email, name, community_id")
            .in("email", uniqueEmails.slice(0, 30));

          const nameMap = new Map<string, string>();
          connectedPersons?.forEach((p: any) => nameMap.set(p.email, p.name || p.email));

          dataContextParts.push(`GRAPH: ${person.name || person.email} (community ${person.community_id ?? 'N/A'}, sent=${person.email_count_sent}, received=${person.email_count_received}, avg_sentiment=${person.avg_sentiment ?? 'N/A'}):

Top outgoing connections:
${(outEdges || []).map((e: any) => `  → ${nameMap.get(e.recipient_id) || e.recipient_id}: ${e.message_count} msgs, polarity=${e.avg_polarity ?? 'N/A'}, sentiment=${e.edge_sentiment || 'N/A'}`).join('\n') || '  None found'}

Top incoming connections:
${(inEdges || []).map((e: any) => `  ← ${nameMap.get(e.sender_id) || e.sender_id}: ${e.message_count} msgs, polarity=${e.avg_polarity ?? 'N/A'}, sentiment=${e.edge_sentiment || 'N/A'}`).join('\n') || '  None found'}`);
        }
      } else {
        dataContextParts.push(`GRAPH SEARCH: No persons found matching "${plan.search_terms.join(', ')}".`);
      }
    }

    const fullDataContext = dataContextParts.join('\n\n---\n\n');

    // ─── STAGE 3: ANALYST (Pro, streaming) ───
    const depthInstruction = {
      brief: "Keep your analysis concise: 2-3 focused paragraphs plus key takeaways.",
      detailed: "Provide a thorough analysis with specific data citations and evidence from the provided context.",
      "deep-dive": "Deliver an exhaustive, multi-section analysis examining every angle. Use all available evidence, cross-reference data points, and provide nuanced interpretation."
    }[plan.depth] || "Provide a thorough analysis.";

    const analystSystemPrompt = `You are an expert investigative analyst examining the Epstein email communication network. You have access to rich dataset context below.

${fullDataContext}

INSTRUCTIONS:
- ${depthInstruction}
- Be specific and cite data points (names, numbers, dates) from the provided context.
- When data is insufficient, clearly state what is and isn't available.
- Format responses with markdown: **bold** for emphasis, headers for sections, bullet lists for structured data.

RESPONSE FORMAT (MANDATORY):
1. Provide your complete analysis answering the user's question.
2. End EVERY response with a final section:

## Key Takeaways
- 3-5 concise bullet points summarizing the most important findings from your analysis.`;

    const aiMessages = [
      { role: "system", content: analystSystemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const aiResponse = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-pro-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("Analyst error:", aiResponse.status, await aiResponse.text());
      throw new Error("Analyst failed");
    }

    // Stream response
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      let fullResponse = "";
      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          await writer.write(encoder.encode(chunk));

          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullResponse += content;
            } catch { /* partial */ }
          }
        }

        if (fullResponse) {
          await db.from("chat_messages").insert({ conversation_id: convoId, role: "assistant", content: fullResponse });
          if (!conversation_id) {
            await db.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convoId);
          }
        }
      } catch (e) {
        console.error("Stream error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "x-conversation-id": convoId },
    });
  } catch (e) {
    console.error("chat-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
