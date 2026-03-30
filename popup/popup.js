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

addKeywordBtnEl.addEventListener("click", () => addToList(newKeywordEl, settings.keywords, renderKeywords));
newKeywordEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addToList(newKeywordEl, settings.keywords, renderKeywords);
});

addRageBaitBtnEl.addEventListener("click", () => addToList(newRageBaitEl, settings.rageBaitPatterns, renderRageBait));
newRageBaitEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") addToList(newRageBaitEl, settings.rageBaitPatterns, renderRageBait);
});

// --- Load settings on open ---

chrome.storage.sync.get("settings", (result) => {
  settings = result.settings;
  toggles.forEach(({ el, key }) => {
    el.checked = settings[key];
  });
  renderKeywords();
  renderRageBait();
});
