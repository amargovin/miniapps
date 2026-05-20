CREATE TABLE IF NOT EXISTS source_state (
    source_id        TEXT PRIMARY KEY,
    last_fetched_at  TIMESTAMP,
    last_ok_at       TIMESTAMP,
    last_error       TEXT,
    consecutive_failures INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS raw_items (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id       TEXT NOT NULL,
    url             TEXT NOT NULL UNIQUE,
    canonical_url   TEXT,
    title           TEXT NOT NULL,
    body            TEXT,
    author          TEXT,
    published_at    TIMESTAMP,
    fetched_at      TIMESTAMP NOT NULL,
    content_hash    TEXT NOT NULL,
    embedding       BLOB,
    story_id        INTEGER,
    homepage_tier   TEXT,        -- 'hero' | 'secondary' | 'tertiary' | NULL
                                  -- captured from homepage layout (position + font-size)
                                  -- so the AI editor sees which stories were
                                  -- visually elevated on each publication's front.
    FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE INDEX IF NOT EXISTS idx_raw_items_story ON raw_items(story_id);
CREATE INDEX IF NOT EXISTS idx_raw_items_fetched ON raw_items(fetched_at);
CREATE INDEX IF NOT EXISTS idx_raw_items_hash ON raw_items(content_hash);

CREATE TABLE IF NOT EXISTS stories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    canonical_title TEXT NOT NULL,
    brief           TEXT,
    angle           TEXT,
    key_facts       TEXT,
    beat            TEXT,
    score           REAL NOT NULL DEFAULT 0,
    score_breakdown TEXT,
    centroid        BLOB,
    member_count    INTEGER NOT NULL DEFAULT 1,
    sources_covered TEXT,
    first_seen_at   TIMESTAMP NOT NULL,
    last_updated_at TIMESTAMP NOT NULL,
    brief_generated_at TIMESTAMP,
    status          TEXT NOT NULL DEFAULT 'new',
    swarajya_covered          INTEGER NOT NULL DEFAULT 0,
    swarajya_match_url        TEXT,
    swarajya_match_title      TEXT,
    swarajya_match_similarity REAL,
    editorial_pass            INTEGER,            -- NULL=unchecked, 0=excluded, 1=included
    editorial_reason          TEXT,
    editorial_significance    INTEGER,            -- 1..5, AI-judged news significance; primary ranking
    editorial_checked_at      TIMESTAMP,
    cms_pushed_at             TIMESTAMP,          -- /api/generate-and-publish autoPublish=false  (draft)
    auto_pushed_at            TIMESTAMP           -- /api/generate-and-publish autoPublish=true   (auto)
);

CREATE INDEX IF NOT EXISTS idx_stories_score ON stories(score DESC);
CREATE INDEX IF NOT EXISTS idx_stories_updated ON stories(last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_beat ON stories(beat);

CREATE TABLE IF NOT EXISTS scoring_weights (
    id                       INTEGER PRIMARY KEY CHECK (id = 1),
    beat_fit_weight          REAL NOT NULL DEFAULT 0.30,
    source_tier_weight       REAL NOT NULL DEFAULT 0.25,
    recency_decay_weight     REAL NOT NULL DEFAULT 0.20,
    cluster_size_weight      REAL NOT NULL DEFAULT 0.20,
    novelty_weight           REAL NOT NULL DEFAULT 0.05,
    gap_bonus_weight         REAL NOT NULL DEFAULT 0.00,
    recency_half_life_hours  REAL NOT NULL DEFAULT 24,
    cluster_size_cap         INTEGER NOT NULL DEFAULT 10,
    updated_at               TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO scoring_weights (id, updated_at) VALUES (1, CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS events_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id    INTEGER NOT NULL,
    action      TEXT NOT NULL,
    user_label  TEXT,
    at          TIMESTAMP NOT NULL,
    FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE INDEX IF NOT EXISTS idx_events_story ON events_log(story_id);

CREATE TABLE IF NOT EXISTS gnews_url_cache (
    google_url    TEXT PRIMARY KEY,
    canonical_url TEXT NOT NULL,
    resolved_at   TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS swarajya_items (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    subheadline  TEXT,
    url          TEXT,
    section_id   INTEGER,
    published_at TIMESTAMP,
    embedding    BLOB,
    fetched_at   TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_swarajya_published ON swarajya_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_swarajya ON stories(swarajya_covered, score DESC);
CREATE INDEX IF NOT EXISTS idx_stories_editorial ON stories(editorial_pass, score DESC);
