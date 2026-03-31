const enabledEl = document.getElementById("enabled");
const redirectHomeEl = document.getElementById("redirectHome");
const hideShortsEl = document.getElementById("hideShorts");
const hideAdsEl = document.getElementById("hideAds");
const hideUnsubscribedEl = document.getElementById("hideUnsubscribed");
const hideRageBaitEl = document.getElementById("hideRageBait");
const statusEl = document.getElementById("status");

// Keyword elements
const newKeywordEl = document.getElementById("newKeyword");
const addKeywordBtnEl = document.getElementById("addKeywordBtn");
const keywordListEl = document.getElementById("keywordList");
const keywordCountEl = document.getElementById("keywordCount");

// Channel whitelist elements
const newWhitelistEl = document.getElementById("newWhitelist");
const addWhitelistBtnEl = document.getElementById("addWhitelistBtn");
const whitelistListEl = document.getElementById("whitelistList");
const whitelistCountEl = document.getElementById("whitelistCount");

// Channel blacklist elements
const newBlacklistEl = document.getElementById("newBlacklist");
const addBlacklistBtnEl = document.getElementById("addBlacklistBtn");
const blacklistListEl = document.getElementById("blacklistList");
const blacklistCountEl = document.getElementById("blacklistCount");

// Rage bait elements
const newRageBaitEl = document.getElementById("newRageBait");
const addRageBaitBtnEl = document.getElementById("addRageBaitBtn");
const rageBaitListEl = document.getElementById("rageBaitList");
const rageBaitCountEl = document.getElementById("rageBaitCount");

let settings = null;

function showStatus(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ""), 2000);
}

function save() {
  chrome.storage.sync.set({ settings }, () => showStatus("Saved"));
}

// --- Generic list renderer ---

function renderList(items, listEl, countEl, onRemove) {
  listEl.innerHTML = "";
  countEl.textContent = items.length;
  items.forEach((item, i) => {
    const li = document.createElement("li");
    li.textContent = item;

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "\u00d7";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => onRemove(i));

    li.appendChild(removeBtn);
    listEl.appendChild(li);
  });
}

function renderWhitelist() {
  renderList(settings.channelWhitelist, whitelistListEl, whitelistCountEl, (i) => {
    settings.channelWhitelist.splice(i, 1);
    save();
    renderWhitelist();
  });
}

function renderBlacklist() {
  renderList(settings.channelBlacklist, blacklistListEl, blacklistCountEl, (i) => {
    settings.channelBlacklist.splice(i, 1);
    save();
    renderBlacklist();
  });
}

function renderKeywords() {
  renderList(settings.keywords, keywordListEl, keywordCountEl, (i) => {
    settings.keywords.splice(i, 1);
    save();
    renderKeywords();
  });
}

function renderRageBait() {
  renderList(settings.rageBaitPatterns, rageBaitListEl, rageBaitCountEl, (i) => {
    settings.rageBaitPatterns.splice(i, 1);
    save();
    renderRageBait();
  });
}

function addToList(inputEl, list, renderFn) {
  const val = inputEl.value.trim();
  if (!val) return;
  if (list.some((k) => k.toLowerCase() === val.toLowerCase())) {
    showStatus("Already exists");
    return;
  }
  list.push(val);
  inputEl.value = "";
  save();
  renderFn();
}

// --- Toggle listeners ---

const toggles = [
  { el: enabledEl, key: "enabled" },
  { el: redirectHomeEl, key: "redirectHome" },
  { el: hideShortsEl, key: "hideShorts" },
  { el: hideAdsEl, key: "hideAds" },
  { el: hideUnsubscribedEl, key: "hideUnsubscribed" },
  { el: hideRageBaitEl, key: "hideRageBait" }
];

toggles.forEach(({ el, key }) => {
  el.addEventListener("change", () => {
    settings[key] = el.checked;
    save();
  });
});

// --- Add buttons ---

addWhitelistBtnEl.addEventListener("click", () => addToList(newWhitelistEl, settings.channelWhitelist, renderWhitelist));
newWhitelistEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addToList(newWhitelistEl, settings.channelWhitelist, renderWhitelist);
});

addBlacklistBtnEl.addEventListener("click", () => addToList(newBlacklistEl, settings.channelBlacklist, renderBlacklist));
newBlacklistEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addToList(newBlacklistEl, settings.channelBlacklist, renderBlacklist);
});

addKeywordBtnEl.addEventListener("click", () => addToList(newKeywordEl, settings.keywords, renderKeywords));
newKeywordEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addToList(newKeywordEl, settings.keywords, renderKeywords);
});

addRageBaitBtnEl.addEventListener("click", () => addToList(newRageBaitEl, settings.rageBaitPatterns, renderRageBait));
newRageBaitEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addToList(newRageBaitEl, settings.rageBaitPatterns, renderRageBait);
});

// --- Import / Export ---

const exportBtnEl = document.getElementById("exportBtn");
const importBtnEl = document.getElementById("importBtn");
const importFileEl = document.getElementById("importFile");

exportBtnEl.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "youfilter-settings.json";
  a.click();
  URL.revokeObjectURL(url);
  showStatus("Exported");
});

importBtnEl.addEventListener("click", () => importFileEl.click());

importFileEl.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const imported = JSON.parse(ev.target.result);
      settings = imported;
      save();
      toggles.forEach(({ el, key }) => { el.checked = settings[key]; });
      renderWhitelist();
      renderBlacklist();
      renderKeywords();
      renderRageBait();
      showStatus("Imported");
    } catch {
      showStatus("Invalid JSON file");
    }
  };
  reader.readAsText(file);
  importFileEl.value = "";
});

// --- Open options page ---

document.getElementById("openOptions").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// --- Load settings on open ---

chrome.storage.sync.get("settings", (result) => {
  settings = result.settings;
  toggles.forEach(({ el, key }) => {
    el.checked = settings[key];
  });
  renderWhitelist();
  renderBlacklist();
  renderKeywords();
  renderRageBait();
});
