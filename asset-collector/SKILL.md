---
name: asset-collector
description: Collect visual assets from multiple sources. Claude handles all AI analysis and decision-making directly. Utility scripts handle downloading, searching, and screenshotting. Triggers on "get assets", "screenshot this", "download video", "find images", "collect visuals".
---

# Asset Collector Skill

Collects visual assets from multiple sources. **Claude (Opus) handles all AI work directly** - analysis, decisions, and image prompt generation. Scripts are utilities only.

## Philosophy

| Task | Who Does It |
|------|-------------|
| Analyze VO, decide what assets needed | **Claude directly** |
| Search YouTube | `youtube_search.py` (utility) |
| Download videos | `video_clip.py` (utility) |
| Scout video segments | `video_scout.py` (utility) |
| Take screenshots | `screenshot.py` (utility) |
| Find stock images | `asset_finder.py` (utility) |
| Generate image prompts | **Claude directly** |
| Decide if assets are sufficient | **Claude directly** |

**No external AI APIs.** Claude is the AI.

---

## First Run Setup

```bash
# Install Python dependencies
pip install -r requirements.txt --break-system-packages -q

# Install Deno (required for YouTube downloads)
curl -fsSL https://deno.land/install.sh | sh
export PATH="$HOME/.deno/bin:$PATH"

# Install Playwright for screenshots
playwright install chromium --with-deps
```

---

## Output Location

**When used with video-producer skill:**
```
~/Desktop/[project-name]/assets/scene_XX/
```

**Standalone usage:**
```
./assets/scene_XX/
```

---

## Utility Scripts

| Script | Purpose | Example |
|--------|---------|---------|
| `youtube_search.py` | Search YouTube | `python scripts/youtube_search.py Modi budget speech` |
| `video_clip.py` | Download video/frames | `python scripts/video_clip.py --url "URL" --output clip.mp4` |
| `video_scout.py` | Find relevant timestamps | `python scripts/video_scout.py --url "URL" --keywords budget` |
| `screenshot.py` | Capture web pages | `python scripts/screenshot.py --url "URL" --output page.png` |
| `asset_finder.py` | Find stock images | `python scripts/asset_finder.py --query "shipping containers" --output img.jpg` |

---

## Workflow

### Step 1: Claude Analyzes the VO

**Claude reads the voiceover and identifies:**

```
For each scene, Claude determines:
- WHO: People/organizations mentioned
- WHAT: Actions/events/topics
- SOURCES: Publications cited (Reuters, @WhiteHouse, etc.)
- VISUAL NEEDS: What images/videos would illustrate this

Example:
  VO: "Modi announced the Union Budget at Parliament, drawing criticism from opposition leaders"
  
  Claude's analysis:
  - WHO: Modi, opposition leaders
  - WHAT: Budget announcement, criticism
  - SOURCES: Parliament (official)
  - VISUAL NEEDS: 
    1. Modi speaking at Parliament (video)
    2. Parliament building/interior (video or image)
    3. Opposition reaction (video)
    4. Budget document visual (screenshot or image)
```

### Step 2: Claude Searches for Videos

```bash
python scripts/youtube_search.py Modi Union Budget Parliament speech
```

**Claude reviews the results and presents to user:**

```
Found 10 YouTube videos:

| # | Duration | Channel | Title |
|---|----------|---------|-------|
| 1 | 45:23 | PMO India | PM Modi's Full Budget Speech 2024 |
| 2 | 3:45 | NDTV | Modi Budget Highlights |
| 3 | 12:30 | Reuters | India Budget Announcement |
...

Which videos should I download? (e.g., "1, 2, 4")
```

### Step 3: Claude Scouts Long Videos

For videos >5 minutes, Claude scouts for relevant segments:

```bash
python scripts/video_scout.py --url "https://youtube.com/watch?v=ABC" --keywords budget announcement
```

**Claude presents segment options:**

