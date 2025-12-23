import { supabase } from "@/integrations/supabase/client";
import Papa from "papaparse";

const BATCH_SIZE = 500;

interface EdgeRow {
  sender_id: string;
  recipient_id: string;
  message_count: string;
  avg_polarity: string;
  edge_sentiment: string;
  weight_norm: string;
  edge_width: string;
}

interface EmailRow {
  thread_id: string;
  sender: string;
  recipient: string;
  title: string;
  message: string;
  timestamp: string;
  year: string;
  month: string;
  thread_subject: string;
  source_file: string;
  message_clean: string;
  sender_id: string;
  recipient_list: string;
  polarity: string;
  sentiment: string;
}

// Load edges from CSV
export async function loadEdgesFromCSV(
  onProgress?: (loaded: number, total: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const response = await fetch('/email_edges.csv');
    const text = await response.text();
    
    const parseResult = Papa.parse<EdgeRow>(text, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (parseResult.errors.length > 0) {
      console.warn('CSV parse warnings:', parseResult.errors.slice(0, 5));
    }
    
    const dataRows = parseResult.data;
    const total = dataRows.length;
    
    if (total === 0) {
      return { success: false, count: 0, error: 'No data in CSV' };
    }
    
    // Clear existing edges
    await supabase.from('edges').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    let loaded = 0;
    let inserted = 0;
    
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      
      const edges = batch
        .filter(row => row.sender_id && row.recipient_id)
        .map(row => ({
          sender_id: row.sender_id?.trim() || '',
          recipient_id: row.recipient_id?.trim() || '',
          message_count: parseInt(row.message_count) || 0,
          avg_polarity: row.avg_polarity ? parseFloat(row.avg_polarity) : null,
          edge_sentiment: row.edge_sentiment?.trim() || null,
          weight_norm: row.weight_norm ? parseFloat(row.weight_norm) : null,
          edge_width: row.edge_width ? parseFloat(row.edge_width) : null,
        }));
      
      if (edges.length > 0) {
        const { error } = await supabase.from('edges').insert(edges);
        if (error) {
          console.error('Error inserting edges batch:', error);
        } else {
          inserted += edges.length;
        }
      }
      
      loaded += batch.length;
      onProgress?.(loaded, total);
    }
    
    return { success: true, count: inserted };
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
    
    const parseResult = Papa.parse<EmailRow>(text, {
      header: true,
      skipEmptyLines: true,
    });
    
    if (parseResult.errors.length > 0) {
      console.warn('CSV parse warnings (first 5):', parseResult.errors.slice(0, 5));
    }
    
    const dataRows = parseResult.data;
    const total = dataRows.length;
    
    console.log(`Parsed ${total} email rows from CSV`);
    
    if (total === 0) {
      return { success: false, count: 0, error: 'No data in CSV' };
    }
    
    // Clear existing emails
    await supabase.from('emails').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    let loaded = 0;
    let inserted = 0;
    
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      
      const emails = batch
        .filter(row => row.sender_id || row.sender) // Keep rows that have a sender
        .map(row => {
          // Parse recipient_list from string like "['recipient1', 'recipient2']"
          let recipientList: string[] = [];
          try {
            if (row.recipient_list) {
              const cleaned = row.recipient_list.replace(/'/g, '"');
              recipientList = JSON.parse(cleaned);
            }
          } catch {
            recipientList = row.recipient ? [row.recipient] : [];
          }
          
          // Parse timestamp
          let dateVal: string | null = null;
          if (row.timestamp) {
            try {
              const d = new Date(row.timestamp);
              if (!isNaN(d.getTime())) {
                dateVal = d.toISOString();
              }
            } catch {
              dateVal = null;
            }
          }
          
          const senderId = (row.sender_id || row.sender || '').trim();
          
          return {
            thread_id: row.thread_id?.trim() || null,
            sender_id: senderId,
            from_email: senderId,
            from_name: row.sender?.trim() || null,
            recipient: row.recipient?.trim() || null,
            recipient_list: recipientList,
            to_emails: recipientList,
            subject: row.title?.trim() || row.thread_subject?.trim() || null,
            body: row.message || null,
            message_clean: row.message_clean || null,
            date: dateVal,
            year: row.year ? parseInt(row.year) : null,
            month: row.month ? parseInt(row.month) : null,
            thread_subject: row.thread_subject?.trim() || null,
            source_file: row.source_file?.trim() || null,
            polarity: row.polarity ? parseFloat(row.polarity) : null,
            sentiment_score: row.polarity ? parseFloat(row.polarity) : null,
            sentiment_category: row.sentiment?.trim() || null,
            is_analyzed: true,
          };
        });
      
      if (emails.length > 0) {
        const { error } = await supabase.from('emails').insert(emails);
        if (error) {
          console.error('Error inserting emails batch:', error);
        } else {
          inserted += emails.length;
        }
      }
      
      loaded += batch.length;
      onProgress?.(loaded, total);
    }
    
    console.log(`Successfully inserted ${inserted} emails`);
    return { success: true, count: inserted };
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
