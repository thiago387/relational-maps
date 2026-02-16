import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Use service role for DB operations
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

    // Build data context
    const [personsRes, edgesRes, emailsRes, topPersonsRes, topTopicsRes] = await Promise.all([
      db.from("persons").select("id", { count: "exact", head: true }),
      db.from("edges").select("id", { count: "exact", head: true }),
      db.from("emails").select("id", { count: "exact", head: true }),
      db.from("persons").select("name, email_count_sent, email_count_received, community_id, avg_sentiment").order("email_count_sent", { ascending: false }).limit(15),
      db.from("emails").select("topics").not("topics", "is", null).limit(200),
    ]);

    // Aggregate topics
    const topicCounts: Record<string, number> = {};
    topTopicsRes.data?.forEach((e: any) => {
      (e.topics || []).forEach((t: string) => {
        topicCounts[t] = (topicCounts[t] || 0) + 1;
      });
    });
    const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t, c]) => `${t} (${c})`);

    // Community summary
    const communityMap: Record<number, number> = {};
    topPersonsRes.data?.forEach((p: any) => {
      if (p.community_id != null) communityMap[p.community_id] = (communityMap[p.community_id] || 0) + 1;
    });

    const dataContext = `
DATASET SUMMARY:
- Total persons: ${personsRes.count ?? 0}
- Total edges: ${edgesRes.count ?? 0}
- Total emails: ${emailsRes.count ?? 0}

TOP PERSONS (by emails sent):
${topPersonsRes.data?.map((p: any) => `- ${p.name || 'Unknown'}: sent=${p.email_count_sent}, received=${p.email_count_received}, sentiment=${p.avg_sentiment ?? 'N/A'}, community=${p.community_id ?? 'N/A'}`).join('\n') || 'No data'}

TOP TOPICS:
${topTopics.join(', ') || 'No topics'}

COMMUNITIES: ${Object.entries(communityMap).map(([id, count]) => `Community ${id}: ${count} members`).join(', ') || 'No community data'}
`.trim();

    const systemPrompt = `You are an expert network analyst examining the Epstein email communication network. You have access to the following dataset summary:

${dataContext}

Instructions:
- Answer questions about communication patterns, key players, sentiment trends, community structures, and relationships.
- Be specific and cite data points from the provided context.
- When you don't have enough data to answer definitively, say so.
- Format responses with markdown for readability (bold, lists, headers).
- Keep answers focused and analytical.`;

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...(history || []).map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Call Lovable AI gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await aiResponse.text();
      console.error("AI error:", aiResponse.status, t);
      throw new Error("AI gateway error");
    }

    // Stream response and collect full text
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process in background
    (async () => {
      let fullResponse = "";
      const reader = aiResponse.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          await writer.write(encoder.encode(chunk));

          // Extract content for saving
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

        // Save assistant message
        if (fullResponse) {
          await db.from("chat_messages").insert({ conversation_id: convoId, role: "assistant", content: fullResponse });
          // Update conversation title if it was the first exchange
          if (!conversation_id) {
            await db.from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convoId);
          }
        }
      } catch (e) {
        console.error("Stream processing error:", e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "x-conversation-id": convoId,
      },
    });
  } catch (e) {
    console.error("chat-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
