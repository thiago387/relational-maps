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

export interface Email {
  id: string;
  message_id: string | null;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  to_names: string[];
  cc_emails: string[];
  bcc_emails: string[];
  date: string | null;
  subject: string | null;
  body: string | null;
  sentiment_score: number | null;
  sentiment_category: string | null;
  emotional_markers: string[];
  topics: string[];
  is_analyzed: boolean;
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
