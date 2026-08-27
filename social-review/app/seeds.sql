-- Historical rows from RAILWAY_BRIEF.md §5, source='imported', so the first live run
-- has a comparison. Idempotent: ON CONFLICT DO NOTHING — never overwrite api-sourced rows.
--
-- week_tz tags are deliberate: the 2026-08-16 week was verified to contain the identical
-- post set under UTC and IST definitions (§3) and is tagged Asia/Kolkata; the 2026-08-09
-- week was not verified and must stay UTC. The 2026-08-09 source deck labelled its window
-- "2–9 August 2026" and both dates were Sundays, so the window is ambiguous — the renderer
-- must footnote this whenever that row appears in a comparison (§5).

INSERT INTO weekly_totals
  (week_ending, channel, week_tz, followers, posts, ranked_posts, engagement,
   impressions, engagement_per_post, engagement_per_1k_followers, median_engagement,
   engagement_rate_pct, source)
VALUES
  ('2026-08-09', 'x',         'UTC',          342501, 312, NULL, 29123, 1706991, 93.3,  85.0, 36,   1.71, 'imported'),
  ('2026-08-09', 'instagram', 'UTC',          59626,  7,   NULL, 1399,  NULL,    199.9, 23.5, 166,  NULL, 'imported'),
  ('2026-08-09', 'facebook',  'UTC',          634246, 55,  NULL, 843,   NULL,    15.3,  1.3,  NULL, NULL, 'imported'),
  ('2026-08-16', 'x',         'Asia/Kolkata', 342772, 215, 163,  21217, 1156638, 98.7,  61.9, 55,   1.83, 'imported'),
  ('2026-08-16', 'instagram', 'Asia/Kolkata', 59742,  4,   4,    1927,  NULL,    481.8, 32.3, 345,  NULL, 'imported'),
  ('2026-08-16', 'facebook',  'Asia/Kolkata', 633871, 43,  43,   641,   NULL,    14.9,  1.0,  13,   NULL, 'imported')
ON CONFLICT (week_ending, channel) DO NOTHING;
