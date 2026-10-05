-- Explicitly remove default anon EXECUTE grant on the staff-only chapter RPC.
REVOKE EXECUTE ON FUNCTION public.change_match_video_chapter(uuid,text,uuid,integer,text,text) FROM anon;
