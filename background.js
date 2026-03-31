const DEFAULT_SETTINGS = {
  enabled: true,
  redirectHome: true,
  hideShorts: true,
  hideAds: true,
  hideUnsubscribed: false,
  hideRageBait: true,
  keywords: [
    "trump", "biden", "election", "democrat", "republican",
    "liberal", "conservative", "maga", "woke", "politics",
    "congress", "senator", "political", "left wing", "right wing",
    "GOP", "DNC", "impeach", "mandate", "ballot"
  ],
  pageRules: {
    home:          { hideShorts: true, hideAds: true, hideRageBait: true, hideUnsubscribed: false, keywords: true },
    search:        { hideShorts: true, hideAds: true, hideRageBait: true, hideUnsubscribed: false, keywords: true },
    subscriptions: { hideShorts: true, hideAds: true, hideRageBait: false, hideUnsubscribed: false, keywords: true },
    watch:         { hideShorts: true, hideAds: true, hideRageBait: true, hideUnsubscribed: false, keywords: true }
  },
  usePageRules: false,
  channelWhitelist: [],
  channelBlacklist: [],
  rageBaitPatterns: [
    "you won't believe",
    "shocking",
    "destroyed",
    "exposed",
    "goes wrong",
    "i can't believe",
    "this is why",
    "watch before deleted",
    "they don't want you to know",
    "mainstream media",
    "wake up",
    "the truth about",
    "what they're hiding",
    "is over",
    "it's happening",
    "breaking:",
    "urgent:",
    "jaw dropping",
    "mind blowing",
    "not clickbait",
    "gone too far",
    "slams",
    "owned",
    "obliterated",
    "claps back"
  ]
};

browser.runtime.onInstalled.addListener(async () => {
  const result = await browser.storage.sync.get("settings");
  if (!result.settings) {
    await browser.storage.sync.set({ settings: DEFAULT_SETTINGS });
  }
  browser.action.setBadgeBackgroundColor({ color: "#e94560" });
});

// --- Cross-browser OAuth helper ---

async function getOAuthToken() {
  // Chrome/Edge: use chrome.identity.getAuthToken
  if (typeof chrome !== "undefined" && chrome.identity?.getAuthToken) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: true }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(token);
        }
      });
    });
  }

  // Firefox/Safari: use browser.identity.launchWebAuthFlow
  const manifest = browser.runtime.getManifest();
  const clientId = manifest.oauth2?.client_id;
  if (!clientId) throw new Error("No OAuth2 client_id configured in manifest");

  const redirectUrl = browser.identity.getRedirectURL();
  const scopes = encodeURIComponent("https://www.googleapis.com/auth/youtube.readonly");
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=token` +
    `&redirect_uri=${encodeURIComponent(redirectUrl)}` +
    `&scope=${scopes}`;

  const responseUrl = await browser.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true
  });

  const token = new URL(responseUrl.replace("#", "?")).searchParams.get("access_token");
  if (!token) throw new Error("Failed to extract access token from OAuth response");
  return token;
}

// --- YouTube subscription sync ---

async function fetchSubscriptions(token, pageToken = "") {
  const url = new URL("https://www.googleapis.com/youtube/v3/subscriptions");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "50");
  if (pageToken) url.searchParams.set("pageToken", pageToken);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error(`YouTube API error: ${res.status}`);
  }

  return res.json();
}

async function syncSubscriptions() {
  const token = await getOAuthToken();

  const channels = [];
  let pageToken = "";

  do {
    const data = await fetchSubscriptions(token, pageToken);
    for (const item of data.items) {
      channels.push(item.snippet.title);
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  // Update settings with synced subscriptions
  const result = await browser.storage.sync.get("settings");
  const settings = result.settings || DEFAULT_SETTINGS;
  settings.syncedSubscriptions = channels;
  settings.lastSyncTime = Date.now();
  await browser.storage.sync.set({ settings });

  return channels.length;
}

// --- Message handler (single listener) ---

browser.runtime.onMessage.addListener((msg, sender) => {
  // Badge update
  if (msg.type === "updateBadge" && sender.tab?.id) {
    const text = msg.count > 0 ? String(msg.count) : "";
    browser.action.setBadgeText({ text, tabId: sender.tab.id });
    return;
  }

  // Record stat
  if (msg.type === "recordStat") {
    const today = new Date().toISOString().slice(0, 10);
    browser.storage.local.get("stats").then((result) => {
      const stats = result.stats || {};
      if (!stats[today]) stats[today] = { total: 0, reasons: {} };
      stats[today].total++;
      stats[today].reasons[msg.reason] = (stats[today].reasons[msg.reason] || 0) + 1;

      // Keep only last 30 days
      const keys = Object.keys(stats).sort();
      while (keys.length > 30) {
        delete stats[keys.shift()];
      }

      browser.storage.local.set({ stats });
    });
    return;
  }

  // Sync subscriptions (async — return a promise)
  if (msg.type === "syncSubscriptions") {
    return syncSubscriptions()
      .then((count) => ({ success: true, count }))
      .catch((err) => ({ success: false, error: err.message }));
  }

  // Get stats (async — return a promise)
  if (msg.type === "getStats") {
    return browser.storage.local.get("stats").then((result) => result.stats || {});
  }
});
