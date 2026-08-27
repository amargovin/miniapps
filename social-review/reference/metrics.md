# Metric definitions

## Engagement

**X:** `likes + reposts + replies + quotes + bookmarks`
**Instagram / Facebook:** `likes + comments + shares`

The two are not strictly comparable — X exposes two interaction types Meta does not. This
inflates X slightly relative to Meta. It does not come close to explaining the gaps actually
observed (X earned roughly 65x Facebook's engagement per follower in the first measured
week), so the comparison remains meaningful. Say this once in the deck rather than hedging
every figure.

## Rates

- `engagement_per_post = engagement / posts`
- `engagement_per_1k_followers = engagement / (followers / 1000)` — the closest thing to a
  return-on-audience measure, and the fairest cross-channel comparison available given
  wildly different follower counts and posting volumes.
- `engagement_rate = engagement / impressions` — X only, since Meta returns no impressions.

## Counting rules for X

- **Totals** (engagement, impressions, post count) include every post in the window,
  thread continuations included. They are all real posts that earned real impressions.
- **Rankings** include thread heads and standalone posts only. A thread is one item,
  credited with its head post's metrics. Listing continuations separately would fill the
  top 25 with fragments of two threads.
- **Median** is computed across all posts, not just heads. Compare it to the mean: a large
  gap is the clearest signal that a few posts are carrying the week.

## Concentration

- `top_post_share = best single post engagement / total engagement`
- `top25_share = sum of top 25 engagement / total engagement`

Both matter because a headline average misleads when one post is 15% of a week. Report the
median alongside any mean.

## Reconciliation

Two independent checks, both cheap, both mandatory:

1. **X:** row count per page against `meta.result_count`.
2. **Meta:** CSV column sums against `metamcp:get_analytics_summary` totals for the same
   window.

If either fails, the pull is wrong. Re-pull. A total that is wrong by one post is
indistinguishable from a correct one by the time it reaches a slide, which is exactly why
these checks exist.

## Week-over-week

Deltas are computed against the immediately preceding row for the same channel in
`history/weekly_totals.csv`. Report percentage change on engagement, reach (X only), posts
and per-post engagement.

Guard against a false trend: if posting volume swung sharply, per-post engagement is the
honest comparison, not the total. Seven Instagram posts one week and twenty the next will
move the total regardless of whether anything improved.
