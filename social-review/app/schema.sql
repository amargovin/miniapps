CREATE TABLE IF NOT EXISTS runs (
  id              BIGSERIAL PRIMARY KEY,
  week_ending     DATE        NOT NULL,
  week_tz         TEXT        NOT NULL,
  window_start    TIMESTAMPTZ NOT NULL,
  window_end      TIMESTAMPTZ NOT NULL,   -- exclusive
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  status          TEXT        NOT NULL,   -- running | ok | partial | failed
  channels_ok     TEXT[]      NOT NULL DEFAULT '{}',
  channels_failed TEXT[]      NOT NULL DEFAULT '{}',
  notes           JSONB       NOT NULL DEFAULT '[]',
  x_cost_usd      NUMERIC(10,4)
);

CREATE TABLE IF NOT EXISTS posts_x (
  post_id      TEXT PRIMARY KEY,
  week_ending  DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  text         TEXT        NOT NULL,
  title        TEXT,                      -- display title, see §7
  likes        INT NOT NULL, reposts INT NOT NULL, replies INT NOT NULL,
  quotes       INT NOT NULL, bookmarks INT NOT NULL, impressions INT NOT NULL,
  is_head      BOOLEAN NOT NULL,
  thread_root  TEXT,                      -- head post id; may point outside the window
  engagement   INT GENERATED ALWAYS AS (likes+reposts+replies+quotes+bookmarks) STORED,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS posts_x_week ON posts_x(week_ending);

CREATE TABLE IF NOT EXISTS posts_meta (
  platform     TEXT NOT NULL,             -- 'facebook' | 'instagram'
  post_id      TEXT NOT NULL,
  week_ending  DATE        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  message      TEXT,
  title        TEXT,
  permalink    TEXT,
  media_type   TEXT,                      -- IG only: REEL / CAROUSEL_ALBUM / IMAGE / VIDEO
  likes        INT, comments INT, shares INT,   -- NULL means unreported, never 0
  engagement   INT GENERATED ALWAYS AS
                 (COALESCE(likes,0)+COALESCE(comments,0)+COALESCE(shares,0)) STORED,
  fetched_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (platform, post_id)
);
CREATE INDEX IF NOT EXISTS posts_meta_week ON posts_meta(week_ending, platform);

CREATE TABLE IF NOT EXISTS weekly_totals (
  week_ending                  DATE NOT NULL,
  channel                      TEXT NOT NULL,   -- x | instagram | facebook
  week_tz                      TEXT NOT NULL,
  followers                    INT,
  posts                        INT  NOT NULL,
  ranked_posts                 INT,             -- heads only; X
  engagement                   INT  NOT NULL,
  impressions                  BIGINT,          -- NULL where unavailable
  engagement_per_post          NUMERIC(10,1) NOT NULL,
  engagement_per_1k_followers  NUMERIC(10,1),
  median_engagement            INT,
  engagement_rate_pct          NUMERIC(6,2),    -- NULL where no reach
  source                       TEXT NOT NULL DEFAULT 'api',  -- 'api' | 'imported'
  PRIMARY KEY (week_ending, channel)
);

CREATE TABLE IF NOT EXISTS reports (
  week_ending  DATE PRIMARY KEY,
  run_id       BIGINT REFERENCES runs(id) ON DELETE SET NULL,
  filename     TEXT        NOT NULL,
  pdf          BYTEA       NOT NULL,
  slide_count  INT         NOT NULL,
  link_count   INT         NOT NULL,
  rendered_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- a rendered deck is ~30 KB, so a year of history is under 2 MB; keep them all

-- keep the exact bytes we were given, so any number can be re-derived later
CREATE TABLE IF NOT EXISTS raw_payloads (
  id          BIGSERIAL PRIMARY KEY,
  run_id      BIGINT REFERENCES runs(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,               -- x_timeline_p1, fb_posts_p2, ...
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload     JSONB NOT NULL
);
