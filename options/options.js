const enabledEl = document.getElementById("enabled");
const redirectHomeEl = document.getElementById("redirectHome");
const hideShortsEl = document.getElementById("hideShorts");
const hideAdsEl = document.getElementById("hideAds");
const hideUnsubscribedEl = document.getElementById("hideUnsubscribed");
const hideRageBaitEl = document.getElementById("hideRageBait");
const statusEl = document.getElementById("status");

// Channel whitelist
const newWhitelistEl = document.getElementById("newWhitelist");
const addWhitelistBtnEl = document.getElementById("addWhitelistBtn");
const whitelistListEl = document.getElementById("whitelistList");

// Channel blacklist
const newBlacklistEl = document.getElementById("newBlacklist");
const addBlacklistBtnEl = document.getElementById("addBlacklistBtn");
const blacklistListEl = document.getElementById("blacklistList");

// Keywords
const newKeywordEl = document.getElementById("newKeyword");
const addKeywordBtnEl = document.getElementById("addKeywordBtn");
const keywordListEl = document.getElementById("keywordList");

// Rage bait
const newRageBaitEl = document.getElementById("newRageBait");
const addRageBaitBtnEl = document.getElementById("addRageBaitBtn");
const rageBaitListEl = document.getElementById("rageBaitList");

// Import/export
const exportBtnEl = document.getElementById("exportBtn");
const importBtnEl = document.getElementById("importBtn");
const importFileEl = document.getElementById("importFile");

let settings = null;

function showStatus(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ""), 2000);
}

function save() {
  browser.storage.sync.set({ settings }).then(() => showStatus("Saved"));
}

// --- Generic list renderer (tag style) ---

function renderList(items, listEl, onRemove) {
  listEl.innerHTML = "";
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
  renderList(settings.channelWhitelist, whitelistListEl, (i) => {
    settings.channelWhitelist.splice(i, 1);
    save();
    renderWhitelist();
  });
}

function renderBlacklist() {
  renderList(settings.channelBlacklist, blacklistListEl, (i) => {
    settings.channelBlacklist.splice(i, 1);
    save();
    renderBlacklist();
  });
}

function renderKeywords() {
  renderList(settings.keywords, keywordListEl, (i) => {
    settings.keywords.splice(i, 1);
    save();
    renderKeywords();
  });
}

function renderRageBait() {
  renderList(settings.rageBaitPatterns, rageBaitListEl, (i) => {
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

// --- Per-page rules ---

const usePageRulesEl = document.getElementById("usePageRules");
const pageRulesContainer = document.getElementById("pageRulesContainer");

usePageRulesEl.addEventListener("change", () => {
  settings.usePageRules = usePageRulesEl.checked;
  pageRulesContainer.style.display = usePageRulesEl.checked ? "block" : "none";
  save();
});

function renderPageRules() {
  if (!settings?.pageRules) return;
  usePageRulesEl.checked = settings.usePageRules || false;
  pageRulesContainer.style.display = settings.usePageRules ? "block" : "none";

  document.querySelectorAll(".page-rule").forEach((ruleDiv) => {
    const page = ruleDiv.dataset.page;
    const rules = settings.pageRules[page];
    if (!rules) return;
    ruleDiv.querySelectorAll("[data-rule]").forEach((input) => {
      input.checked = rules[input.dataset.rule] || false;
      input.addEventListener("change", () => {
        settings.pageRules[page][input.dataset.rule] = input.checked;
        save();
      });
    });
  });
}

// --- Subscription sync ---

const syncBtnEl = document.getElementById("syncBtn");
const syncStatusEl = document.getElementById("syncStatus");
const syncInfoEl = document.getElementById("syncInfo");

function updateSyncInfo() {
  if (settings?.syncedSubscriptions?.length) {
    const date = settings.lastSyncTime ? new Date(settings.lastSyncTime).toLocaleString() : "unknown";
    syncInfoEl.textContent = `${settings.syncedSubscriptions.length} subscriptions synced (last: ${date})`;
  } else {
    syncInfoEl.textContent = "No subscriptions synced yet.";
  }
}

syncBtnEl.addEventListener("click", async () => {
  syncBtnEl.disabled = true;
  syncStatusEl.textContent = "Syncing...";
  try {
    const response = await browser.runtime.sendMessage({ type: "syncSubscriptions" });
    if (response?.success) {
      syncStatusEl.textContent = `Synced ${response.count} channels`;
      const result = await browser.storage.sync.get("settings");
      settings = result.settings;
      updateSyncInfo();
    } else {
      syncStatusEl.textContent = `Error: ${response?.error || "unknown"}`;
    }
  } catch (err) {
    syncStatusEl.textContent = `Error: ${err.message}`;
  }
  syncBtnEl.disabled = false;
  setTimeout(() => (syncStatusEl.textContent = ""), 4000);
});

// --- Stats dashboard ---

async function loadStats() {
  const stats = await browser.runtime.sendMessage({ type: "getStats" });
  renderStats(stats || {});
}

function renderStats(stats) {
  const summaryEl = document.getElementById("statsSummary");
  const chartEl = document.getElementById("statsChart");
  const breakdownEl = document.getElementById("statsBreakdown");

  const days = Object.keys(stats).sort();
  const totalAll = days.reduce((sum, d) => sum + stats[d].total, 0);

  // Summary
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayCount = stats[todayKey]?.total || 0;
  summaryEl.innerHTML = `
    <div class="stat-box"><div class="stat-number">${todayCount}</div><div class="stat-label">Today</div></div>
    <div class="stat-box"><div class="stat-number">${totalAll}</div><div class="stat-label">Last 30 days</div></div>
    <div class="stat-box"><div class="stat-number">${days.length}</div><div class="stat-label">Days tracked</div></div>
  `;

  // Bar chart (last 14 days)
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    last14.push({ date: key, count: stats[key]?.total || 0 });
  }
  const maxCount = Math.max(...last14.map((d) => d.count), 1);

  chartEl.innerHTML = last14.map((d) => {
    const height = Math.max(2, (d.count / maxCount) * 100);
    const label = d.date.slice(5); // MM-DD
    return `<div class="chart-bar-wrap" title="${d.date}: ${d.count}">
      <div class="chart-bar" style="height:${height}%"></div>
      <div class="chart-label">${label}</div>
    </div>`;
  }).join("");

  // Reason breakdown
  const reasonTotals = {};
  days.forEach((d) => {
    const reasons = stats[d].reasons || {};
    for (const [r, c] of Object.entries(reasons)) {
      reasonTotals[r] = (reasonTotals[r] || 0) + c;
    }
  });

  const sorted = Object.entries(reasonTotals).sort((a, b) => b[1] - a[1]);
  if (sorted.length) {
    breakdownEl.innerHTML = "<h3>By Reason</h3>" + sorted.map(([reason, count]) =>
      `<div class="reason-row"><span>${reason}</span><span class="reason-count">${count}</span></div>`
    ).join("");
  } else {
    breakdownEl.innerHTML = "<p class='hint'>No data yet.</p>";
  }
}

// --- Import / Export ---

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

// --- Load settings ---

browser.storage.sync.get("settings").then((result) => {
  settings = result.settings;
  toggles.forEach(({ el, key }) => {
    el.checked = settings[key];
  });
  renderPageRules();
  renderWhitelist();
  renderBlacklist();
  renderKeywords();
  renderRageBait();
  updateSyncInfo();
  loadStats();
});
