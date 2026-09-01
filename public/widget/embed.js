/**
 * SaoMai AI — Luxury Light Glassmorphism Chatbot Widget
 * Premium Animated 3D Bot, Smart Reappearing Callout Banner & Refined UX
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
    if (scripts.length > 0) {
      currentScript = scripts[scripts.length - 1];
    } else {
      var allScripts = document.querySelectorAll("script[src*='embed.js']");
      currentScript = allScripts[allScripts.length - 1];
    }
  }
  var botId = (currentScript && currentScript.getAttribute("data-bot-id")) || "default";

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
  var mascotWrapper = null;
  var calloutBanner = null;
  var chatWindow = null;
  var iframe = null;
  var bannerTimer = null;

  // ─── Default Config ───
  var defaultCfg = {
    name: "SaoMai AI",
    theme_color: "#DC2626",
    position: "bottom-right",
    greeting: "👋 Xin chào! Tôi là Trợ lý AI SaoMai. Hãy bấm vào tôi nếu bạn cần giải đáp nhé!",
    avatar_url: baseUrl + "/widget/mascot-clean-bot.svg"
  };

  // ─── Fetch bot config (with fallback) ───
  function fetchConfig(callback) {
    if (botId === "default") {
      callback(defaultCfg);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open("GET", baseUrl + "/api/bots/" + botId);
    xhr.timeout = 4000;
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

  // ─── Inject Styles ───
  function injectStyles(themeColor) {
    var styleId = "saomai-widget-styles-v6";
    if (document.getElementById(styleId)) return;

    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = [
      "#saomai-widget-container {",
      "  position: fixed !important;",
      "  z-index: 2147483647 !important;",
      "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;",
      "  display: block !important;",
      "  margin: 0 !important;",
      "  padding: 0 !important;",
      "  box-sizing: border-box !important;",
      "  user-select: none !important;",
      "}",
      "#saomai-widget-container.bottom-right { bottom: 20px !important; right: 20px !important; top: auto !important; left: auto !important; }",
      "#saomai-widget-container.bottom-left { bottom: 20px !important; left: 20px !important; top: auto !important; right: auto !important; }",

      "/* Mascot Trigger Wrapper */",
      "#saomai-mascot-wrapper {",
      "  position: relative !important;",
      "  width: 62px !important;",
      "  height: 62px !important;",
      "  cursor: pointer !important;",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  justify-content: center !important;",
      "  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;",
      "  filter: drop-shadow(0 8px 20px rgba(220, 38, 38, 0.35)) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.1)) !important;",
      "  animation: saomai-bot-float 3.5s ease-in-out infinite !important;",
      "}",
      "#saomai-mascot-wrapper:hover {",
      "  transform: scale(1.1) translateY(-3px) !important;",
      "  filter: drop-shadow(0 14px 28px rgba(220, 38, 38, 0.5)) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.15)) !important;",
      "}",
      "#saomai-mascot-wrapper:active {",
      "  transform: scale(0.94) !important;",
      "}",

      "/* Mascot Image */",
      "#saomai-mascot-img {",
      "  width: 100% !important;",
      "  height: 100% !important;",
      "  object-fit: contain !important;",
      "  display: block !important;",
      "  pointer-events: none !important;",
      "  transition: transform 0.25s ease, opacity 0.25s ease !important;",
      "}",

      "/* Online Green Beacon */",
      "#saomai-online-beacon {",
      "  position: absolute !important;",
      "  top: 1px !important;",
      "  right: 1px !important;",
      "  width: 12px !important;",
      "  height: 12px !important;",
      "  background: #10B981 !important;",
      "  border-radius: 50% !important;",
      "  border: 2px solid #FFFFFF !important;",
      "  box-shadow: 0 0 8px rgba(16, 185, 129, 0.9) !important;",
      "  z-index: 3 !important;",
      "  transition: opacity 0.2s ease !important;",
      "}",

      "/* Close X Icon */",
      "#saomai-close-icon {",
      "  position: absolute !important;",
      "  width: 46px !important;",
      "  height: 46px !important;",
      "  border-radius: 50% !important;",
      "  background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%) !important;",
      "  color: #FFFFFF !important;",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  justify-content: center !important;",
      "  box-shadow: 0 6px 18px rgba(220, 38, 38, 0.45) !important;",
      "  opacity: 0 !important;",
      "  transform: scale(0.4) rotate(-90deg) !important;",
      "  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;",
      "  pointer-events: none !important;",
      "  z-index: 4 !important;",
      "}",
      "#saomai-close-icon svg {",
      "  width: 19px !important;",
      "  height: 19px !important;",
      "  stroke-width: 2.5 !important;",
      "}",
      "#saomai-mascot-wrapper.open {",
      "  animation: none !important;",
      "  width: 46px !important;",
      "  height: 46px !important;",
      "  margin-left: auto !important;",
      "}",
      "#saomai-mascot-wrapper.open #saomai-close-icon {",
      "  opacity: 1 !important;",
      "  transform: scale(1) rotate(0deg) !important;",
      "  pointer-events: all !important;",
      "}",
      "#saomai-mascot-wrapper.open #saomai-mascot-img,",
      "#saomai-mascot-wrapper.open #saomai-online-beacon {",
      "  opacity: 0 !important;",
      "  pointer-events: none !important;",
      "}",

      "/* 🌟 BRIGHT LUXURY CALLOUT BANNER 🌟 */",
      "#saomai-callout-banner {",
      "  position: absolute !important;",
      "  bottom: 74px !important;",
      "  right: 0 !important;",
      "  width: 250px !important;",
      "  background: rgba(255, 255, 255, 0.96) !important;",
      "  backdrop-filter: blur(20px) !important;",
      "  -webkit-backdrop-filter: blur(20px) !important;",
      "  border-radius: 16px !important;",
      "  padding: 12px 14px !important;",
      "  box-shadow: 0 16px 36px -6px rgba(0, 0, 0, 0.12), 0 0 16px rgba(220, 38, 38, 0.1) !important;",
      "  border: 1px solid rgba(220, 38, 38, 0.16) !important;",
      "  cursor: pointer !important;",
      "  opacity: 0 !important;",
      "  transform: translateY(12px) scale(0.92) !important;",
      "  transform-origin: bottom right !important;",
      "  transition: opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) !important;",
      "  pointer-events: none !important;",
      "  z-index: 2147483646 !important;",
      "  animation: saomai-banner-subtle 4s ease-in-out infinite 1.5s !important;",
      "}",
      "#saomai-callout-banner.show {",
      "  opacity: 1 !important;",
      "  transform: translateY(0) scale(1) !important;",
      "  pointer-events: all !important;",
      "}",
      "#saomai-callout-banner:hover {",
      "  transform: translateY(-2px) scale(1.01) !important;",
      "  border-color: rgba(220, 38, 38, 0.45) !important;",
      "  box-shadow: 0 20px 40px -6px rgba(220, 38, 38, 0.22) !important;",
      "}",

      "/* Callout Header */",
      "#saomai-callout-header {",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  justify-content: space-between !important;",
      "  margin-bottom: 5px !important;",
      "}",
      "#saomai-callout-tag {",
      "  display: inline-flex !important;",
      "  align-items: center !important;",
      "  gap: 4px !important;",
      "  background: rgba(220, 38, 38, 0.08) !important;",
      "  border: 1px solid rgba(220, 38, 38, 0.2) !important;",
      "  color: #DC2626 !important;",
      "  font-size: 10px !important;",
      "  font-weight: 700 !important;",
      "  padding: 2px 6px !important;",
      "  border-radius: 9999px !important;",
      "  letter-spacing: 0.2px !important;",
      "}",
      "#saomai-callout-tag-dot {",
      "  width: 5px !important;",
      "  height: 5px !important;",
      "  border-radius: 50% !important;",
      "  background: #DC2626 !important;",
      "  box-shadow: 0 0 6px rgba(220, 38, 38, 0.8) !important;",
      "}",
      "#saomai-callout-close {",
      "  width: 18px !important;",
      "  height: 18px !important;",
      "  border-radius: 50% !important;",
      "  background: #F1F5F9 !important;",
      "  color: #64748B !important;",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  justify-content: center !important;",
      "  font-size: 11px !important;",
      "  cursor: pointer !important;",
      "  transition: all 0.15s !important;",
      "}",
      "#saomai-callout-close:hover {",
      "  background: #E2E8F0 !important;",
      "  color: #0F172A !important;",
      "}",

      "/* Callout Body Text */",
      "#saomai-callout-title {",
      "  font-size: 12.5px !important;",
      "  font-weight: 700 !important;",
      "  color: #0F172A !important;",
      "  line-height: 1.4 !important;",
      "  margin: 0 0 3px 0 !important;",
      "}",
      "#saomai-callout-subtitle {",
      "  font-size: 11px !important;",
      "  color: #64748B !important;",
      "  line-height: 1.4 !important;",
      "  margin: 0 0 7px 0 !important;",
      "}",

      "/* Callout CTA Button */",
      "#saomai-callout-action {",
      "  display: flex !important;",
      "  align-items: center !important;",
      "  justify-content: center !important;",
      "  gap: 5px !important;",
      "  background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%) !important;",
      "  color: #FFFFFF !important;",
      "  font-size: 11px !important;",
      "  font-weight: 600 !important;",
      "  padding: 5px 8px !important;",
      "  border-radius: 8px !important;",
      "  box-shadow: 0 3px 10px rgba(220, 38, 38, 0.25) !important;",
      "}",

      "/* Triangle Arrow Tail */",
      "#saomai-callout-tail {",
      "  position: absolute !important;",
      "  bottom: -6px !important;",
      "  right: 24px !important;",
      "  width: 12px !important;",
      "  height: 12px !important;",
      "  background: #FFFFFF !important;",
      "  border-right: 1px solid rgba(220, 38, 38, 0.16) !important;",
      "  border-bottom: 1px solid rgba(220, 38, 38, 0.16) !important;",
      "  transform: rotate(45deg) !important;",
      "}",

      "/* Chat Window */",
      "#saomai-chat-window {",
      "  position: absolute !important;",
      "  width: 360px !important;",
      "  height: 520px !important;",
      "  max-height: calc(100vh - 100px) !important;",
      "  border-radius: 20px !important;",
      "  overflow: hidden !important;",
      "  box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.16), 0 6px 20px -2px rgba(220, 38, 38, 0.1) !important;",
      "  opacity: 0 !important;",
      "  transform: scale(0.92) translateY(14px) !important;",
      "  transform-origin: bottom right !important;",
      "  transition: opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;",
      "  pointer-events: none !important;",
      "  border: 1px solid rgba(0, 0, 0, 0.08) !important;",
      "  background: #FFFFFF !important;",
      "  z-index: 2147483645 !important;",
      "}",
      "#saomai-chat-window.open {",
      "  opacity: 1 !important;",
      "  transform: scale(1) translateY(0) !important;",
      "  pointer-events: all !important;",
      "}",
      ".bottom-right #saomai-chat-window { bottom: 68px !important; right: 0 !important; }",
      ".bottom-left #saomai-chat-window { bottom: 68px !important; left: 0 !important; transform-origin: bottom left !important; }",

      "#saomai-chat-window iframe {",
      "  width: 100% !important;",
      "  height: 100% !important;",
      "  border: none !important;",
      "  display: block !important;",
      "  margin: 0 !important;",
      "  padding: 0 !important;",
      "}",

      "/* Animations */",
      "@keyframes saomai-bot-float {",
      "  0%, 100% { transform: translateY(0px); }",
      "  50% { transform: translateY(-5px); }",
      "}",
      "@keyframes saomai-banner-subtle {",
      "  0%, 100% { transform: translateY(0); }",
      "  50% { transform: translateY(-3px); }",
      "}",

      "/* Mobile Responsive */",
      "@media (max-width: 480px) {",
      "  #saomai-widget-container.bottom-right, #saomai-widget-container.bottom-left {",
      "    bottom: 16px !important; right: 16px !important; left: auto !important;",
      "  }",
      "  #saomai-callout-banner {",
      "    width: 250px !important;",
      "  }",
      "  #saomai-chat-window {",
      "    position: fixed !important;",
      "    top: 0 !important;",
      "    left: 0 !important;",
      "    right: 0 !important;",
      "    bottom: 0 !important;",
      "    width: 100% !important;",
      "    height: 100% !important;",
      "    max-height: 100vh !important;",
      "    border-radius: 0 !important;",
      "    border: none !important;",
      "  }",
      "  .bottom-right #saomai-chat-window, .bottom-left #saomai-chat-window {",
      "    bottom: 0 !important; right: 0 !important; left: 0 !important;",
      "  }",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  // ─── Create widget DOM ───
  function createWidget(cfg) {
    if (document.getElementById("saomai-widget-container")) return;

    var color = (cfg && cfg.theme_color) || "#DC2626";
    var position = (cfg && cfg.position) || "bottom-right";
    var mascotSrc = baseUrl + "/widget/mascot-clean-bot.svg";

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

    // ─── Bright Luxury Callout Banner ───
    calloutBanner = document.createElement("div");
    calloutBanner.id = "saomai-callout-banner";
    calloutBanner.innerHTML = [
      '<div id="saomai-callout-header">',
      '  <div id="saomai-callout-tag">',
      '    <span id="saomai-callout-tag-dot"></span>',
      '    <span>AI TRỰC TUYẾN</span>',
      '  </div>',
      '  <div id="saomai-callout-close" title="Ẩn">✕</div>',
      '</div>',
      '<h4 id="saomai-callout-title">👋 Bạn cần giải đáp tư tưởng?</h4>',
      '<p id="saomai-callout-subtitle">Tra cứu chính sách & phản bác tin sai lệch ngay.</p>',
      '<div id="saomai-callout-action">',
      '  <span>Hỏi đáp cùng AI</span>',
      '  <span>💬</span>',
      '</div>',
      '<div id="saomai-callout-tail"></div>'
    ].join("");

    // ─── Mascot Wrapper Trigger with Sleek SVG Close Icon ───
    mascotWrapper = document.createElement("div");
    mascotWrapper.id = "saomai-mascot-wrapper";
    mascotWrapper.setAttribute("aria-label", "Mở Trợ lý AI SaoMai");
    mascotWrapper.innerHTML = [
      '<img id="saomai-mascot-img" src="' + mascotSrc + '" alt="SaoMai AI Mascot" />',
      '<div id="saomai-online-beacon"></div>',
      '<div id="saomai-close-icon">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="18" y1="6" x2="6" y2="18"></line>' +
          '<line x1="6" y1="6" x2="18" y2="18"></line>' +
        '</svg>' +
      '</div>'
    ].join("");

    // Listeners
    mascotWrapper.addEventListener("click", toggleChat);

    // Hover on mascot to show banner if closed
    mascotWrapper.addEventListener("mouseenter", function () {
      if (!isOpen && calloutBanner && !calloutBanner.classList.contains("show")) {
        showCalloutBanner(100);
      }
    });

    calloutBanner.addEventListener("click", function (e) {
      if (e.target && (e.target.id === "saomai-callout-close" || e.target.parentElement?.id === "saomai-callout-close")) {
        e.stopPropagation();
        hideCalloutBanner();
      } else {
        openChat();
      }
    });

    container.appendChild(chatWindow);
    container.appendChild(calloutBanner);
    container.appendChild(mascotWrapper);

    // Safe attach to body
    function attach() {
      if (document.body) {
        document.body.appendChild(container);
        showCalloutBanner(1200);
      } else {
        setTimeout(attach, 50);
      }
    }
    attach();
  }

  function showCalloutBanner(delay, customTitle, customSubtitle) {
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      if (!isOpen && calloutBanner) {
        if (customTitle) {
          var tEl = document.getElementById("saomai-callout-title");
          if (tEl) tEl.textContent = customTitle;
        }
        if (customSubtitle) {
          var sEl = document.getElementById("saomai-callout-subtitle");
          if (sEl) sEl.textContent = customSubtitle;
        }
        calloutBanner.classList.add("show");
      }
    }, delay || 500);
  }

  function hideCalloutBanner() {
    if (bannerTimer) clearTimeout(bannerTimer);
    if (calloutBanner) {
      calloutBanner.classList.remove("show");
    }
  }

  function openChat() {
    isOpen = true;
    chatWindow.classList.add("open");
    mascotWrapper.classList.add("open");
    hideCalloutBanner();
  }

  function closeChat() {
    isOpen = false;
    chatWindow.classList.remove("open");
    mascotWrapper.classList.remove("open");
    // Re-show callout banner smoothly with friendly prompt when closed
    showCalloutBanner(700, "💬 Tôi luôn ở đây nhé!", "Bấm vào tôi bất cứ lúc nào để tiếp tục hỏi đáp.");
  }

  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  // Listen to child iframe close messages
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "SAOMAI_CLOSE_WIDGET") {
      closeChat();
    }
  });

  // ─── Init ───
  fetchConfig(createWidget);
})();