```
Video: "PM Modi's Full Budget Speech" (45:23)

| # | Timestamp | Context | Suggested Clip |
|---|-----------|---------|----------------|
| 1 | 12:34 | "presenting the Union Budget..." | 12:00 - 13:30 |
| 2 | 23:45 | "infrastructure spending..." | 23:15 - 24:45 |

Which segments? (e.g., "1, 2" or "all")
```

### Step 4: Claude Downloads Selected Videos

```bash
# Short video - full
python scripts/video_clip.py --url "URL" --output scene_01/clip_01.mp4

# Long video - segment only
python scripts/video_clip.py --url "URL" --start "12:00" --end "13:30" --output scene_01/clip_02.mp4

# Extract frames
python scripts/video_clip.py --url "URL" --extract-frame "00:00:05" --output scene_01/frame_01.png
```

### Step 5: Claude Searches for Screenshots

Claude uses web search to find relevant URLs, then presents options:

```
Found URLs for screenshots:

| # | Type | Source | URL |
|---|------|--------|-----|
| 1 | Tweet | @PMOIndia | https://x.com/PMOIndia/status/... |
| 2 | Tweet | @Reuters | https://x.com/Reuters/status/... |
| 3 | Article | BBC | https://bbc.com/news/india-budget... |
| 4 | Official | PIB | https://pib.gov.in/budget2024... |

Which should I screenshot? (e.g., "1, 3, 4")
```

### Step 6: Claude Captures Screenshots

```bash
python scripts/screenshot.py --url "https://x.com/PMOIndia/status/123" --type tweet --output scene_01/tweet_01.png
python scripts/screenshot.py --url "https://bbc.com/article" --type headline --output scene_01/headline_01.png
```

### Step 7: Claude Handles Image Needs

**For images, Claude has three options:**

#### Option A: Find Stock Images

```bash
python scripts/asset_finder.py --query "Indian Parliament building" --output scene_01/parliament.jpg
python scripts/asset_finder.py --query "budget documents spreadsheet" --output scene_01/budget_docs.jpg
```

#### Option B: Generate Image Prompts

If stock images don't fit, Claude generates detailed prompts:

```
IMAGE PROMPT for scene_01/ai_01:

"Indian Parliament interior, Lok Sabha chamber, wide shot showing 
semicircular seating arrangement, ornate wooden architecture, 
members seated, warm lighting, photorealistic style, 16:9 aspect ratio"

User can generate this image using:
- DALL-E
- Midjourney
- Stable Diffusion
- Or any image generation tool
```

#### Option C: Use Artifacts (if available)

If Claude has artifact capabilities, it can create:
- SVG illustrations
- React-based visualizations
- Mermaid diagrams

### Step 8: Claude Reviews Scene Assets

```
Scene 01 Assets Collected:

| Type | Count | Files |
|------|-------|-------|
| Videos | 3 | clip_01.mp4, clip_02.mp4, clip_03.mp4 |
| Frames | 6 | frame_01.png ... frame_06.png |
| Screenshots | 2 | tweet_01.png, headline_01.png |
| Stock Images | 2 | parliament.jpg, budget_docs.jpg |
| **Total** | **13** | |

Sufficient for this scene? 
- "yes" → next scene
- "need more videos" → search again
- "need more images" → find stock or generate prompts
```

### Step 9: Final Review

```
Asset Collection Complete:

| Scene | Videos | Frames | Screenshots | Images | Total |
|-------|--------|--------|-------------|--------|-------|
| 01 | 3 | 6 | 2 | 2 | 13 |
| 02 | 2 | 4 | 1 | 3 | 10 |
| 03 | 3 | 6 | 1 | 2 | 12 |

Total: 35 assets

Ready to finalize? ("yes" / "revisit scene X")
```

---

## Quick Reference

