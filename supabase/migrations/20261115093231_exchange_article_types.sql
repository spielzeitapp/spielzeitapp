-- Extend article choices without rewriting existing listings or changing access.
alter table public.exchange_listings drop constraint exchange_listings_category_check;
alter table public.exchange_listings add constraint exchange_listings_category_check check (category in ('T-Shirt','Hose','Pulli','Trainingsanzug','Jacke','Schuhe','Zubehör','Sonstiges','Fußballschuhe','Hallenschuhe','Laufschuhe','Schienbeinschoner','Torwarthandschuhe','Sporttaschen','Rucksäcke','Bälle','Trinkflaschen','Trainingszubehör'));
