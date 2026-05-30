# Promptify - Gemini Prompt Optimizer

Promptify is a Manifest V3 Chrome extension that optimizes prompts on ChatGPT before you submit them. It sends your draft prompt to Google Gemini 1.5 Flash, rewrites it for clarity and token efficiency, then replaces the prompt in the ChatGPT composer.

## Features

- Adds a small `Optimize` button beside the ChatGPT send button.
- Uses Gemini 1.5 Flash through your own API key.
- Stores the API key only in `chrome.storage.sync`; it is never hardcoded.
- Shows a toast after optimization with estimated token savings.
- Tracks total optimized prompts and estimated saved tokens.
- Includes a popup with a dark theme, API key storage, enable/disable toggle, and stats.

## Get a Free Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Sign in with your Google account.
3. Open the API key section and create a Gemini API key.
4. Copy the key.
5. Open the Promptify extension popup and paste the key into the Gemini API key field.

## Load the Extension in Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Turn on `Developer mode`.
3. Click `Load unpacked`.
4. Select this project folder.
5. Pin Promptify from the Chrome extensions menu if you want quick access.

## Use Promptify

1. Open [ChatGPT](https://chat.openai.com/) or [chatgpt.com](https://chatgpt.com/).
2. Type a prompt in the message composer.
3. Click `Optimize`.
4. Review the optimized prompt.
5. Submit it when ready.

## Troubleshooting

- After editing extension files, open `chrome://extensions` and click the reload button on Promptify.
- Refresh the ChatGPT tab after reloading the extension.
- If the Optimize button is not visible, make sure Promptify is enabled in the popup and you are on `chat.openai.com` or `chatgpt.com`.
- If Gemini returns an error, confirm the API key is saved correctly and enabled for Gemini API access in Google AI Studio.

## Project Files

- `manifest.json` configures Manifest V3 permissions, service worker, popup, icons, and ChatGPT content script matching.
- `content.js` injects the Optimize button, reads and replaces the ChatGPT prompt, shows toast messages, and adds the green glow animation.
- `background.js` calls Gemini 1.5 Flash, estimates token savings, handles errors, and updates cumulative stats.
- `popup.html`, `popup.js`, and `popup.css` provide the settings and stats UI.
- `icons/` contains placeholder PNG icons for Chrome extension loading.

## Privacy Notes

Promptify only sends text to Gemini when you click `Optimize`. Your Gemini API key is stored in Chrome sync storage and is read by the background service worker only when optimization is requested.
