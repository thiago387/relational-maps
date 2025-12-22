import type { Email } from '@/types/graph';

interface ParsedMessage {
  sender: string;
  recipients: string[];
  timestamp: string;
  subject: string;
  body: string;
}

/**
 * Extract email address from various formats:
 * - "Name [email@domain.com]" -> email@domain.com
 * - "Name <email@domain.com>" -> email@domain.com
 * - "email@domain.com" -> email@domain.com
 */
function extractEmail(text: string): string | null {
  if (!text) return null;
  
  // Check for square bracket format: Name [email@domain.com]
  const squareBracketMatch = text.match(/\[([^\]]+@[^\]]+)\]/);
  if (squareBracketMatch) return squareBracketMatch[1].toLowerCase().trim();
  
  // Check for angle bracket format: Name <email@domain.com>
  const angleBracketMatch = text.match(/<([^>]+@[^>]+)>/);
  if (angleBracketMatch) return angleBracketMatch[1].toLowerCase().trim();
  
  // Check if it's a plain email
  const plainEmailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (plainEmailMatch) return plainEmailMatch[1].toLowerCase().trim();
  
  return null;
}

/**
 * Extract name from various formats:
 * - "Name [email@domain.com]" -> Name
 * - "Name <email@domain.com>" -> Name
 * - "email@domain.com" -> null
 */
function extractName(text: string): string | null {
  if (!text) return null;
  
  // Check for square bracket format
  const squareBracketMatch = text.match(/^([^\[]+)\s*\[/);
  if (squareBracketMatch) {
    const name = squareBracketMatch[1].trim();
    return name.length > 0 ? name : null;
  }
  
  // Check for angle bracket format
  const angleBracketMatch = text.match(/^([^<]+)\s*</);
  if (angleBracketMatch) {
    const name = angleBracketMatch[1].trim();
    return name.length > 0 ? name : null;
  }
  
  return null;
}

/**
 * Parse semicolon-delimited CSV with proper handling of quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        field += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ';' && !inQuotes) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  
  // Push the last field
  fields.push(field);
  
  return fields;
}

/**
 * Parse timestamp from various formats
 */
function parseTimestamp(timestamp: string): string | null {
  if (!timestamp) return null;
  
  try {
    // Try parsing as-is first
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
    
    // Handle format like "5/30/2019 5:29 PM"
    const usDateMatch = timestamp.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (usDateMatch) {
      const [, month, day, year, hours, minutes, ampm] = usDateMatch;
      let hour = parseInt(hours);
      if (ampm?.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm?.toUpperCase() === 'AM' && hour === 12) hour = 0;
      
      const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour, parseInt(minutes));
      return parsedDate.toISOString();
    }
    
    return null;
  } catch {
    return null;
  }
}

export interface CSVParseProgress {
  phase: 'fetching' | 'parsing' | 'complete';
  current: number;
  total: number;
  emailsFound: number;
}

export type ProgressCallback = (progress: CSVParseProgress) => void;

/**
 * Fetch and parse the bundled CSV file, returning parsed emails
 */
export async function parseEmailCSV(
  onProgress?: ProgressCallback
): Promise<Partial<Email>[]> {
  onProgress?.({ phase: 'fetching', current: 0, total: 0, emailsFound: 0 });
  
  // Fetch the CSV file
  const response = await fetch('/epstein_emails.csv');
  if (!response.ok) {
    throw new Error('Failed to fetch CSV file');
  }
  
  const csvText = await response.text();
  const lines = csvText.split('\n');
  
  // Skip header line
  const dataLines = lines.slice(1).filter(line => line.trim().length > 0);
  const total = dataLines.length;
  
  const emails: Partial<Email>[] = [];
  
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const fields = parseCSVLine(line);
    
    // CSV format: ;thread_id;source_file;subject;messages;message_count
    // Index:      0  1         2           3       4         5
    const messagesJson = fields[4];
    
    if (!messagesJson) continue;
    
    try {
      // Parse the JSON messages array (it's double-encoded with "" for quotes)
      const cleanedJson = messagesJson.replace(/""/g, '"');
      const messages: ParsedMessage[] = JSON.parse(cleanedJson);
      
      for (const msg of messages) {
        const fromEmail = extractEmail(msg.sender);
        if (!fromEmail) continue;
        
        const fromName = extractName(msg.sender);
        const toEmails = msg.recipients
          .map(r => extractEmail(r))
          .filter((e): e is string => e !== null);
        
        const parsedDate = parseTimestamp(msg.timestamp);
        
        // Generate a unique message ID
        const messageId = `csv-${i}-${emails.length}-${Date.now()}`;
        
        emails.push({
          message_id: messageId,
          from_email: fromEmail,
          from_name: fromName,
          to_emails: toEmails.length > 0 ? toEmails : undefined,
          subject: msg.subject || undefined,
          body: msg.body || undefined,
          date: parsedDate || undefined,
        });
      }
    } catch (e) {
      // Skip malformed JSON
      console.warn(`Failed to parse messages at line ${i}:`, e);
    }
    
    // Report progress every 100 lines
    if (i % 100 === 0 || i === dataLines.length - 1) {
      onProgress?.({ 
        phase: 'parsing', 
        current: i + 1, 
        total, 
        emailsFound: emails.length 
      });
    }
  }
  
  onProgress?.({ phase: 'complete', current: total, total, emailsFound: emails.length });
  
  return emails;
}