```bash
# YouTube search
python scripts/youtube_search.py [keywords]

# Video download (full)
python scripts/video_clip.py --url "URL" --output clip.mp4

# Video download (segment)
python scripts/video_clip.py --url "URL" --start "12:00" --end "13:30" --output clip.mp4

# Extract frame
python scripts/video_clip.py --url "URL" --extract-frame "00:00:05" --output frame.png

# Scout long video
python scripts/video_scout.py --url "URL" --keywords [terms]

# Screenshot tweet
python scripts/screenshot.py --url "https://x.com/user/status/123" --type tweet --output tweet.png

# Screenshot headline
python scripts/screenshot.py --url "https://bbc.com/article" --type headline --output headline.png

# Find stock image
python scripts/asset_finder.py --query "description" --output image.jpg
```

---

## Claude's Role (Summary)

| Task | Claude Does This Directly |
|------|---------------------------|
| Read and analyze VO | ✓ Identifies who, what, visual needs |
| Decide what assets to search for | ✓ Makes judgment calls |
| Review search results | ✓ Evaluates relevance |
| Present options to user | ✓ Formats tables, asks questions |
| Generate image prompts | ✓ Writes detailed descriptions |
| Assess if scene has enough assets | ✓ Counts, evaluates coverage |
| Decide when to move to next scene | ✓ Based on user feedback |

**Scripts just fetch, download, capture.** Claude is the intelligence.

---

## Image Strategy

Since Claude doesn't generate images directly, use this priority:

| Priority | Method | When to Use |
|----------|--------|-------------|
| 1 | Stock images | Generic visuals (buildings, objects, crowds) |
| 2 | Screenshots | Specific sources (tweets, articles, official pages) |
| 3 | Video frames | Person-specific visuals |
| 4 | Image prompts | Custom scenes that don't exist (user generates externally) |

### Stock Image Search

```bash
# Searches Wikimedia Commons and Pexels
python scripts/asset_finder.py --query "cargo ship port containers" --output shipping.jpg
python scripts/asset_finder.py --query "stock market trading floor" --output trading.jpg
```

### Image Prompt Generation

When stock images won't work, Claude writes detailed prompts:

```
PROMPT: "Donald Trump at White House podium, press briefing room, 
American flags in background, dramatic lighting, photojournalistic style"

PROMPT: "Split screen showing US and China flags with trade war imagery,
cargo ships, tariff symbols, tense atmosphere, news graphic style"
```

User takes these prompts to their preferred image generator.

---

## Checkpoints (5 Total)

| # | Checkpoint | User Decides |
|---|------------|--------------|
| 1 | Video Selection | Which YouTube videos to download |
| 2 | Segment Selection | Which parts of long videos |
| 3 | Screenshot Selection | Which URLs to capture |
| 4 | Scene Review | Enough assets or need more |
| 5 | Final Review | Done or revisit scenes |

---

## ASSETS.md Format

Each scene folder gets an ASSETS.md:

```markdown
# Scene 01: Budget Announcement

| File | Source | Notes |
|------|--------|-------|
| clip_01.mp4 | https://youtube.com/watch?v=ABC | PMO India official |
| clip_02.mp4 | https://youtube.com/watch?v=DEF | Segment 12:00-13:30 |
| frame_01.png | (from clip_01) | |
| tweet_01.png | https://x.com/PMOIndia/status/123 | Official announcement |
| parliament.jpg | Wikimedia Commons | Stock image |

## Image Prompts (for external generation)
| Filename | Prompt |
|----------|--------|
| ai_01.png | "Modi at podium, Parliament interior, dramatic lighting..." |
```

---

## Troubleshooting

### Deno Not Found
```bash
export PATH="$HOME/.deno/bin:$PATH"
```

### YouTube Search Returns Nothing
Simplify keywords:
```bash
# Too specific
python scripts/youtube_search.py Modi Union Budget 2024 Parliament February announcement

# Better
python scripts/youtube_search.py Modi budget speech
```

### Screenshot Fails (Paywall)
Skip and note in ASSETS.md, or screenshot just the headline.

### No Good Stock Images
Claude generates a detailed prompt for user to create externally.

---

## Requirements

```
yt-dlp
youtube-transcript-api
playwright
requests
```

**No AI API dependencies.** Claude is the AI.
