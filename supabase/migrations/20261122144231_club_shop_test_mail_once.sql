create unique index club_shop_test_mail_once on public.club_shop_audit (club_id, action, record_id) where action in ('test_mail_customer', 'test_mail_manager', 'test_mail_dealer');
