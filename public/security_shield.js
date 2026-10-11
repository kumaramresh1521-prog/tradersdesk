/**
 * TradersDesk Terminal Anti-Tamper & Security Shield
 * Prevents unauthorized inspection, view-source, devtools, and data scraping.
 */
(function () {
  "use strict";

  let isLocked = false;
  let lockOverlay = null;

  function createLockScreen() {
    if (lockOverlay) return lockOverlay;

    lockOverlay = document.createElement("div");
    lockOverlay.id = "terminalSecurityLock";
    lockOverlay.style.cssText = `
      position: fixed !important;
      inset: 0 !important;
      z-index: 2147483647 !important;
      background: #070d1e !important;
      color: #ffffff !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif !important;
      padding: 24px !important;
      text-align: center !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      pointer-events: auto !important;
    `;

    lockOverlay.innerHTML = `
      <div style="max-width: 540px; background: #0f1b33; border: 1.5px solid #dc2626; border-radius: 16px; padding: 36px 28px; box-shadow: 0 25px 60px rgba(220, 38, 38, 0.25);">
        <div style="width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 50%; background: rgba(220, 38, 38, 0.15); display: flex; align-items: center; justify-content: center; font-size: 34px; border: 2px solid rgba(220, 38, 38, 0.4);">
          🔒
        </div>
        <h2 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 800; color: #f87171; letter-spacing: -0.4px;">
          Security Alert: Terminal Locked
        </h2>
        <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 700; color: #ffffff;">
          Developer Tools or Source Inspection Detected
        </p>
        <p style="margin: 0 0 24px 0; font-size: 12.5px; line-height: 1.6; color: #94a3b8;">
          To protect proprietary quantitative algorithms, live exchange market data feeds, and session security, source code inspection is strictly prohibited on TradersDesk Terminal.
        </p>
        <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid #1e293b; border-radius: 8px; padding: 10px 14px; margin-bottom: 24px; font-family: monospace; font-size: 11.5px; color: #cbd5e1;">
          Status: <strong>ACCESS_RESTRICTED (Code: 403_INSPECT_BLOCKED)</strong>
        </div>
        <button id="secUnlockBtn" style="padding: 10px 24px; font-size: 13px; font-weight: 700; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #ffffff; border: none; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 14px rgba(37,99,235,0.4); transition: transform 0.15s ease;">
          🔄 Close Inspector &amp; Reload Terminal
        </button>
      </div>
    `;

    document.documentElement.appendChild(lockOverlay);

    const btn = lockOverlay.querySelector("#secUnlockBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        window.location.reload();
      });
    }

    return lockOverlay;
  }

  function triggerLock(reason) {
    if (isLocked) return;
    isLocked = true;

    try {
      createLockScreen();
      // Blur and conceal underlying page content
      const app = document.querySelector(".app-container") || document.body;
      if (app && app !== lockOverlay) {
        app.style.filter = "blur(30px)";
        app.style.opacity = "0.05";
        app.style.pointerEvents = "none";
      }
    } catch (e) {}

    try {
      console.clear();
      console.log(
        "%c⛔ TRADERSDESK SECURITY SHIELD: Developer tools and source inspection are disabled.",
        "color: red; font-size: 18px; font-weight: bold;"
      );
    } catch (e) {}
  }

  // 1. Block Context Menu (Right Click)
  document.addEventListener(
    "contextmenu",
    function (e) {
      e.preventDefault();
      e.stopPropagation();
      triggerLock("CONTEXT_MENU");
      return false;
    },
    true
  );

  // 2. Block Keyboard Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+S)
  window.addEventListener(
    "keydown",
    function (e) {
      const key = e.key || "";
      const code = e.keyCode || 0;
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // F12 (code 123)
      if (key === "F12" || code === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("F12");
        return false;
      }

      // Ctrl + Shift + I (Inspect)
      if (isCtrl && isShift && (key === "I" || key === "i" || code === 73)) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("CTRL_SHIFT_I");
        return false;
      }

      // Ctrl + Shift + J (Console)
      if (isCtrl && isShift && (key === "J" || key === "j" || code === 74)) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("CTRL_SHIFT_J");
        return false;
      }

      // Ctrl + Shift + C (Element selector)
      if (isCtrl && isShift && (key === "C" || key === "c" || code === 67)) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("CTRL_SHIFT_C");
        return false;
      }

      // Ctrl + Shift + K (Firefox console)
      if (isCtrl && isShift && (key === "K" || key === "k" || code === 75)) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("CTRL_SHIFT_K");
        return false;
      }

      // Ctrl + U (View Source)
      if (isCtrl && (key === "U" || key === "u" || code === 85)) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("CTRL_U");
        return false;
      }

      // Ctrl + S (Save Page)
      if (isCtrl && (key === "S" || key === "s" || code === 83)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    true
  );

  // 3. DevTools Outer Dimensions Threshold Probe
  function checkDevToolsDimensions() {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth > threshold;
    const heightDiff = window.outerHeight - window.innerHeight > threshold;

    if (widthDiff || heightDiff) {
      triggerLock("DEVTOOLS_WINDOW_DIMS");
    }
  }

  // 4. Debugger Timing Probe
  function checkDebuggerTiming() {
    const start = performance.now();
    /* eslint-disable no-debugger */
    (function () {}).constructor("debugger")();
    const duration = performance.now() - start;
    if (duration > 100) {
      triggerLock("DEVTOOLS_DEBUGGER_TIMING");
    }
  }

  // Periodic Watcher
  setInterval(function () {
    if (!isLocked) {
      checkDevToolsDimensions();
      checkDebuggerTiming();
    }
  }, 1000);

  window.addEventListener("resize", function () {
    if (!isLocked) {
      checkDevToolsDimensions();
    }
  });
})();
