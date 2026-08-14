-- PLATZ.6 conflict / purpose smoke (read-only checks)
select public.is_venue_purpose_allowed_for_team_season(
  '5dd421cd-b47f-4889-8867-9bc1fa451c09',
  'ec1ba01f-cc58-4c91-b524-463b510ca339',
  'training'
) as u12_rohrbach_training,
public.is_venue_purpose_allowed_for_team_season(
  '5dd421cd-b47f-4889-8867-9bc1fa451c09',
  'ec1ba01f-cc58-4c91-b524-463b510ca339',
  'home_match'
) as u12_rohrbach_home,
public.is_venue_purpose_allowed_for_team_season(
  '5dd421cd-b47f-4889-8867-9bc1fa451c09',
  'ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c',
  'training'
) as u12_stveit_training,
public.is_venue_purpose_allowed_for_team_season(
  '5dd421cd-b47f-4889-8867-9bc1fa451c09',
  'ec5f02b6-b5f3-4b8a-a005-a1ac2280fc0c',
  'home_match'
) as u12_stveit_home_should_false;
