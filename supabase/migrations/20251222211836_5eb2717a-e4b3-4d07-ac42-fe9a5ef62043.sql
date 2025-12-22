-- Create emails table to store parsed email data
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT UNIQUE,
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_emails TEXT[] DEFAULT '{}',
  to_names TEXT[] DEFAULT '{}',
  cc_emails TEXT[] DEFAULT '{}',
  bcc_emails TEXT[] DEFAULT '{}',
  date TIMESTAMP WITH TIME ZONE,
  subject TEXT,
  body TEXT,
  raw_content TEXT,
  sentiment_score DECIMAL(3,2),
  sentiment_category TEXT,
  emotional_markers TEXT[] DEFAULT '{}',
  topics TEXT[] DEFAULT '{}',
  is_analyzed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create persons table to track unique people in the network
CREATE TABLE public.persons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  email_count_sent INTEGER DEFAULT 0,
  email_count_received INTEGER DEFAULT 0,
  avg_sentiment DECIMAL(3,2),
  community_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create relationships table to track connections between people
CREATE TABLE public.relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_a_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  person_b_id UUID NOT NULL REFERENCES public.persons(id) ON DELETE CASCADE,
  emails_a_to_b INTEGER DEFAULT 0,
  emails_b_to_a INTEGER DEFAULT 0,
  sentiment_a_to_b DECIMAL(3,2),
  sentiment_b_to_a DECIMAL(3,2),
  first_contact TIMESTAMP WITH TIME ZONE,
  last_contact TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(person_a_id, person_b_id)
);

-- Create processing_jobs table to track batch processing
CREATE TABLE public.processing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_items INTEGER DEFAULT 0,
  processed_items INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX idx_emails_from_email ON public.emails(from_email);
CREATE INDEX idx_emails_date ON public.emails(date);
CREATE INDEX idx_emails_is_analyzed ON public.emails(is_analyzed);
CREATE INDEX idx_persons_email ON public.persons(email);
CREATE INDEX idx_persons_community ON public.persons(community_id);
CREATE INDEX idx_relationships_persons ON public.relationships(person_a_id, person_b_id);

-- Enable Row Level Security (public read for this analysis tool)
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (this is a public analysis tool)
CREATE POLICY "Allow public read access to emails" ON public.emails FOR SELECT USING (true);
CREATE POLICY "Allow public insert to emails" ON public.emails FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to emails" ON public.emails FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to emails" ON public.emails FOR DELETE USING (true);

CREATE POLICY "Allow public read access to persons" ON public.persons FOR SELECT USING (true);
CREATE POLICY "Allow public insert to persons" ON public.persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to persons" ON public.persons FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to persons" ON public.persons FOR DELETE USING (true);

CREATE POLICY "Allow public read access to relationships" ON public.relationships FOR SELECT USING (true);
CREATE POLICY "Allow public insert to relationships" ON public.relationships FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to relationships" ON public.relationships FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to relationships" ON public.relationships FOR DELETE USING (true);

CREATE POLICY "Allow public read access to processing_jobs" ON public.processing_jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert to processing_jobs" ON public.processing_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update to processing_jobs" ON public.processing_jobs FOR UPDATE USING (true);
CREATE POLICY "Allow public delete to processing_jobs" ON public.processing_jobs FOR DELETE USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_relationships_updated_at
  BEFORE UPDATE ON public.relationships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at
  BEFORE UPDATE ON public.processing_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();