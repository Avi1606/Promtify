const PROMPT_SELECTORS = [
  "#prompt-textarea",
  "textarea[data-testid='prompt-textarea']",
  "textarea[placeholder*='Message']",
  "div[contenteditable='true'][id='prompt-textarea']",
  "div.ProseMirror[contenteditable='true']",
  "[contenteditable='true'][data-virtualkeyboard]"
];

const BUTTON_ID = "promptify-optimize-button";
const STYLE_ID = "promptify-content-styles";
const SPARKLE = "\u2728";

let isOptimizing = false;
let attachTimer = null;

boot();

function boot() {
  if (!document.body) {
    window.setTimeout(boot, 100);
    return;
  }

  injectStyles();
  observeComposer();
  attachOptimizeButton();
}

function observeComposer() {
  const observer = new MutationObserver(() => queueAttachOptimizeButton());
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("focus", queueAttachOptimizeButton);
  window.addEventListener("popstate", queueAttachOptimizeButton);
}

function queueAttachOptimizeButton() {
  window.clearTimeout(attachTimer);
  attachTimer = window.setTimeout(attachOptimizeButton, 120);
}

function attachOptimizeButton() {
  const promptInput = findPromptInput();

  if (!promptInput) {
    return;
  }

  const sendButton = findSendButton(promptInput);
  const host = findButtonHost(promptInput, sendButton);

  if (!host) {
    return;
  }

  const button = document.getElementById(BUTTON_ID) || createOptimizeButton();

  // Determine the correct sibling element to insert the optimize button before.
  // If the host is the direct parent of the send button, insert before sendButton.
  // If the host is the grandparent, insert before sendButton's parent wrapper.
  let referenceElement = sendButton;
  if (sendButton && sendButton.parentElement !== host) {
    if (sendButton.parentElement?.parentElement === host) {
      referenceElement = sendButton.parentElement;
    } else {
      referenceElement = null;
    }
  }

  if (referenceElement && referenceElement.parentElement === host) {
    if (button.parentElement !== host || button.nextElementSibling !== referenceElement) {
      host.insertBefore(button, referenceElement);
      return;
    }
  } else {
    if (button.parentElement !== host) {
      host.appendChild(button);
    }
  }
}

function createOptimizeButton() {
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.className = "promptify-button";
  button.title = "Optimize prompt with Gemini";
  button.setAttribute("aria-label", "Optimize prompt with Gemini");
  button.addEventListener("click", handleOptimizeClick);
  setButtonContent(button, false);
  return button;
}

async function handleOptimizeClick() {
  if (isOptimizing) {
    return;
  }

  const promptInput = findPromptInput();
  const prompt = getPromptValue(promptInput);

  if (!prompt.trim()) {
    showToast("Type a prompt first, then optimize it.", "warning");
    return;
  }

  setLoadingState(true);

  try {
    const response = await chrome.runtime.sendMessage({
      type: "OPTIMIZE_PROMPT",
      prompt
    });

    if (!response?.ok) {
      showToast(response?.error || "Prompt optimization failed.", "error");
      return;
    }

    setPromptValue(promptInput, response.optimizedPrompt);
    addTextareaGlow(promptInput);
    showToast(`Prompt optimized! Saved ~${response.savedTokens} tokens`, "success");
  } catch (_error) {
    showToast("Promptify could not reach the extension service worker. Reload the extension and this ChatGPT tab.", "error");
  } finally {
    setLoadingState(false);
  }
}

function findPromptInput() {
  for (const selector of PROMPT_SELECTORS) {
    const input = document.querySelector(selector);

    if (input && isVisible(input)) {
      return input;
    }
  }

  return null;
}

function findSendButton(promptInput) {
  const form = promptInput.closest("form");
  const scope = form || document;
  const buttons = [...scope.querySelectorAll("button")].filter(isVisible);

  // 1. Search for explicit send button first (primary anchor)
  const sendBtn =
    buttons.find((button) => button.dataset.testid === "send-button") ||
    buttons.find((button) => button.getAttribute("aria-label")?.toLowerCase().includes("send"));

  if (sendBtn) {
    return sendBtn;
  }

  // 2. If send button is hidden (empty composer), search for voice/waveform button on the right
  const rightBtn =
    buttons.find((button) => button.dataset.testid === "voice-button") ||
    buttons.find((button) => button.dataset.testid === "speech-button") ||
    buttons.find((button) => button.getAttribute("aria-label")?.toLowerCase().includes("voice")) ||
    buttons.find((button) => button.getAttribute("aria-label")?.toLowerCase().includes("speech")) ||
    buttons.find((button) => button.getAttribute("aria-label")?.toLowerCase().includes("dictate")) ||
    buttons.find((button) => button.dataset.testid === "audio-button");

  if (rightBtn) {
    return rightBtn;
  }

  // 3. Fallback to any button on the right side of the form (excluding attachment buttons)
  const formRect = form?.getBoundingClientRect();
  if (formRect) {
    const midX = formRect.left + formRect.width / 2;
    const rightSideButtons = buttons.filter((button) => {
      const rect = button.getBoundingClientRect();
      const ariaLabel = (button.getAttribute("aria-label") || "").toLowerCase();
      // Exclude attachment/plus/more buttons
      if (
        ariaLabel.includes("attach") ||
        ariaLabel.includes("upload") ||
        ariaLabel.includes("plus") ||
        ariaLabel.includes("more")
      ) {
        return false;
      }
      if (button.dataset.testid === "more-options-button") {
        return false;
      }
      return rect.left > midX;
    });

    if (rightSideButtons.length > 0) {
      // Return the rightmost visible button
      return rightSideButtons[rightSideButtons.length - 1];
    }
  }

  return null;
}

