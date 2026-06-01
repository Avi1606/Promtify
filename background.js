const STORAGE_DEFAULTS = {
  apiKey: "",
  model: "gemini-2.5-flash",
  enabled: true,
  totalOptimized: 0,
  tokensSaved: 0
};

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

const SYSTEM_PROMPT =
  "You are a prompt optimization expert. Rewrite the given prompt to be clear, concise, and token-efficient while preserving the full intent. Remove filler words, redundancy, and vague language. Add output format instructions if missing. Return ONLY the optimized prompt, nothing else.";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(STORAGE_DEFAULTS, (items) => {
    chrome.storage.sync.set({
      apiKey: items.apiKey || STORAGE_DEFAULTS.apiKey,
      model: items.model || STORAGE_DEFAULTS.model,
      enabled: typeof items.enabled === "boolean" ? items.enabled : STORAGE_DEFAULTS.enabled,
      totalOptimized: Number(items.totalOptimized) || STORAGE_DEFAULTS.totalOptimized,
      tokensSaved: Number(items.tokensSaved) || STORAGE_DEFAULTS.tokensSaved
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "OPTIMIZE_PROMPT") {
    return false;
  }

  optimizePrompt(message.prompt)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((error) => sendResponse({ ok: false, error: getFriendlyError(error) }));

  // Required for async sendResponse in Manifest V3 service workers.
  return true;
});

async function optimizePrompt(userPrompt) {
  const prompt = String(userPrompt || "").trim();

  if (!prompt) {
    throw new Error("EMPTY_PROMPT");
  }

  const settings = await chromeStorageGet(STORAGE_DEFAULTS);

  if (!settings.enabled) {
    throw new Error("EXTENSION_DISABLED");
  }

  if (!settings.apiKey) {
    throw new Error("MISSING_API_KEY");
  }

  const beforeTokens = estimateTokens(prompt);
  const optimizedPrompt = await callGemini(prompt, settings.apiKey, settings.model || "gemini-2.5-flash");
  const afterTokens = estimateTokens(optimizedPrompt);
  const savedTokens = Math.max(0, beforeTokens - afterTokens);

  await chromeStorageSet({
    totalOptimized: (Number(settings.totalOptimized) || 0) + 1,
    tokensSaved: (Number(settings.tokensSaved) || 0) + savedTokens
  });

  return {
    optimizedPrompt,
    beforeTokens,
    afterTokens,
    savedTokens
  };
}

async function callGemini(userPrompt, apiKey, model) {
  const modelName = model || "gemini-2.5-flash";
  const response = await fetch(`${GEMINI_BASE}${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `${SYSTEM_PROMPT}\n\nUser prompt: ${userPrompt}`
            }
          ]
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const apiMessage = payload?.error?.message || `Gemini API returned ${response.status}.`;
    throw new Error(`API_ERROR:${apiMessage}`);
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("EMPTY_API_RESPONSE");
  }

  return text;
}

function estimateTokens(text) {
  const normalizedText = String(text || "").trim();

  if (!normalizedText) {
    return 0;
  }

  // Simple portfolio-friendly heuristic: compare punctuation/word splitting with 4-char chunks.
  const splitEstimate = normalizedText.split(/[\s,.;:!?()[\]{}"'`<>/\\|-]+/).filter(Boolean).length;
  const charEstimate = Math.ceil(normalizedText.length / 4);

  return Math.max(splitEstimate, charEstimate);
}

function getFriendlyError(error) {
  const message = error?.message || "";

  if (message === "EMPTY_PROMPT") {
    return "Type a prompt first, then optimize it.";
  }

  if (message === "EXTENSION_DISABLED") {
    return "Promptify is disabled. Turn it on from the extension popup.";
  }

  if (message === "MISSING_API_KEY") {
    return "Add your Gemini API key in the Promptify popup first.";
  }

  if (message === "EMPTY_API_RESPONSE") {
    return "Gemini returned an empty response. Try again in a moment.";
  }

  if (message.startsWith("API_ERROR:")) {
    return message.replace("API_ERROR:", "");
  }

  return "Prompt optimization failed. Please try again.";
}

function chromeStorageGet(defaults) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(defaults, resolve);
  });
}

function chromeStorageSet(values) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(values, resolve);
  });
}
