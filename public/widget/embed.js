/**
 * SaoMai AI — Embeddable Chatbot Widget
 *
 * Usage:
 *   <script src="https://your-domain.com/widget/embed.js" data-bot-id="YOUR_BOT_ID"></script>
 *
 * This script creates a floating chat bubble and an iframe-based chat window.
 * It is self-contained with no external dependencies.
 */
(function () {
  "use strict";

  // ─── Find bot ID from script tag ───
  var scripts = document.querySelectorAll("script[data-bot-id]");
  var currentScript = scripts[scripts.length - 1];
  var botId = currentScript && currentScript.getAttribute("data-bot-id");

  if (!botId) {
    console.error("[SaoMai Widget] Missing data-bot-id attribute on script tag");
    return;
  }

  // ─── Determine base URL ───
  var scriptSrc = currentScript.getAttribute("src") || "";
  var baseUrl = "";
  try {
    var url = new URL(scriptSrc, window.location.href);
    baseUrl = url.origin;
  } catch (e) {
    baseUrl = window.location.origin;
  }

  // ─── State ───
  var isOpen = false;
  var config = null;
  var container = null;
  var bubble = null;
  var chatWindow = null;
  var iframe = null;

  // ─── Fetch bot config ───
  function fetchConfig(callback) {
    var defaultCfg = {
      name: "SaoMai AI",
      theme_color: "#DC2626",
      position: "bottom-right",
      greeting: "Xin chào! Tôi là SaoMai AI. Tôi có thể giúp gì cho bạn?"
    };

    var xhr = new XMLHttpRequest();
    xhr.open("GET", baseUrl + "/api/bots/" + botId);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          config = JSON.parse(xhr.responseText);
          callback(config || defaultCfg);
        } catch (e) {
          console.error("[SaoMai Widget] Invalid config response, using default");
          callback(defaultCfg);
        }
      } else {
        console.warn("[SaoMai Widget] Bot config status " + xhr.status + ", using default");
        callback(defaultCfg);
      }
    };
    xhr.onerror = function () {
      console.warn("[SaoMai Widget] Failed to fetch bot config, using default");
      callback(defaultCfg);
    };
    xhr.send();
  }

  // ─── Create styles ───
  function injectStyles(themeColor) {
    var style = document.createElement("style");
    style.textContent = [
      "#saomai-widget-container { position: fixed; z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }",
      "#saomai-widget-container.bottom-right { bottom: 20px; right: 20px; }",
      "#saomai-widget-container.bottom-left { bottom: 20px; left: 20px; }",

      "#saomai-bubble { width: 56px; height: 56px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.15); transition: transform 0.2s ease, box-shadow 0.2s ease; border: none; outline: none; position: relative; }",
      "#saomai-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,0,0,0.2); }",
      "#saomai-bubble:active { transform: scale(0.95); }",
      "#saomai-bubble svg { width: 24px; height: 24px; fill: white; transition: transform 0.3s ease; }",
      "#saomai-bubble.open svg.chat-icon { transform: rotate(90deg) scale(0); position: absolute; }",
      "#saomai-bubble.open svg.close-icon { transform: rotate(0) scale(1); }",
      "#saomai-bubble:not(.open) svg.close-icon { transform: rotate(-90deg) scale(0); position: absolute; }",
      "#saomai-bubble:not(.open) svg.chat-icon { transform: rotate(0) scale(1); }",

      "#saomai-chat-window { position: absolute; width: 380px; height: 560px; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.15); opacity: 0; transform: scale(0.8) translateY(10px); transition: opacity 0.25s ease, transform 0.25s ease; pointer-events: none; border: 1px solid rgba(0,0,0,0.08); }",
      "#saomai-chat-window.open { opacity: 1; transform: scale(1) translateY(0); pointer-events: all; }",

      ".bottom-right #saomai-chat-window { bottom: 70px; right: 0; }",
      ".bottom-left #saomai-chat-window { bottom: 70px; left: 0; }",

      "#saomai-chat-window iframe { width: 100%; height: 100%; border: none; }",

      // Pulse animation for bubble on load
      "@keyframes saomai-pulse { 0%,100% { box-shadow: 0 4px 20px rgba(0,0,0,0.15); } 50% { box-shadow: 0 4px 20px rgba(0,0,0,0.15), 0 0 0 8px " + themeColor + "20; } }",
      "#saomai-bubble.pulse { animation: saomai-pulse 2s ease-in-out 3; }",

      // Mobile responsive
      "@media (max-width: 480px) {",
      "  #saomai-chat-window { position: fixed; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%; border-radius: 0; }",
      "  .bottom-right #saomai-chat-window, .bottom-left #saomai-chat-window { bottom: 0; right: 0; left: 0; }",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // ─── Create widget DOM ───
  function createWidget(cfg) {
    var color = cfg.theme_color || "#DC2626";
    var position = cfg.position || "bottom-right";

    injectStyles(color);

    // Container
    container = document.createElement("div");
    container.id = "saomai-widget-container";
    container.className = position;

    // Chat window
    chatWindow = document.createElement("div");
    chatWindow.id = "saomai-chat-window";

    iframe = document.createElement("iframe");
    iframe.src = baseUrl + "/widget/chat/" + botId;
    iframe.title = cfg.name || "SaoMai AI Chat";
    iframe.allow = "clipboard-write";
    chatWindow.appendChild(iframe);

    // Bubble button
    bubble = document.createElement("button");
    bubble.id = "saomai-bubble";
    bubble.className = "pulse";
    bubble.style.backgroundColor = color;
    bubble.setAttribute("aria-label", "Mở chat");
    bubble.innerHTML = [
      '<svg class="chat-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
      '  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>',
      "</svg>",
      '<svg class="close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">',
      '  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>',
      "</svg>",
    ].join("");

    bubble.addEventListener("click", toggleChat);

    container.appendChild(chatWindow);
    container.appendChild(bubble);
    document.body.appendChild(container);
  }

  // ─── Toggle chat window ───
  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      chatWindow.classList.add("open");
      bubble.classList.add("open");
      bubble.classList.remove("pulse");
      bubble.setAttribute("aria-label", "Đóng chat");
    } else {
      chatWindow.classList.remove("open");
      bubble.classList.remove("open");
      bubble.setAttribute("aria-label", "Mở chat");
    }
  }

  // ─── Init ───
  function init() {
    // Wait for DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        fetchConfig(createWidget);
      });
    } else {
      fetchConfig(createWidget);
    }
  }

  init();
})();
