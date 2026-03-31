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

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get("settings", (result) => {
    if (!result.settings) {
      chrome.storage.sync.set({ settings: DEFAULT_SETTINGS });
    }
  });
  chrome.action.setBadgeBackgroundColor({ color: "#e94560" });
});

// --- Badge count from content script ---

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
  const token = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(token);
      }
    });
  });

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
  const result = await chrome.storage.sync.get("settings");
  const settings = result.settings || DEFAULT_SETTINGS;
  settings.syncedSubscriptions = channels;
  settings.lastSyncTime = Date.now();
  await chrome.storage.sync.set({ settings });

  return channels.length;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "syncSubscriptions") {
    syncSubscriptions()
      .then((count) => sendResponse({ success: true, count }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep channel open for async response
  }
});

// --- Stats tracking ---

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "updateBadge" && sender.tab?.id) {
    const text = msg.count > 0 ? String(msg.count) : "";
    chrome.action.setBadgeText({ text, tabId: sender.tab.id });
  }

  if (msg.type === "recordStat") {
    const today = new Date().toISOString().slice(0, 10);
    chrome.storage.local.get("stats", (result) => {
      const stats = result.stats || {};
      if (!stats[today]) stats[today] = { total: 0, reasons: {} };
      stats[today].total++;
      stats[today].reasons[msg.reason] = (stats[today].reasons[msg.reason] || 0) + 1;

      // Keep only last 30 days
      const keys = Object.keys(stats).sort();
      while (keys.length > 30) {
        delete stats[keys.shift()];
      }

      chrome.storage.local.set({ stats });
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "getStats") {
    chrome.storage.local.get("stats", (result) => {
      sendResponse(result.stats || {});
    });
    return true;
  }
});
