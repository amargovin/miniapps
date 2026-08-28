# Recorded payload fixtures

`week_2026-08-16/` holds the raw X and Meta payloads for the week ending Sunday
16 August 2026, and is what `tests/test_regression_week.py` replays to check the §9
regression table. It is **not** committed pre-populated: the numbers in that table were
measured against the live APIs, and a hand-written payload would only prove the fixture
agrees with itself.

Record it from a real run — build-order step 8:

```bash
python -m app.cli run --week-ending 2026-08-16 --force --no-notify
python -m app.cli dump-fixture <run_id> --out tests/fixtures/week_2026-08-16
```

Then add the three follower counts the run recorded to `manifest.json`, since they come
from the profile lookups rather than the paginated payloads:

```json
"followers": {"x": 342772, "instagram": 59742, "facebook": 633871}
```

Until the directory exists the regression tests skip with that command in the message.
Everything else in `tests/` runs without it.
