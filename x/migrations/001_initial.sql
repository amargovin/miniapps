CREATE TABLE tracked_users (
  id            SERIAL PRIMARY KEY,
  handle        TEXT NOT NULL UNIQUE,
  twitter_id    TEXT UNIQUE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_fetched_at TIMESTAMPTZ,
  notes         TEXT
);

CREATE TABLE tweets (
  id            BIGSERIAL PRIMARY KEY,
  tweet_id      TEXT NOT NULL UNIQUE,
  author_id     TEXT NOT NULL,
  author_handle TEXT NOT NULL,
  text          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL,
  lang          TEXT,
  retweet_count INT NOT NULL DEFAULT 0,
  like_count    INT NOT NULL DEFAULT 0,
  reply_count   INT NOT NULL DEFAULT 0,
  quote_count   INT NOT NULL DEFAULT 0,
  entities      JSONB,
  raw           JSONB NOT NULL,
  source        TEXT NOT NULL,
  fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE url_monitors (
  id            SERIAL PRIMARY KEY,
  url           TEXT NOT NULL UNIQUE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes         TEXT
);

CREATE TABLE poll_state (
  id            SERIAL PRIMARY KEY,
  source_type   TEXT NOT NULL,
  source_key    TEXT NOT NULL,
  since_id      TEXT,
  last_polled_at TIMESTAMPTZ,
  UNIQUE(source_type, source_key)
);
