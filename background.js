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
});
