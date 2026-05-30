const STORAGE_DEFAULTS = {
  apiKey: "",
  model: "gemini-3.5-flash",
  enabled: true,
  totalOptimized: 0,
  tokensSaved: 0
};

const apiKeyInput = document.getElementById("api-key");
const saveKeyButton = document.getElementById("save-key");
const saveStatus = document.getElementById("save-status");
const modelSelect = document.getElementById("model-select");
const enabledToggle = document.getElementById("enabled-toggle");
const totalOptimized = document.getElementById("total-optimized");
const tokensSaved = document.getElementById("tokens-saved");

document.addEventListener("DOMContentLoaded", loadPopupState);
saveKeyButton.addEventListener("click", saveApiKey);
modelSelect.addEventListener("change", saveModelSelection);
enabledToggle.addEventListener("change", saveEnabledState);

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (changes.totalOptimized) {
    totalOptimized.textContent = formatNumber(changes.totalOptimized.newValue);
  }

  if (changes.tokensSaved) {
    tokensSaved.textContent = formatNumber(changes.tokensSaved.newValue);
  }
});

function loadPopupState() {
  chrome.storage.sync.get(STORAGE_DEFAULTS, (items) => {
    apiKeyInput.value = items.apiKey || "";
    modelSelect.value = items.model || "gemini-3.5-flash";
    enabledToggle.checked = Boolean(items.enabled);
    totalOptimized.textContent = formatNumber(items.totalOptimized);
    tokensSaved.textContent = formatNumber(items.tokensSaved);
  });
}

function saveModelSelection() {
  chrome.storage.sync.set({ model: modelSelect.value }, () => {
    setStatus("Model preference saved.");
  });
}

function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();

  chrome.storage.sync.set({ apiKey }, () => {
    setStatus(apiKey ? "API key saved." : "API key cleared.");
  });
}

function saveEnabledState() {
  chrome.storage.sync.set({ enabled: enabledToggle.checked }, () => {
    setStatus(enabledToggle.checked ? "Promptify enabled." : "Promptify disabled.");
  });
}

function setStatus(message) {
  saveStatus.textContent = message;
  saveStatus.classList.add("is-visible");

  window.clearTimeout(setStatus.timeoutId);
  setStatus.timeoutId = window.setTimeout(() => {
    saveStatus.classList.remove("is-visible");
  }, 2200);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value) || 0);
}
