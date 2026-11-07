import importlib.util,unittest
s=importlib.util.spec_from_file_location('review_sql','scripts/release/review-sql.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class ReviewPolicy(unittest.TestCase):
 def test_additive(self):
  for sql in ["ALTER TABLE public.clubs ADD COLUMN caption text;", "ALTER TABLE public.team_photos ADD COLUMN zoom integer NOT NULL DEFAULT 100 CHECK(zoom BETWEEN 100 AND 220);", "CREATE INDEX club_caption_idx ON public.clubs(caption); NOTIFY pgrst,'reload schema';"]:
   with self.subTest(sql=sql):self.assertTrue(m.inspect(sql))
 def test_fail_closed(self):
  for sql in ["DROP TABLE public.clubs;", "DELETE FROM public.clubs;", "ALTER TABLE public.clubs DISABLE ROW LEVEL SECURITY;", "ALTER TABLE public.clubs ADD COLUMN x text, DROP COLUMN name;", "ALTER TABLE public.clubs ADD COLUMN x text DEFAULT public.secret_function();", "ALTER TABLE public.clubs ADD COLUMN x integer NOT NULL;", "ALTER TABLE public.clubs ADD COLUMN x integer CHECK(x>public.secret_function());", "ALTER TABLE auth.users ADD COLUMN x text;", "CREATE UNIQUE INDEX x ON public.clubs(name);", "CREATE INDEX x ON public.clubs ((public.secret_function()));", "CREATE FUNCTION public.foo() RETURNS int LANGUAGE sql AS $$select 1$$;", "GRANT ALL ON public.clubs TO anon;", "ALTER TABLE public.clubs ADD COLUMN x text CHECK(name='x');", "NOTIFY arbitrary,'reload schema';"]:
   with self.subTest(sql=sql):
    with self.assertRaises(Exception):m.inspect(sql)
if __name__=='__main__':unittest.main()
