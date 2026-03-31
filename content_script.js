let settings = null;
let hiddenCount = 0;

function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get("settings", (result) => {
      settings = result.settings;
      resolve(settings);
    });
  });
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    settings = changes.settings.newValue;
    processAllVideos();
    hideShortsNav();
  }
});

// --- Stats tracking ---

function recordStat(reason) {
  chrome.runtime.sendMessage({ type: "recordStat", reason });
}

// --- Badge count ---

function updateBadge() {
  chrome.runtime.sendMessage({ type: "updateBadge", count: hiddenCount });
}

function resetHiddenCount() {
  hiddenCount = 0;
  updateBadge();
}

// --- Page context detection ---

function getPageContext() {
  const path = window.location.pathname;
  if (path === "/" || path === "/feed") return "home";
  if (path === "/feed/subscriptions") return "subscriptions";
  if (path === "/results") return "search";
  if (path.startsWith("/watch") || path.startsWith("/shorts")) return "watch";
  return "home";
}

function getEffectiveSetting(key) {
  if (!settings?.usePageRules || !settings?.pageRules) return settings?.[key];
  const context = getPageContext();
  const rule = settings.pageRules[context];
  if (rule && key in rule) return rule[key];
  return settings?.[key];
}

// --- Redirect homepage to subscriptions feed ---

function redirectIfHome() {
  if (!settings?.redirectHome) return;
  const path = window.location.pathname;
  if (path === "/" || path === "/feed") {
    window.location.replace("https://www.youtube.com/feed/subscriptions");
  }
}

// --- Keyword filtering ---

function matchesKeyword(text) {
  if (!text || !settings?.keywords?.length) return false;
  const lower = text.toLowerCase();
  return settings.keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// --- Rage bait / slop detection ---

function isRageBait(title) {
  if (!title) return false;
  const lower = title.toLowerCase();

  // Check rage bait phrase patterns
  if (settings?.rageBaitPatterns?.length) {
    if (settings.rageBaitPatterns.some((p) => lower.includes(p.toLowerCase()))) {
      return true;
    }
  }

  // ALL CAPS title (4+ words all uppercase)
  const words = title.split(/\s+/);
  if (words.length >= 4 && words.every((w) => w === w.toUpperCase() && /[A-Z]/.test(w))) {
    return true;
  }

  // Excessive punctuation: 3+ exclamation/question marks
  if (/[!?]{3,}/.test(title)) return true;

  // Emoji spam: 3+ emojis in title
  const emojiCount = (title.match(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/gu) || []).length;
  if (emojiCount >= 3) return true;

  return false;
}

// --- Ad detection ---

const AD_SELECTORS = [
  "ytd-ad-slot-renderer",
  "ytd-promoted-sparkles-web-renderer",
  "ytd-display-ad-renderer",
  "ytd-banner-promo-renderer",
  "ytd-promoted-video-renderer",
  "ytd-in-feed-ad-layout-renderer",
  "ytd-action-companion-ad-renderer",
  "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']"
];

const AD_SELECTOR_STRING = AD_SELECTORS.join(", ");

function hideAds() {
  if (!settings?.enabled || !getEffectiveSetting("hideAds")) return;
  document.querySelectorAll(AD_SELECTOR_STRING).forEach((ad) => {
    ad.style.display = "none";
  });

  // Also hide cards with ad badges
  document.querySelectorAll("ytd-rich-item-renderer, ytd-video-renderer").forEach((card) => {
    const badge = card.querySelector(".badge-style-type-ad, [class*='ad-badge'], ytd-ad-slot-renderer");
    const adLabel = card.querySelector("span.ytd-badge-supported-renderer");
    if (badge || (adLabel && adLabel.textContent?.trim() === "Ad")) {
      card.style.display = "none";
    }
  });
}

// --- Unsubscribed channel detection ---

function isUnsubscribedChannel(card) {
  // On the subscriptions feed, everything is subscribed — skip check
  if (window.location.pathname === "/feed/subscriptions") return false;

  // Look for the subscribe button — if it says "Subscribe" (not "Subscribed"), it's unsubscribed
  const subscribeBtn = card.querySelector("ytd-subscribe-button-renderer, tp-yt-paper-button.ytd-subscribe-button-renderer");
  if (subscribeBtn) {
    const btnText = subscribeBtn.textContent?.trim().toLowerCase();
    if (btnText === "subscribe") return true;
  }

  // Check for notification bell (indicates subscribed)
  const bell = card.querySelector("ytd-subscription-notification-toggle-button-renderer");
  // If there's a subscribe button area but no bell, likely unsubscribed
  if (subscribeBtn && !bell) return true;

  return false;
}

// --- Selectors ---

const VIDEO_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-compact-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-reel-item-renderer",
  "ytd-rich-grid-slim-media"
];

