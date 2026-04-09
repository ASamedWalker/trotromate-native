-- 046b: Seed mock GPRTU/GRDA announcements for Transport Pulse demo.
-- These are placeholder examples so the bulletin screen has content in preview builds
-- before actual partnership agreements. Safe to re-run (idempotent via title + source).

insert into public.official_announcements (source, title, body, category, priority, published_at)
select * from (values
  (
    'GPRTU'::text,
    'New official fare chart effective April 15, 2026'::text,
    'The Ghana Private Road Transport Union has approved revised trotro fares across all Greater Accra routes effective April 15, 2026. The adjustment reflects recent fuel price changes and driver welfare discussions held with the Ministry of Transport. Commuters are encouraged to pay only the GPRTU-approved fare shown on the Troski route page. Report overcharges directly in-app.'::text,
    'fare_update'::text,
    'high'::text,
    now() - interval '2 hours'
  ),
  (
    'GPRTU',
    'Kasoa–Circle route temporary diversion this weekend',
    'Due to ongoing road construction on the Kasoa–Mallam highway, trotros operating the Kasoa–Circle route will be diverted via Weija from Saturday April 11 to Sunday April 12. Expect 10–15 minute delays. Drivers have been briefed at Kasoa New Market station. Normal service resumes Monday.',
    'route_change',
    'normal',
    now() - interval '1 day'
  ),
  (
    'GRDA',
    'Accra–Tema train schedule update for Easter week',
    'The Ghana Railway Development Authority will operate additional Accra–Tema services on Good Friday and Easter Monday to handle increased holiday travel. Trains will depart Accra Central every 45 minutes from 6:00am to 8:00pm. Fares remain unchanged at GH₵5 one-way.',
    'public_notice',
    'normal',
    now() - interval '3 days'
  ),
  (
    'GPRTU',
    'Station cleanliness drive — Circle, Madina, Kaneshie',
    'GPRTU, in partnership with AMA, is launching a monthly cleanliness drive at Circle, Madina, and Kaneshie terminals starting April 20. Commuters will see improved waste management and clearer signage. Passengers are encouraged to use designated waste bins at each terminal.',
    'policy',
    'low',
    now() - interval '5 days'
  ),
  (
    'TROSKI',
    'Insights: Kasoa–Circle fares up 12% this month',
    'Based on 847 commuter reports between March 8 and April 8, the Kasoa–Circle corridor has seen an average fare increase of 12% — well above the 3% city-wide average. Peak morning rides (6–8am) remain the most variable. Troski is sharing this data with GPRTU for review.',
    'insights',
    'normal',
    now() - interval '6 hours'
  )
) as v(source, title, body, category, priority, published_at)
where not exists (
  select 1 from public.official_announcements
  where official_announcements.source = v.source
    and official_announcements.title = v.title
);
