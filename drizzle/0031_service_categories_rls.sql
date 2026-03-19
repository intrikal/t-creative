-- Enable RLS and add policies for service_categories table
ALTER TABLE public.service_categories
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_categories: public read"
  ON public.service_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_categories: admin manage"
  ON public.service_categories FOR ALL
  TO authenticated
  USING (public.get_user_role() = 'admin');