const SHORTS_SHELF_SELECTORS = [
  "ytd-rich-shelf-renderer",
  "ytd-reel-shelf-renderer"
];

const SELECTOR_STRING = VIDEO_SELECTORS.join(", ");
const SHORTS_SHELF_STRING = SHORTS_SHELF_SELECTORS.join(", ");

// --- Card processing ---

function getVideoTitle(card) {
  const titleEl =
    card.querySelector("#video-title") ||
    card.querySelector("#video-title-link") ||
    card.querySelector(".title");
  return titleEl?.textContent?.trim() ?? "";
}

function getChannelName(card) {
  const channelEl =
    card.querySelector("#channel-name #text") ||
    card.querySelector("#channel-name a") ||
    card.querySelector("ytd-channel-name #text") ||
    card.querySelector("ytd-channel-name a") ||
    card.querySelector(".ytd-channel-name a");
  return channelEl?.textContent?.trim() ?? "";
}

function isWhitelistedChannel(card) {
  const channel = getChannelName(card);
  if (!channel) return false;
  const lower = channel.toLowerCase();
  if (settings?.channelWhitelist?.some((w) => lower === w.toLowerCase())) return true;
  if (settings?.syncedSubscriptions?.some((s) => lower === s.toLowerCase())) return true;
  return false;
}

function isBlacklistedChannel(card) {
  if (!settings?.channelBlacklist?.length) return false;
  const channel = getChannelName(card);
  if (!channel) return false;
  return settings.channelBlacklist.some((b) => channel.toLowerCase() === b.toLowerCase());
}

function getVideoDescription(card) {
  const descEl =
    card.querySelector("#description-text") ||
    card.querySelector(".metadata-snippet-text") ||
    card.querySelector("yt-formatted-string.metadata-snippet-text");
  return descEl?.textContent?.trim() ?? "";
}

function isShorts(card) {
  if (card.querySelector("a[href*='/shorts/']")) return true;
  if (card.closest(SHORTS_SHELF_STRING)) return true;
  if (card.hasAttribute("is-shorts")) return true;
  return false;
}

function getHideReason(card) {
  if (!settings?.enabled) return null;

  // Whitelisted channels always pass
  if (isWhitelistedChannel(card)) return null;

  // Blacklisted channels always hidden
  if (isBlacklistedChannel(card)) return "Blacklisted channel";

  if (getEffectiveSetting("hideShorts") && isShorts(card)) return "Shorts";
  if (getEffectiveSetting("hideUnsubscribed") && isUnsubscribedChannel(card)) return "Unsubscribed channel";

  const title = getVideoTitle(card);
  const description = getVideoDescription(card);
  if (getEffectiveSetting("hideRageBait") && (isRageBait(title) || isRageBait(description))) return "Rage bait";

  const keywordsActive = settings?.usePageRules ? getEffectiveSetting("keywords") : true;
  if (keywordsActive && (matchesKeyword(title) || matchesKeyword(description))) return "Blocked keyword";

  return null;
}

function createOverlay(reason, card) {
  const overlay = document.createElement("div");
  overlay.className = "youfilter-overlay";
  overlay.innerHTML = `<span class="youfilter-overlay-text">Hidden: ${reason}</span><button class="youfilter-show-btn">Show</button>`;
  overlay.querySelector(".youfilter-show-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    card.style.display = "";
    card.dataset.youfilterRevealed = "true";
    overlay.remove();
  });
  return overlay;
}

