# YouTube Feed Filter - Chrome Extension Options

## Approach Options

### 1. DOM Mutation Observer (Simplest)
Inject a content script that watches for YouTube's feed elements and hides/removes videos that don't match your subscribed channels.
- Use `MutationObserver` to handle YouTube's dynamic SPA rendering
- Query the channel name on each feed card and cross-reference against a whitelist
- **Pros:** No API needed, fast, fully local
- **Cons:** Fragile to YouTube DOM changes; need to maintain the whitelist manually

### 2. YouTube Data API v3 (More Reliable Filtering)
Fetch your actual subscriptions list via Google OAuth + YouTube API, then use that as the allowlist for DOM filtering.
- **Pros:** Automatically stays in sync with your real subscriptions
- **Cons:** Requires OAuth setup, API quota limits (10,000 units/day free)

### 3. Keyword/Category Blocking (Spam/Political Filter)
Complement either approach above with a content classifier:
- Simple: regex/keyword blocklist on video titles (e.g., "Trump", "election", "SHOCKING")
- Advanced: call an LLM API (OpenAI, etc.) to classify titles — overkill for most cases

### 4. Hide Everything Except Subscriptions Page
The nuclear option — just redirect or suppress the homepage feed entirely and force the `/feed/subscriptions` view automatically.

---

## Recommended Stack

```
Manifest V3 Chrome Extension
├── content_script.js   (MutationObserver + DOM filtering)
├── background.js       (OAuth token management if using API)
├── popup.html/js       (settings UI, keyword lists)
└── manifest.json
```

---

## Recommendation

**Approach 1 + 3 combined** is the sweet spot:
- Whitelist channels via a manually curated list (or pull from YouTube API once at login)
- Add a keyword blocklist for political/rage-bait titles
- Hide non-subscription cards on the homepage feed
- Auto-redirect `youtube.com` homepage to `/feed/subscriptions`

