let settings = null;

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
  if (!settings?.enabled || !settings?.hideAds) return;
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

function isShorts(card) {
  if (card.querySelector("a[href*='/shorts/']")) return true;
  if (card.closest(SHORTS_SHELF_STRING)) return true;
  if (card.hasAttribute("is-shorts")) return true;
  return false;
}

function shouldHideCard(card) {
  if (!settings?.enabled) return false;

  if (settings.hideShorts && isShorts(card)) return true;
  if (settings.hideUnsubscribed && isUnsubscribedChannel(card)) return true;

  const title = getVideoTitle(card);
  if (settings.hideRageBait && isRageBait(title)) return true;
  if (matchesKeyword(title)) return true;

  return false;
}

function processCard(card) {
  if (shouldHideCard(card)) {
    card.style.display = "none";
    card.dataset.youfilterHidden = "true";
  } else if (card.dataset.youfilterHidden === "true") {
    card.style.display = "";
    delete card.dataset.youfilterHidden;
  }
}

function processShortsShelf(shelf) {
  if (!settings?.enabled || !settings?.hideShorts) {
    if (shelf.dataset.youfilterHidden === "true") {
      shelf.style.display = "";
      delete shelf.dataset.youfilterHidden;
    }
    return;
  }
  shelf.style.display = "none";
  shelf.dataset.youfilterHidden = "true";
}

function processAllVideos() {
  document.querySelectorAll(SHORTS_SHELF_STRING).forEach(processShortsShelf);
  document.querySelectorAll(SELECTOR_STRING).forEach(processCard);
  hideAds();
}

// --- MutationObserver ---

function startObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches?.(SHORTS_SHELF_STRING)) {
          processShortsShelf(node);
        }
        node.querySelectorAll?.(SHORTS_SHELF_STRING).forEach(processShortsShelf);
        if (node.matches?.(SELECTOR_STRING)) {
          processCard(node);
        }
        node.querySelectorAll?.(SELECTOR_STRING).forEach(processCard);
        // Check for ads in added nodes
        if (node.matches?.(AD_SELECTOR_STRING)) {
          if (settings?.enabled && settings?.hideAds) node.style.display = "none";
        }
        node.querySelectorAll?.(AD_SELECTOR_STRING).forEach((ad) => {
          if (settings?.enabled && settings?.hideAds) ad.style.display = "none";
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// --- Hide Shorts navigation entries and redirect /shorts ---

function hideShortsNav() {
  if (!settings?.enabled || !settings?.hideShorts) return;

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
      redirectIfHome();
      hideShortsNav();
      processAllVideos();
    }
  });
  navObserver.observe(document, { subtree: true, childList: true });
}

// --- Init ---

async function init() {
  await loadSettings();
  redirectIfHome();
  hideShortsNav();
  processAllVideos();
  startObserver();
  watchNavigation();
}

init();
