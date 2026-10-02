ALTER TABLE public.swipes
ADD COLUMN job_context_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE;
