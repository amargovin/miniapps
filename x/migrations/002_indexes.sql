CREATE INDEX idx_tweets_author_id     ON tweets(author_id);
CREATE INDEX idx_tweets_created_at    ON tweets(created_at DESC);
CREATE INDEX idx_tweets_source        ON tweets(source);
CREATE INDEX idx_tweets_tweet_id      ON tweets(tweet_id);
CREATE INDEX idx_poll_state_source    ON poll_state(source_type, source_key);
