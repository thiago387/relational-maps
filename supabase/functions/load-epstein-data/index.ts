import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HuggingFaceRow {
  row_idx: number;
  row: {
    messages: string;
    thread_id?: string;
    subject?: string;
  };
}

interface ParsedMessage {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: string;
  subject: string;
  body: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { action, offset = 0, limit = 100 } = await req.json();

    if (action === 'info') {
      // Get dataset info
      console.log('Fetching dataset info...');
      const infoRes = await fetch(
        'https://datasets-server.huggingface.co/info?dataset=notesbymuneeb/epstein-emails'
      );
      const info = await infoRes.json();
      
      const numRows = info?.dataset_info?.default?.splits?.train?.num_examples || 0;
      
      return new Response(
        JSON.stringify({ success: true, totalRows: numRows }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'fetch') {
      console.log(`Fetching rows ${offset} to ${offset + limit}...`);
      
      const url = `https://datasets-server.huggingface.co/rows?dataset=notesbymuneeb/epstein-emails&config=default&split=train&offset=${offset}&length=${limit}`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Hugging Face API error:', errorText);
        throw new Error(`Hugging Face API error: ${res.status}`);
      }
      
      const data = await res.json();
      const rows: HuggingFaceRow[] = data.rows || [];
      
      console.log(`Received ${rows.length} rows from Hugging Face`);
      
      const emails: any[] = [];
      const personEmails = new Set<string>();
      
      for (const row of rows) {
        try {
          // The messages field contains JSON string of messages array
          let messages: ParsedMessage[] = [];
          
          if (typeof row.row.messages === 'string') {
            try {
              messages = JSON.parse(row.row.messages);
            } catch {
              // If it's not valid JSON, try to parse as a single message
              console.log('Could not parse messages JSON, attempting alternative parse');
              continue;
            }
          } else if (Array.isArray(row.row.messages)) {
            messages = row.row.messages;
          }
          
          if (!Array.isArray(messages)) {
            messages = [messages];
          }
          
          for (const msg of messages) {
            if (!msg || !msg.from) continue;
            
            // Extract email from "Name <email@domain.com>" format
            const extractEmail = (str: string): { email: string; name: string | null } => {
              if (!str) return { email: '', name: null };
              const match = str.match(/<([^>]+)>/);
              if (match) {
                const name = str.replace(/<[^>]+>/, '').trim();
                return { email: match[1].toLowerCase().trim(), name: name || null };
              }
              return { email: str.toLowerCase().trim(), name: null };
            };
            
            const from = extractEmail(msg.from);
            if (!from.email || !from.email.includes('@')) continue;
            
            personEmails.add(from.email);
            
            const toEmails: string[] = [];
            const toNames: string[] = [];
            
            const toList = Array.isArray(msg.to) ? msg.to : [msg.to].filter(Boolean);
            for (const t of toList) {
              const to = extractEmail(t);
              if (to.email && to.email.includes('@')) {
                toEmails.push(to.email);
                toNames.push(to.name || '');
                personEmails.add(to.email);
              }
            }
            
            if (toEmails.length === 0) continue;
            
            // Parse CC
            const ccEmails: string[] = [];
            if (msg.cc) {
              const ccList = Array.isArray(msg.cc) ? msg.cc : [msg.cc];
              for (const c of ccList) {
                const cc = extractEmail(c);
                if (cc.email && cc.email.includes('@')) {
                  ccEmails.push(cc.email);
                  personEmails.add(cc.email);
                }
              }
            }
            
            // Parse BCC
            const bccEmails: string[] = [];
            if (msg.bcc) {
              const bccList = Array.isArray(msg.bcc) ? msg.bcc : [msg.bcc];
              for (const b of bccList) {
                const bcc = extractEmail(b);
                if (bcc.email && bcc.email.includes('@')) {
                  bccEmails.push(bcc.email);
                  personEmails.add(bcc.email);
                }
              }
            }
            
            // Parse date
            let parsedDate: string | null = null;
            if (msg.date) {
              try {
                const d = new Date(msg.date);
                if (!isNaN(d.getTime())) {
                  parsedDate = d.toISOString();
                }
              } catch {
                // Invalid date, leave as null
              }
            }
            
            // Create unique message ID
            const messageId = `hf-${row.row_idx}-${emails.length}`;
            
            emails.push({
              message_id: messageId,
              from_email: from.email,
              from_name: from.name,
              to_emails: toEmails,
              to_names: toNames.filter(n => n),
              cc_emails: ccEmails.length > 0 ? ccEmails : null,
              bcc_emails: bccEmails.length > 0 ? bccEmails : null,
              subject: msg.subject || row.row.subject || null,
              body: msg.body || null,
              date: parsedDate,
              is_analyzed: false,
            });
          }
        } catch (err) {
          console.error('Error parsing row:', err);
        }
      }
      
      console.log(`Parsed ${emails.length} emails from ${rows.length} rows`);
      
      // Insert persons first
      const personsToInsert = Array.from(personEmails).map(email => ({
        email,
        email_count_sent: 0,
        email_count_received: 0,
      }));
      
      if (personsToInsert.length > 0) {
        const { error: personError } = await supabase
          .from('persons')
          .upsert(personsToInsert, { onConflict: 'email', ignoreDuplicates: true });
        
        if (personError) {
          console.error('Error inserting persons:', personError);
        }
      }
      
      // Insert emails in batches to avoid timeout
      let inserted = 0;
      const batchSize = 100;
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('emails')
          .upsert(batch, { onConflict: 'message_id', ignoreDuplicates: true });
        
        if (insertError) {
          console.error('Error inserting emails batch:', insertError);
        } else {
          inserted += batch.length;
        }
      }
      
      console.log(`Inserted ${inserted} emails and ${personsToInsert.length} persons`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          inserted,
          personsCreated: personsToInsert.length,
          rowsFetched: rows.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
