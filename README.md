# YouFilter

A cross-browser extension that filters unwanted content from your YouTube feed — political videos, rage bait, clickbait, Shorts, ads, and more.

## Features

- **Keyword blocking** — hide videos by title/description keywords (comes with political defaults)
- **Rage bait detection** — catches ALL CAPS titles, excessive punctuation, emoji spam, and common clickbait phrases
- **Hide Shorts** — removes Shorts shelves, navigation entries, and redirects `/shorts` URLs
- **Hide ads** — removes in-feed ad slots and promoted content
- **Hide unsubscribed channels** — only show content from channels you follow
- **Channel whitelist/blacklist** — always show or always hide specific channels
- **Homepage redirect** — auto-redirect `youtube.com` to your Subscriptions feed
- **YouTube subscription sync** — pull your subscriptions via Google OAuth to auto-whitelist them
- **Per-page filtering rules** — different filter settings for home, search, subscriptions, and watch pages
- **"Why was this hidden?" overlays** — see why a video was filtered and reveal it with one click
- **Filter badge** — icon badge shows how many videos were hidden on the current page
- **Stats dashboard** — 14-day bar chart and breakdown by filter reason
- **Import/export settings** — back up and restore your configuration as JSON

## Supported Browsers

| Browser | Status |
|---------|--------|
| Chrome  | Fully supported |
| Edge    | Fully supported (same as Chrome) |
| Firefox | Supported (MV3, requires 109+) |
| Safari  | Supported (requires Xcode wrapper) |

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+)
- A Google OAuth2 client ID (only needed for subscription sync)

### 1. Clone and install

```bash
git clone https://github.com/OhByron/YouFilter.git
cd YouFilter
npm install
```

### 2. Configure OAuth (optional, for subscription sync)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project and enable the **YouTube Data API v3**
3. Create an **OAuth client ID** (type: Chrome Extension)
4. Copy the client ID into `manifest.chrome.json`:

```json
"oauth2": {
    "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
    ...
}
```

### 3. Build

```bash
# Build for all browsers
npm run build

# Or build for a specific browser
npm run build:chrome
npm run build:firefox
npm run build:safari
```

Output goes to `dist/chrome/`, `dist/firefox/`, and `dist/safari/`.

### 4. Load the extension

**Chrome / Edge:**
1. Go to `chrome://extensions` (or `edge://extensions`)
2. Enable "Developer mode"
3. Click "Load unpacked" and select `dist/chrome/`

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select `dist/firefox/manifest.json`

**Safari:**
1. Run `xcrun safari-web-extension-converter dist/safari/` to create an Xcode project
2. Build and run from Xcode

## Usage

Click the YouFilter icon in your browser toolbar to:
- Toggle filtering on/off
- Enable/disable individual filters (Shorts, ads, rage bait, etc.)
- Manage keyword and channel lists

Click **"Open Full Settings"** in the popup for the complete options page with:
- Per-page filtering rules
- YouTube subscription sync
- Stats dashboard
- Import/export

## Project Structure

```
YouFilter/
├── manifest.base.json       # Shared manifest config
├── manifest.chrome.json     # Chrome/Edge overrides
├── manifest.firefox.json    # Firefox overrides
├── manifest.safari.json     # Safari overrides
├── build.js                 # Multi-browser build script
├── background.js            # Service worker (settings, OAuth, stats, badge)
├── content_script.js        # DOM filtering via MutationObserver
├── popup/                   # Browser action popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/                 # Full settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── icons/
```

## License

ISC
