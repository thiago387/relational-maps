-- Create edges table for pre-computed relationships
CREATE TABLE public.edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  recipient_id text NOT NULL,
  message_count integer DEFAULT 0,
  avg_polarity numeric,
  edge_sentiment text,
  weight_norm numeric,
  edge_width numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add new columns to emails table for pre-computed data structure
ALTER TABLE public.emails 
ADD COLUMN IF NOT EXISTS thread_id text,
ADD COLUMN IF NOT EXISTS sender_id text,
ADD COLUMN IF NOT EXISTS recipient text,
ADD COLUMN IF NOT EXISTS recipient_list text[],
ADD COLUMN IF NOT EXISTS year integer,
ADD COLUMN IF NOT EXISTS month integer,
ADD COLUMN IF NOT EXISTS thread_subject text,
ADD COLUMN IF NOT EXISTS source_file text,
ADD COLUMN IF NOT EXISTS message_clean text,
ADD COLUMN IF NOT EXISTS polarity numeric;

-- Update sentiment_score to use polarity (they'll both exist for now)
-- Enable RLS on edges
ALTER TABLE public.edges ENABLE ROW LEVEL SECURITY;

-- Create policies for edges table (public read access)
CREATE POLICY "Allow public read access to edges"
ON public.edges
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert to edges"
ON public.edges
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public delete to edges"
ON public.edges
FOR DELETE
USING (true);

CREATE POLICY "Allow public update to edges"
ON public.edges
FOR UPDATE
USING (true);

-- Create index for better query performance
CREATE INDEX idx_edges_sender ON public.edges(sender_id);
CREATE INDEX idx_edges_recipient ON public.edges(recipient_id);
CREATE INDEX idx_emails_sender_id ON public.emails(sender_id);
CREATE INDEX idx_emails_thread_id ON public.emails(thread_id);