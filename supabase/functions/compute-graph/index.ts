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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Computing graph relationships...');

    // Get all persons
    const { data: persons, error: personsError } = await supabase
      .from('persons')
      .select('id, email');

    if (personsError) {
      console.error('Persons fetch error:', personsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch persons' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create email to person ID mapping
    const emailToPersonId = new Map<string, string>();
    persons?.forEach(p => emailToPersonId.set(p.email.toLowerCase(), p.id));

    // Get all analyzed emails
    const { data: emails, error: emailsError } = await supabase
      .from('emails')
      .select('from_email, to_emails, cc_emails, date, sentiment_score')
      .eq('is_analyzed', true);

    if (emailsError) {
      console.error('Emails fetch error:', emailsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch emails' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No analyzed emails found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${emails.length} emails for relationships`);

    // Build relationship map
    const relationshipMap = new Map<string, {
      person_a_id: string;
      person_b_id: string;
      emails_a_to_b: number;
      emails_b_to_a: number;
      sentiments_a_to_b: number[];
      sentiments_b_to_a: number[];
      first_contact: Date | null;
      last_contact: Date | null;
    }>();

    for (const email of emails) {
      const fromEmail = email.from_email?.toLowerCase();
      const fromPersonId = emailToPersonId.get(fromEmail);
      
      if (!fromPersonId) continue;

      const recipients = [
        ...(email.to_emails || []),
        ...(email.cc_emails || [])
      ];

      for (const toEmail of recipients) {
        const toPersonId = emailToPersonId.get(toEmail.toLowerCase());
        if (!toPersonId || toPersonId === fromPersonId) continue;

        // Create a consistent key (alphabetically ordered)
        const [personA, personB] = [fromPersonId, toPersonId].sort();
        const key = `${personA}:${personB}`;

        if (!relationshipMap.has(key)) {
          relationshipMap.set(key, {
            person_a_id: personA,
            person_b_id: personB,
            emails_a_to_b: 0,
            emails_b_to_a: 0,
            sentiments_a_to_b: [],
            sentiments_b_to_a: [],
            first_contact: null,
            last_contact: null,
          });
        }

        const rel = relationshipMap.get(key)!;
        const emailDate = email.date ? new Date(email.date) : null;

        // Track directionality
        if (fromPersonId === personA) {
          rel.emails_a_to_b++;
          if (email.sentiment_score !== null) {
            rel.sentiments_a_to_b.push(email.sentiment_score);
          }
        } else {
          rel.emails_b_to_a++;
          if (email.sentiment_score !== null) {
            rel.sentiments_b_to_a.push(email.sentiment_score);
          }
        }

        // Track time range
        if (emailDate) {
          if (!rel.first_contact || emailDate < rel.first_contact) {
            rel.first_contact = emailDate;
          }
          if (!rel.last_contact || emailDate > rel.last_contact) {
            rel.last_contact = emailDate;
          }
        }
      }
    }

    console.log(`Found ${relationshipMap.size} unique relationships`);

    // Clear existing relationships
    await supabase.from('relationships').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Insert relationships in batches
    const relationships = Array.from(relationshipMap.values()).map(rel => ({
      person_a_id: rel.person_a_id,
      person_b_id: rel.person_b_id,
      emails_a_to_b: rel.emails_a_to_b,
      emails_b_to_a: rel.emails_b_to_a,
      sentiment_a_to_b: rel.sentiments_a_to_b.length > 0
        ? rel.sentiments_a_to_b.reduce((a, b) => a + b, 0) / rel.sentiments_a_to_b.length
        : null,
      sentiment_b_to_a: rel.sentiments_b_to_a.length > 0
        ? rel.sentiments_b_to_a.reduce((a, b) => a + b, 0) / rel.sentiments_b_to_a.length
        : null,
      first_contact: rel.first_contact?.toISOString() || null,
      last_contact: rel.last_contact?.toISOString() || null,
    }));

    const batchSize = 100;
    for (let i = 0; i < relationships.length; i += batchSize) {
      const batch = relationships.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('relationships')
        .insert(batch);

      if (insertError) {
        console.error('Relationship insert error:', insertError);
      }
    }

    // Update person stats
    const personStats = new Map<string, { sent: number; received: number; sentiments: number[] }>();

    for (const email of emails) {
      const fromEmail = email.from_email?.toLowerCase();
      const fromPersonId = emailToPersonId.get(fromEmail);
      
      if (fromPersonId) {
        if (!personStats.has(fromPersonId)) {
          personStats.set(fromPersonId, { sent: 0, received: 0, sentiments: [] });
        }
        personStats.get(fromPersonId)!.sent++;
        if (email.sentiment_score !== null) {
          personStats.get(fromPersonId)!.sentiments.push(email.sentiment_score);
        }
      }

      const recipients = [...(email.to_emails || []), ...(email.cc_emails || [])];
      for (const toEmail of recipients) {
        const toPersonId = emailToPersonId.get(toEmail.toLowerCase());
        if (toPersonId) {
          if (!personStats.has(toPersonId)) {
            personStats.set(toPersonId, { sent: 0, received: 0, sentiments: [] });
          }
          personStats.get(toPersonId)!.received++;
        }
      }
    }

    // Update person records
    for (const [personId, stats] of personStats) {
      const avgSentiment = stats.sentiments.length > 0
        ? stats.sentiments.reduce((a, b) => a + b, 0) / stats.sentiments.length
        : null;

      await supabase
        .from('persons')
        .update({
          email_count_sent: stats.sent,
          email_count_received: stats.received,
          avg_sentiment: avgSentiment,
        })
        .eq('id', personId);
    }

    // Simple community detection using connected components
    const communities = detectCommunities(relationships);
    
    // Update community assignments
    for (const [personId, communityId] of communities) {
      await supabase
        .from('persons')
        .update({ community_id: communityId })
        .eq('id', personId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        relationships: relationships.length,
        persons: personStats.size,
        communities: new Set(communities.values()).size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in compute-graph:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Simple Louvain-inspired community detection
function detectCommunities(relationships: any[]): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  
  // Build adjacency list
  for (const rel of relationships) {
    if (!adjacency.has(rel.person_a_id)) {
      adjacency.set(rel.person_a_id, new Set());
    }
    if (!adjacency.has(rel.person_b_id)) {
      adjacency.set(rel.person_b_id, new Set());
    }
    
    const weight = rel.emails_a_to_b + rel.emails_b_to_a;
    if (weight >= 3) { // Only consider significant connections
      adjacency.get(rel.person_a_id)!.add(rel.person_b_id);
      adjacency.get(rel.person_b_id)!.add(rel.person_a_id);
    }
  }

  // Find connected components as communities
  const visited = new Set<string>();
  const communities = new Map<string, number>();
  let communityId = 0;

  for (const [personId] of adjacency) {
    if (visited.has(personId)) continue;
    
    // BFS to find connected component
    const queue = [personId];
    const component: string[] = [];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      
      visited.add(current);
      component.push(current);
      
      const neighbors = adjacency.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    
    // Assign community to all members
    for (const member of component) {
      communities.set(member, communityId);
    }
    
    communityId++;
  }

  return communities;
}