function findButtonHost(promptInput, sendButton) {
  if (sendButton?.parentElement) {
    const parent = sendButton.parentElement;

    // Check if the parent is a wrapper (contains no other buttons).
    // If it has other button siblings (like microphone or format buttons), it is a shared actions container.
    const siblings = [...parent.querySelectorAll("button")].filter((b) => b !== sendButton);
    if (siblings.length > 0) {
      return parent;
    }

    // If the parent is a small wrapper, climb up to the grandparent actions row.
    const grandparent = parent.parentElement;
    if (grandparent) {
      return grandparent;
    }

    return parent;
  }

  const form = promptInput.closest("form");
  const footer =
    form?.querySelector("[data-testid='composer-footer-actions']") ||
    form?.querySelector("[class*='composer'] [class*='actions']");

  return footer || form || promptInput.parentElement;
}

function getPromptValue(promptInput) {
  if (!promptInput) {
    return "";
  }

  if ("value" in promptInput) {
    return promptInput.value;
  }

  return promptInput.innerText || promptInput.textContent || "";
}

function setPromptValue(promptInput, value) {
  if (!promptInput) {
    return;
  }

  promptInput.focus();

  if ("value" in promptInput) {
    promptInput.value = value;
    promptInput.dispatchEvent(new Event("input", { bubbles: true }));
    promptInput.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }

  // ChatGPT's composer is usually contenteditable. Selection-based insertion keeps React state in sync.
  const selection = window.getSelection();
  const range = document.createRange();

  range.selectNodeContents(promptInput);
  selection.removeAllRanges();
  selection.addRange(range);
  document.execCommand("insertText", false, value);

  promptInput.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      inputType: "insertText",
      data: value
    })
  );
}

function setLoadingState(loading) {
  isOptimizing = loading;

  const button = document.getElementById(BUTTON_ID);

  if (!button) {
    return;
  }

  button.disabled = loading;
  button.classList.toggle("is-loading", loading);
  setButtonContent(button, loading);
}

function setButtonContent(button, loading) {
  button.innerHTML = loading
    ? '<span class="promptify-spinner"></span><span>Optimizing</span>'
    : `<span class="promptify-sparkle">${SPARKLE}</span><span>Optimize</span>`;
}

function addTextareaGlow(promptInput) {
  promptInput.classList.add("promptify-glow");
  window.setTimeout(() => promptInput.classList.remove("promptify-glow"), 1400);
}

function showToast(message, type = "success") {
  const existingToast = document.querySelector(".promptify-toast");
  existingToast?.remove();

  const toast = document.createElement("div");
  toast.className = `promptify-toast promptify-toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  window.setTimeout(() => toast.classList.add("is-visible"), 20);
  window.setTimeout(() => {
    toast.classList.remove("is-visible");
    window.setTimeout(() => toast.remove(), 220);
  }, 3600);
}

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .promptify-button {
      align-items: center;
      align-self: center;
      background: linear-gradient(135deg, #0f5132, #18a058);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(24, 160, 88, 0.22);
      color: #f7fff9;
      cursor: pointer;
      display: inline-flex;
      flex: 0 0 auto;
      font: 600 12px/1.1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      gap: 6px;
      height: 34px;
      justify-content: center;
      margin-inline-end: 8px;
      padding: 0 12px;
      transition: box-shadow 160ms ease, opacity 160ms ease, transform 160ms ease;
      white-space: nowrap;
      z-index: 5;
    }

    .promptify-button:hover:not(:disabled) {
      box-shadow: 0 10px 30px rgba(24, 160, 88, 0.34);
      transform: translateY(-1px);
    }

    .promptify-button:disabled {
      cursor: wait;
      opacity: 0.75;
    }

    .promptify-spinner {
      animation: promptify-spin 800ms linear infinite;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #ffffff;
      border-radius: 999px;
      display: inline-block;
      height: 14px;
      width: 14px;
    }

    .promptify-toast {
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-left: 3px solid #22c55e;
      border-radius: 10px;
      bottom: 88px;
      box-shadow: 0 16px 44px rgba(2, 6, 23, 0.32);
      color: #f8fafc;
      font: 500 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      max-width: min(360px, calc(100vw - 32px));
      opacity: 0;
      padding: 12px 14px;
      position: fixed;
      right: 18px;
      transform: translateY(8px);
      transition: opacity 180ms ease, transform 180ms ease;
      z-index: 2147483647;
    }

    .promptify-toast.is-visible {
      opacity: 1;
      transform: translateY(0);
    }

    .promptify-toast-error {
      border-left-color: #ef4444;
    }

    .promptify-toast-warning {
      border-left-color: #f59e0b;
    }

    .promptify-glow {
      animation: promptify-green-glow 1400ms ease;
    }

    @keyframes promptify-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @keyframes promptify-green-glow {
      0%,
      100% {
        box-shadow: none;
      }

      35% {
        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.28), 0 0 28px rgba(34, 197, 94, 0.3);
      }
    }
  `;
  document.head.appendChild(style);
}
