/**
 * SaoMai AI — Embeddable Chatbot Widget
 *
 * Usage:
 *   <script src="https://chinhtri.vincode.xyz/widget/embed.js" data-bot-id="YOUR_BOT_ID"></script>
 */
(function () {
  "use strict";

  // Prevent double injection
  if (window.__SAOMAI_WIDGET_LOADED__) return;
  window.__SAOMAI_WIDGET_LOADED__ = true;

  // ─── Find script & bot ID ───
  var currentScript = document.currentScript;
  if (!currentScript || !currentScript.getAttribute("data-bot-id")) {
    var scripts = document.querySelectorAll("script[data-bot-id]");
    currentScript = scripts[scripts.length - 1];
  }
  var botId = currentScript && currentScript.getAttribute("data-bot-id");

  if (!botId) {
    console.error("[SaoMai Widget] Missing data-bot-id attribute on script tag");
    return;
  }

  // ─── Determine base URL ───
  var scriptSrc = (currentScript && currentScript.getAttribute("src")) || "";
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

  // ─── Default Config ───
  var defaultCfg = {
    name: "SaoMai AI",
    theme_color: "#DC2626",
    position: "bottom-right",
    greeting: "Xin chào! Tôi là SaoMai AI. Tôi có thể giúp gì cho bạn?"
  };

  // ─── Fetch bot config (with fallback) ───
  function fetchConfig(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", baseUrl + "/api/bots/" + botId);
    xhr.timeout = 5000;
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          config = JSON.parse(xhr.responseText);
          callback(config || defaultCfg);
        } catch (e) {
          callback(defaultCfg);
        }
      } else {
        callback(defaultCfg);
      }
    };
    xhr.onerror = function () {
      callback(defaultCfg);
    };
    xhr.ontimeout = function () {
      callback(defaultCfg);
    };
    xhr.send();
  }

  // ─── Create styles with !important to override host site CSS ───
  function injectStyles(themeColor) {
    var styleId = "saomai-widget-styles";
    if (document.getElementById(styleId)) return;

    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      "#saomai-widget-container { position: fixed !important; z-index: 2147483647 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; display: block !important; margin: 0 !important; padding: 0 !important; box-sizing: border-box !important; }",
      "#saomai-widget-container.bottom-right { bottom: 20px !important; right: 20px !important; top: auto !important; left: auto !important; }",
      "#saomai-widget-container.bottom-left { bottom: 20px !important; left: 20px !important; top: auto !important; right: auto !important; }",

      "#saomai-bubble { width: 58px !important; height: 58px !important; border-radius: 50% !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important; box-shadow: 0 4px 20px rgba(0,0,0,0.25) !important; transition: transform 0.2s ease, box-shadow 0.2s ease !important; border: none !important; outline: none !important; position: relative !important; padding: 0 !important; margin: 0 !important; background-color: " + themeColor + " !important; z-index: 2147483647 !important; visibility: visible !important; opacity: 1 !important; }",
      "#saomai-bubble:hover { transform: scale(1.08) !important; box-shadow: 0 6px 24px rgba(0,0,0,0.35) !important; }",
      "#saomai-bubble:active { transform: scale(0.95) !important; }",
      "#saomai-bubble svg { width: 26px !important; height: 26px !important; fill: #ffffff !important; transition: transform 0.3s ease !important; display: block !important; }",
      "#saomai-bubble.open svg.chat-icon { transform: rotate(90deg) scale(0) !important; position: absolute !important; }",
      "#saomai-bubble.open svg.close-icon { transform: rotate(0) scale(1) !important; }",
      "#saomai-bubble:not(.open) svg.close-icon { transform: rotate(-90deg) scale(0) !important; position: absolute !important; }",
      "#saomai-bubble:not(.open) svg.chat-icon { transform: rotate(0) scale(1) !important; }",

      "#saomai-chat-window { position: absolute !important; width: 380px !important; height: 560px !important; border-radius: 16px !important; overflow: hidden !important; box-shadow: 0 12px 48px rgba(0,0,0,0.2) !important; opacity: 0 !important; transform: scale(0.8) translateY(10px) !important; transition: opacity 0.25s ease, transform 0.25s ease !important; pointer-events: none !important; border: 1px solid rgba(0,0,0,0.08) !important; background: #ffffff !important; z-index: 2147483646 !important; }",
      "#saomai-chat-window.open { opacity: 1 !important; transform: scale(1) translateY(0) !important; pointer-events: all !important; }",

      ".bottom-right #saomai-chat-window { bottom: 70px !important; right: 0 !important; }",
      ".bottom-left #saomai-chat-window { bottom: 70px !left: 0 !important; }",

      "#saomai-chat-window iframe { width: 100% !important; height: 100% !important; border: none !important; display: block !important; margin: 0 !important; padding: 0 !important; }",

      "@keyframes saomai-pulse { 0%,100% { box-shadow: 0 4px 20px rgba(0,0,0,0.25) !important; } 50% { box-shadow: 0 4px 20px rgba(0,0,0,0.25), 0 0 0 10px " + themeColor + "30 !important; } }",
      "#saomai-bubble.pulse { animation: saomai-pulse 2s ease-in-out 3 !important; }",

      "@media (max-width: 480px) {",
      "  #saomai-chat-window { position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100% !important; height: 100% !important; border-radius: 0 !important; }",
      "  .bottom-right #saomai-chat-window, .bottom-left #saomai-chat-window { bottom: 0 !important; right: 0 !important; left: 0 !important; }",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // ─── Create widget DOM ───
  function createWidget(cfg) {
    if (document.getElementById("saomai-widget-container")) return;

    var color = (cfg && cfg.theme_color) || "#DC2626";
    var position = (cfg && cfg.position) || "bottom-right";

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
    iframe.title = (cfg && cfg.name) || "SaoMai AI Chat";
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

    // Safe attach to body
    function attach() {
      if (document.body) {
        document.body.appendChild(container);
      } else {
        setTimeout(attach, 50);
      }
    }
    attach();
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
  fetchConfig(createWidget);
})();