function processCard(card) {
  // If user manually revealed, leave it alone
  if (card.dataset.youfilterRevealed === "true") return;

  const reason = getHideReason(card);
  if (reason) {
    if (card.dataset.youfilterHidden !== "true") {
      hiddenCount++;
      recordStat(reason);
    }
    card.style.display = "none";
    card.dataset.youfilterHidden = "true";
    card.dataset.youfilterReason = reason;

    // Insert overlay placeholder if not already present
    if (!card.previousElementSibling?.classList.contains("youfilter-overlay")) {
      const overlay = createOverlay(reason, card);
      card.parentNode.insertBefore(overlay, card);
    }
  } else if (card.dataset.youfilterHidden === "true") {
    hiddenCount = Math.max(0, hiddenCount - 1);
    card.style.display = "";
    delete card.dataset.youfilterHidden;
    delete card.dataset.youfilterReason;
    // Remove overlay if present
    if (card.previousElementSibling?.classList.contains("youfilter-overlay")) {
      card.previousElementSibling.remove();
    }
  }
}

function processShortsShelf(shelf) {
  if (!settings?.enabled || !getEffectiveSetting("hideShorts")) {
    if (shelf.dataset.youfilterHidden === "true") {
      hiddenCount = Math.max(0, hiddenCount - 1);
      shelf.style.display = "";
      delete shelf.dataset.youfilterHidden;
    }
    return;
  }
  if (shelf.dataset.youfilterHidden !== "true") {
    hiddenCount++;
  }
  shelf.style.display = "none";
  shelf.dataset.youfilterHidden = "true";
}

function processAllVideos() {
  hiddenCount = 0;
  document.querySelectorAll(SHORTS_SHELF_STRING).forEach(processShortsShelf);
  document.querySelectorAll(SELECTOR_STRING).forEach(processCard);
  hideAds();
  updateBadge();
}

// --- MutationObserver ---

function startObserver() {
  const observer = new MutationObserver((mutations) => {
    let changed = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.(SHORTS_SHELF_STRING)) {
          processShortsShelf(node);
          changed = true;
        }
        node.querySelectorAll?.(SHORTS_SHELF_STRING).forEach((n) => { processShortsShelf(n); changed = true; });
        if (node.matches?.(SELECTOR_STRING)) {
          processCard(node);
          changed = true;
        }
        node.querySelectorAll?.(SELECTOR_STRING).forEach((n) => { processCard(n); changed = true; });
        // Check for ads in added nodes
        if (node.matches?.(AD_SELECTOR_STRING)) {
          if (settings?.enabled && settings?.hideAds) node.style.display = "none";
        }
        node.querySelectorAll?.(AD_SELECTOR_STRING).forEach((ad) => {
          if (settings?.enabled && settings?.hideAds) ad.style.display = "none";
        });
      }
    }
    if (changed) updateBadge();
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// --- Hide Shorts navigation entries and redirect /shorts ---

function hideShortsNav() {
  if (!settings?.enabled || !getEffectiveSetting("hideShorts")) return;

  if (window.location.pathname.startsWith("/shorts")) {
    window.location.replace("https://www.youtube.com/feed/subscriptions");
    return;
  }

  document.querySelectorAll("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer").forEach((entry) => {
    const title = entry.querySelector("yt-formatted-string, .title")?.textContent?.trim();
    if (title === "Shorts") {
      entry.style.display = "none";
    }
  });

  document.querySelectorAll("yt-tab-shape, tp-yt-paper-tab").forEach((tab) => {
    if (tab.textContent?.trim() === "Shorts") {
      tab.style.display = "none";
    }
  });
}

// --- SPA navigation handling ---

let lastUrl = location.href;
function watchNavigation() {
  const navObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      resetHiddenCount();
      redirectIfHome();
      hideShortsNav();
      processAllVideos();
    }
  });
  navObserver.observe(document, { subtree: true, childList: true });
}

// --- Init ---

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .youfilter-overlay {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      margin: 4px 0;
      background: #1a1a2e;
      border: 1px solid #333;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      color: #888;
    }
    .youfilter-overlay-text {
      flex: 1;
    }
    .youfilter-show-btn {
      background: none;
      border: 1px solid #555;
      border-radius: 4px;
      color: #aaa;
      padding: 2px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .youfilter-show-btn:hover {
      border-color: #e94560;
      color: #e94560;
    }
  `;
  document.head.appendChild(style);
}

async function init() {
  await loadSettings();
  injectStyles();
  redirectIfHome();
  hideShortsNav();
  processAllVideos();
  startObserver();
  watchNavigation();
}

init();
