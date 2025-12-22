import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { batchSize = 10, jobId } = await req.json();
    
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get unanalyzed emails
    const { data: emails, error: fetchError } = await supabase
      .from('emails')
      .select('id, from_email, to_emails, subject, body, date')
      .eq('is_analyzed', false)
      .limit(batchSize);

    if (fetchError) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch emails' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, remaining: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get total unanalyzed count
    const { count: totalRemaining } = await supabase
      .from('emails')
      .select('*', { count: 'exact', head: true })
      .eq('is_analyzed', false);

    console.log(`Processing ${emails.length} emails, ${totalRemaining} remaining`);

    // Analyze each email with AI
    const results = [];
    for (const email of emails) {
      try {
        const emailContent = `
Subject: ${email.subject || 'No subject'}
From: ${email.from_email}
To: ${(email.to_emails || []).join(', ')}
Date: ${email.date || 'Unknown'}

${email.body || 'No content'}
        `.trim().substring(0, 2000); // Limit content size

        const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are an email sentiment analyzer. Analyze the following email and return a JSON object with:
- sentiment_score: a number from -1.0 (very negative) to 1.0 (very positive)
- sentiment_category: one of "hostile", "negative", "neutral", "positive", "friendly"
- emotional_markers: array of relevant emotional markers like "urgent", "anxious", "professional", "casual", "threatening", "friendly", "frustrated", "excited"
- topics: array of 1-3 main topics discussed in the email

Return ONLY the JSON object, no other text.`
              },
              {
                role: 'user',
                content: emailContent
              }
            ],
          }),
        });

        if (response.ok) {
          const aiData = await response.json();
          const content = aiData.choices?.[0]?.message?.content || '{}';
          
          // Parse the JSON response
          let analysis;
          try {
            // Clean up the response - remove markdown code blocks if present
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            analysis = JSON.parse(cleanContent);
          } catch (parseError) {
            console.error('Failed to parse AI response:', content);
            analysis = {
              sentiment_score: 0,
              sentiment_category: 'neutral',
              emotional_markers: [],
              topics: []
            };
          }

          // Update email with analysis
          const { error: updateError } = await supabase
            .from('emails')
            .update({
              sentiment_score: Math.max(-1, Math.min(1, analysis.sentiment_score || 0)),
              sentiment_category: analysis.sentiment_category || 'neutral',
              emotional_markers: analysis.emotional_markers || [],
              topics: analysis.topics || [],
              is_analyzed: true,
            })
            .eq('id', email.id);

          if (updateError) {
            console.error('Update error for email:', email.id, updateError);
          } else {
            results.push({ id: email.id, success: true });
          }
        } else {
          const errorText = await response.text();
          console.error('AI API error:', response.status, errorText);
          
          if (response.status === 429) {
            return new Response(
              JSON.stringify({ success: false, error: 'Rate limit exceeded. Please wait and try again.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          
          results.push({ id: email.id, success: false, error: 'AI API error' });
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (emailError) {
        console.error('Error processing email:', email.id, emailError);
        results.push({ id: email.id, success: false, error: emailError instanceof Error ? emailError.message : 'Unknown error' });
      }
    }

    // Update job progress if provided
    if (jobId) {
      const successCount = results.filter(r => r.success).length;
      const { data: currentJob } = await supabase
        .from('processing_jobs')
        .select('processed_items')
        .eq('id', jobId)
        .single();
      
      if (currentJob) {
        await supabase
          .from('processing_jobs')
          .update({
            processed_items: (currentJob.processed_items || 0) + successCount,
          })
          .eq('id', jobId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        remaining: (totalRemaining || 0) - emails.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-sentiment:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
