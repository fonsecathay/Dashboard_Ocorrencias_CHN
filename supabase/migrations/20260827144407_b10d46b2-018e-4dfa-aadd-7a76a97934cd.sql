CREATE TABLE public.dashboard_state (
  id TEXT PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.dashboard_state TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_state TO authenticated;
GRANT ALL ON public.dashboard_state TO service_role;

ALTER TABLE public.dashboard_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shared dashboard" ON public.dashboard_state FOR SELECT USING (true);
CREATE POLICY "Anyone can create shared dashboard" ON public.dashboard_state FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update shared dashboard" ON public.dashboard_state FOR UPDATE USING (true) WITH CHECK (true);

INSERT INTO public.dashboard_state (id, state) VALUES ('shared', '{"tdn":[],"quaseFalha":[],"metaQuaseFalha":0.65}'::jsonb);

ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_state;