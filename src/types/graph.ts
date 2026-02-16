export interface Person {
  id: string;
  email: string;
  name: string | null;
  email_count_sent: number;
  email_count_received: number;
  avg_sentiment: number | null;
  community_id: number | null;
}

export interface Relationship {
  id: string;
  person_a_id: string;
  person_b_id: string;
  emails_a_to_b: number;
  emails_b_to_a: number;
  sentiment_a_to_b: number | null;
  sentiment_b_to_a: number | null;
  first_contact: string | null;
  last_contact: string | null;
}

// Updated Email interface to match pre-computed CSV structure
export interface Email {
  id: string;
  thread_id: string | null;
  sender_id: string | null;
  recipient: string | null;
  recipient_list: string[] | null;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  to_names: string[];
  cc_emails: string[];
  bcc_emails: string[];
  date: string | null;
  subject: string | null;
  body: string | null;
  message_clean: string | null;
  polarity: number | null;
  sentiment_score: number | null;
  sentiment_category: string | null;
  emotional_markers: string[];
  topics: string[];
  year: number | null;
  month: number | null;
  thread_subject: string | null;
  source_file: string | null;
  is_analyzed: boolean;
  message_id: string | null;
}

// Edge interface for pre-computed relationships
export interface Edge {
  id: string;
  sender_id: string;
  recipient_id: string;
  message_count: number;
  avg_polarity: number | null;
  edge_sentiment: string | null;
  weight_norm: number | null;
  edge_width: number | null;
  created_at: string;
}

export interface ProcessingJob {
  id: string;
  job_type: string;
  status: string;
  total_items: number;
  processed_items: number;
  error_message: string | null;
  created_at: string;
}

export interface GraphNode {
  id: string;
  name: string;
  email: string;
  val: number;
  color: string;
  communityId: number | null;
  emailCount: number;
  avgSentiment: number | null;
  isBridge?: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
  color: string;
  sentimentAtoB: number | null;
  sentimentBtoA: number | null;
  emailsAtoB: number;
  emailsBtoA: number;
  curvature: number;
  avgPolarity: number | null;
  edgeSentiment: string | null;
  mergedEdgeCount?: number; // Number of original edges merged into this link
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface FilterState {
  dateRange: [Date | null, Date | null];
  minEmails: number;
  sentimentRange: [number, number];
  selectedPerson: string | null;
  selectedCommunities: number[];
  showNegativeOnly: boolean;
}

// Raw CSV row types for parsing
export interface RawEdgeRow {
  sender_id: string;
  recipient_id: string;
  message_count: string;
  avg_polarity: string;
  edge_sentiment: string;
  weight_norm: string;
  edge_width: string;
}

export interface RawEmailRow {
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
