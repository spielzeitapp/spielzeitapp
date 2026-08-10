-- PLATZ.5.1 Staging conflict geometry checks (read-only)
with g as (
  select zone_code, rect_x, rect_y, rect_w, rect_h
  from venue_field_zones
  where field_id = '4ac28ccc-8e65-462a-bdf7-96db9a35705a' and is_active
)
select 'A_half_ab' as scenario,
  public.field_zone_rects_overlap(
    (select rect_x from g where zone_code='half_a'), (select rect_y from g where zone_code='half_a'),
    (select rect_w from g where zone_code='half_a'), (select rect_h from g where zone_code='half_a'),
    (select rect_x from g where zone_code='half_b'), (select rect_y from g where zone_code='half_b'),
    (select rect_w from g where zone_code='half_b'), (select rect_h from g where zone_code='half_b')
  ) as overlap
union all
select 'B_entire_half_a',
  public.field_zone_rects_overlap(
    (select rect_x from g where zone_code='entire'), (select rect_y from g where zone_code='entire'),
    (select rect_w from g where zone_code='entire'), (select rect_h from g where zone_code='entire'),
    (select rect_x from g where zone_code='half_a'), (select rect_y from g where zone_code='half_a'),
    (select rect_w from g where zone_code='half_a'), (select rect_h from g where zone_code='half_a')
  )
union all
select 'C_thirds_ab',
  public.field_zone_rects_overlap(
    (select rect_x from g where zone_code='third_a'), (select rect_y from g where zone_code='third_a'),
    (select rect_w from g where zone_code='third_a'), (select rect_h from g where zone_code='third_a'),
    (select rect_x from g where zone_code='third_b'), (select rect_y from g where zone_code='third_b'),
    (select rect_w from g where zone_code='third_b'), (select rect_h from g where zone_code='third_b')
  )
union all
select 'C_thirds_bc',
  public.field_zone_rects_overlap(
    (select rect_x from g where zone_code='third_b'), (select rect_y from g where zone_code='third_b'),
    (select rect_w from g where zone_code='third_b'), (select rect_h from g where zone_code='third_b'),
    (select rect_x from g where zone_code='third_c'), (select rect_y from g where zone_code='third_c'),
    (select rect_w from g where zone_code='third_c'), (select rect_h from g where zone_code='third_c')
  )
union all
select 'D_half_a_third_b',
  public.field_zone_rects_overlap(
    (select rect_x from g where zone_code='half_a'), (select rect_y from g where zone_code='half_a'),
    (select rect_w from g where zone_code='half_a'), (select rect_h from g where zone_code='half_a'),
    (select rect_x from g where zone_code='third_b'), (select rect_y from g where zone_code='third_b'),
    (select rect_w from g where zone_code='third_b'), (select rect_h from g where zone_code='third_b')
  )
union all
select 'G_quarters_ab',
  public.field_zone_rects_overlap(
    (select rect_x from g where zone_code='quarter_a'), (select rect_y from g where zone_code='quarter_a'),
    (select rect_w from g where zone_code='quarter_a'), (select rect_h from g where zone_code='quarter_a'),
    (select rect_x from g where zone_code='quarter_b'), (select rect_y from g where zone_code='quarter_b'),
    (select rect_w from g where zone_code='quarter_b'), (select rect_h from g where zone_code='quarter_b')
  );
