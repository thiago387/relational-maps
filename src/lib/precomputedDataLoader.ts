import { supabase } from "@/integrations/supabase/client";
import type { RawEdgeRow, RawEmailRow } from "@/types/graph";

const BATCH_SIZE = 500;

// Parse CSV text into rows
function parseCSV(text: string): string[][] {
  const lines = text.split('\n');
  const result: string[][] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current);
    result.push(row);
  }
  
  return result;
}

// Load edges from CSV
export async function loadEdgesFromCSV(
  onProgress?: (loaded: number, total: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch('/email_edges.csv');
    const text = await response.text();
    const rows = parseCSV(text);
    
    if (rows.length < 2) {
      return { success: false, count: 0, error: 'No data in CSV' };
    }
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const total = dataRows.length;
    
    // Clear existing edges
    await supabase.from('edges').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    let loaded = 0;
    
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      
      const edges = batch.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          obj[h.trim()] = row[idx]?.trim() || '';
        });
        
        return {
          sender_id: obj.sender_id || '',
          recipient_id: obj.recipient_id || '',
          message_count: parseInt(obj.message_count) || 0,
          avg_polarity: obj.avg_polarity ? parseFloat(obj.avg_polarity) : null,
          edge_sentiment: obj.edge_sentiment || null,
          weight_norm: obj.weight_norm ? parseFloat(obj.weight_norm) : null,
          edge_width: obj.edge_width ? parseFloat(obj.edge_width) : null,
        };
      }).filter(e => e.sender_id && e.recipient_id);
      
      if (edges.length > 0) {
        const { error } = await supabase.from('edges').insert(edges);
        if (error) {
          console.error('Error inserting edges batch:', error);
        }
      }
      
      loaded += batch.length;
      onProgress?.(loaded, total);
    }
    
    return { success: true, count: loaded };
  } catch (error) {
    console.error('Error loading edges:', error);
    return { success: false, count: 0, error: String(error) };
  }
}

// Load emails from CSV
export async function loadEmailsFromCSV(
  onProgress?: (loaded: number, total: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch('/emails_with_polarity.csv');
    const text = await response.text();
    const rows = parseCSV(text);
    
    if (rows.length < 2) {
      return { success: false, count: 0, error: 'No data in CSV' };
    }
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const total = dataRows.length;
    
    // Clear existing emails
    await supabase.from('emails').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    let loaded = 0;
    
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      
      const emails = batch.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          obj[h.trim()] = row[idx] || '';
        });
        
        // Parse recipient_list from string like "['recipient1', 'recipient2']"
        let recipientList: string[] = [];
        try {
          if (obj.recipient_list) {
            const cleaned = obj.recipient_list.replace(/'/g, '"');
            recipientList = JSON.parse(cleaned);
          }
        } catch {
          recipientList = obj.recipient ? [obj.recipient] : [];
        }
        
        // Parse timestamp
        let dateVal: string | null = null;
        if (obj.timestamp) {
          try {
            const d = new Date(obj.timestamp);
            if (!isNaN(d.getTime())) {
              dateVal = d.toISOString();
            }
          } catch {
            dateVal = null;
          }
        }
        
        return {
          thread_id: obj.thread_id || null,
          sender_id: obj.sender_id || obj.sender || '',
          from_email: obj.sender_id || obj.sender || '',
          from_name: obj.sender || null,
          recipient: obj.recipient || null,
          recipient_list: recipientList,
          to_emails: recipientList,
          subject: obj.title || obj.thread_subject || null,
          body: obj.message || null,
          message_clean: obj.message_clean || null,
          date: dateVal,
          year: obj.year ? parseInt(obj.year) : null,
          month: obj.month ? parseInt(obj.month) : null,
          thread_subject: obj.thread_subject || null,
          source_file: obj.source_file || null,
          polarity: obj.polarity ? parseFloat(obj.polarity) : null,
          sentiment_score: obj.polarity ? parseFloat(obj.polarity) : null,
          sentiment_category: obj.sentiment || null,
          is_analyzed: true,
        };
      }).filter(e => e.from_email);
      
      if (emails.length > 0) {
        const { error } = await supabase.from('emails').insert(emails);
        if (error) {
          console.error('Error inserting emails batch:', error);
        }
      }
      
      loaded += batch.length;
      onProgress?.(loaded, total);
    }
    
    return { success: true, count: loaded };
  } catch (error) {
    console.error('Error loading emails:', error);
    return { success: false, count: 0, error: String(error) };
  }
}

// Load both datasets
export async function loadPrecomputedData(
  onProgress?: (stage: string, loaded: number, total: number) => void
): Promise<{ success: boolean; edgeCount: number; emailCount: number; error?: string }> {
  try {
    // Load edges first (smaller dataset)
    const edgeResult = await loadEdgesFromCSV((loaded, total) => {
      onProgress?.('edges', loaded, total);
    });
    
    if (!edgeResult.success) {
      return { success: false, edgeCount: 0, emailCount: 0, error: edgeResult.error };
    }
    
    // Load emails
    const emailResult = await loadEmailsFromCSV((loaded, total) => {
      onProgress?.('emails', loaded, total);
    });
    
    if (!emailResult.success) {
      return { success: false, edgeCount: edgeResult.count, emailCount: 0, error: emailResult.error };
    }
    
    return {
      success: true,
      edgeCount: edgeResult.count,
      emailCount: emailResult.count,
    };
  } catch (error) {
    console.error('Error loading precomputed data:', error);
    return { success: false, edgeCount: 0, emailCount: 0, error: String(error) };
  }
}

// Fetch edges from database
export async function fetchEdges() {
  const { data, error } = await supabase
    .from('edges')
    .select('*')
    .order('message_count', { ascending: false });
  
  if (error) {
    console.error('Error fetching edges:', error);
    return [];
  }
  
  return data || [];
}

// Fetch stats
export async function fetchDataStats() {
  const [edgesResult, emailsResult] = await Promise.all([
    supabase.from('edges').select('id', { count: 'exact', head: true }),
    supabase.from('emails').select('id', { count: 'exact', head: true }),
  ]);
  
  return {
    edgeCount: edgesResult.count || 0,
    emailCount: emailsResult.count || 0,
  };
}

// Clear all data
export async function clearAllData() {
  await Promise.all([
    supabase.from('edges').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('emails').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('relationships').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    supabase.from('persons').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
  ]);
}
