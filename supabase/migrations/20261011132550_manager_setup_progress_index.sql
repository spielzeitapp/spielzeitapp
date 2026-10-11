CREATE INDEX manager_setup_progress_updated_by_idx ON public.manager_setup_progress(updated_by);
NOTIFY pgrst, 'reload schema';
