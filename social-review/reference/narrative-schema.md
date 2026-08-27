# narrative.json

Written by you each week after reading `summary.json`. Everything here is judgment; the
script supplies no defaults and errors on missing required keys, so nothing is silently
omitted from the deck.

```json
{
  "headline": "One channel is carrying almost everything",
  "glance_note": "One or two sentences under the comparison table. The most important fact of the week.",
  "working": [
    { "title": "Longform beats the news feed",
      "points": ["Claim with a number.", "Second claim.", "Third claim."] },
    { "title": "The best stories travel everywhere",
      "points": ["...", "..."] }
  ],
  "not_working": [
    { "title": "Facebook, as currently run", "points": ["...", "..."] },
    { "title": "Habits costing engagement on X", "points": ["...", "..."] }
  ],
  "working_implication": "One line landing the 'what is working' slide.",
  "not_working_implication": "One line landing the 'what is not working' slide.",
  "cross_channel": {
    "rows": [["Jaisalmer limestone", "4,599", "378", "not posted"]],
    "note": "Footnote under the table.",
    "lead": "The sentence that makes the slide land."
  },
  "behaviour": {
    "left": { "title": "The conversation loop is missing", "points": ["..."] },
    "right": { "title": "But intent to return is high", "points": ["..."] }
  },
  "actions": [
    { "title": "Fix distribution", "points": ["1. ...", "2. ...", "3. ..."] },
    { "title": "Fix mechanics on X", "points": ["4. ...", "5. ..."] }
  ],
  "closing": "One line closing the recommendations slide.",
  "extra_gaps": []
}
```

## Conventions

- Wrap the load-bearing part of each point in `<b>...</b>`. Points run one or two sentences;
  three is too long for a slide.
- Two panels per side. One looks thin, three overflows the frame.
- `cross_channel.rows` are four columns: story, X, Instagram, Facebook. Use `"—"` for a
  story that did not run on a channel, and `"not posted"` where a channel *should* have run
  it and did not — the script renders that phrase in red, so reserve it for cases you mean
  to indict.
- The gaps slide is generated from `summary.json` plus the fixed limitations in
  `references/metrics.md`. Use `extra_gaps` only when this particular week had an additional
  problem, such as a connector failing mid-pull.
