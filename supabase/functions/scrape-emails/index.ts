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
    // Parse body only once
    const body = await req.json();
    const { sourceUrl, action, emails } = body;
    
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (action === 'discover') {
      if (!firecrawlApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Mapping URL:', sourceUrl);
      
      const mapResponse = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: sourceUrl,
          limit: 100,
          includeSubdomains: false,
        }),
      });

      const mapData = await mapResponse.json();
      
      if (!mapResponse.ok) {
        console.error('Firecrawl map error:', mapData);
        return new Response(
          JSON.stringify({ success: false, error: mapData.error || 'Failed to map URL' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, links: mapData.links || [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'scrape') {
      if (!firecrawlApiKey) {
        return new Response(
          JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('Scraping URL:', sourceUrl);
      
      const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: sourceUrl,
          formats: ['markdown', 'html'],
          onlyMainContent: false,
        }),
      });

      const scrapeData = await scrapeResponse.json();
      
      if (!scrapeResponse.ok) {
        console.error('Firecrawl scrape error:', scrapeData);
        return new Response(
          JSON.stringify({ success: false, error: scrapeData.error || 'Failed to scrape URL' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          markdown: scrapeData.data?.markdown,
          html: scrapeData.data?.html,
          metadata: scrapeData.data?.metadata 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'parse') {
      if (!emails || !Array.isArray(emails)) {
        return new Response(
          JSON.stringify({ success: false, error: 'No emails provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Parsing', emails.length, 'emails');

      // Create a processing job
      const { data: job, error: jobError } = await supabase
        .from('processing_jobs')
        .insert({
          job_type: 'import',
          status: 'processing',
          total_items: emails.length,
          processed_items: 0,
        })
        .select()
        .single();

      if (jobError) {
        console.error('Job creation error:', jobError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create job' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert emails in batches
      const batchSize = 100;
      let processed = 0;
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('emails')
          .upsert(batch, { onConflict: 'message_id', ignoreDuplicates: true });
        
        if (insertError) {
          console.error('Batch insert error:', insertError);
        }
        
        processed += batch.length;
        
        // Update job progress
        await supabase
          .from('processing_jobs')
          .update({ processed_items: processed })
          .eq('id', job.id);
      }

      // Mark job complete
      await supabase
        .from('processing_jobs')
        .update({ status: 'completed', processed_items: processed })
        .eq('id', job.id);

      // Extract and upsert persons
      const personEmails = new Set<string>();
      emails.forEach((email: any) => {
        if (email.from_email) personEmails.add(email.from_email.toLowerCase());
        (email.to_emails || []).forEach((e: string) => personEmails.add(e.toLowerCase()));
        (email.cc_emails || []).forEach((e: string) => personEmails.add(e.toLowerCase()));
      });

      const personsToInsert = Array.from(personEmails).map(email => ({
        email,
        name: email.split('@')[0],
      }));

      if (personsToInsert.length > 0) {
        await supabase
          .from('persons')
          .upsert(personsToInsert, { onConflict: 'email', ignoreDuplicates: true });
      }

      console.log('Import complete:', processed, 'emails,', personsToInsert.length, 'persons');

      return new Response(
        JSON.stringify({ success: true, jobId: job.id, processed }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scrape-emails:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
