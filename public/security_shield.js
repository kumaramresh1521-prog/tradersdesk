/**
 * TradersDesk Terminal Anti-Tamper & Security Shield
 * Prevents unauthorized inspection, view-source, devtools, and data scraping.
 */
(function () {
  "use strict";

  let isLocked = false;
  let lockOverlay = null;

  function createLockScreen() {
    if (lockOverlay && document.getElementById("terminalSecurityLock")) {
      return lockOverlay;
    }

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
      visibility: visible !important;
      opacity: 1 !important;
    `;

    lockOverlay.innerHTML = `
      <div style="max-width: 520px; width: 90%; background: #0f1b33; border: 1.5px solid #dc2626; border-radius: 16px; padding: 32px 24px; box-shadow: 0 25px 60px rgba(220, 38, 38, 0.35);">
        <div style="width: 68px; height: 68px; margin: 0 auto 16px; border-radius: 50%; background: rgba(220, 38, 38, 0.15); display: flex; align-items: center; justify-content: center; font-size: 32px; border: 2px solid rgba(220, 38, 38, 0.4);">
          🔒
        </div>
        <h2 style="margin: 0 0 10px 0; font-size: 21px; font-weight: 800; color: #f87171; letter-spacing: -0.4px;">
          Security Alert: Terminal Locked
        </h2>
        <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #ffffff;">
          Source Inspection / Developer Tools Detected
        </p>
        <p style="margin: 0 0 20px 0; font-size: 12.5px; line-height: 1.6; color: #94a3b8;">
          To protect proprietary quantitative algorithms, live exchange market data feeds, and institutional session security, source inspection and developer tools are strictly prohibited on TradersDesk.in.
        </p>
        <div style="background: rgba(0, 0, 0, 0.4); border: 1px solid #1e293b; border-radius: 8px; padding: 10px 14px; margin-bottom: 22px; font-family: monospace; font-size: 11.5px; color: #cbd5e1;">
          Status: <strong style="color:#ef4444;">ACCESS_RESTRICTED (403_INSPECT_BLOCKED)</strong>
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

      // Hide main application content so nothing can be seen in elements or rendered
      const app = document.querySelector(".app") || document.querySelector(".app-container") || document.getElementById("mainContent") || document.body;
      if (app) {
        app.style.display = "none";
      }
    } catch (e) {}

    try {
      console.clear();
      console.log(
        "%c⛔ TRADERSDESK SECURITY SHIELD: Developer tools and source inspection are disabled.",
        "color: red; font-size: 18px; font-weight: bold;"
      );
    } catch (e) {}

    // Debugger trap loop once locked
    setInterval(function () {
      try {
        console.clear();
        (function () { return false; })["constructor"]("debugger")["call"]();
      } catch (e) {}
    }, 200);
  }

  // 1. Block Context Menu (Right Click) across document and window
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

  window.addEventListener(
    "contextmenu",
    function (e) {
      e.preventDefault();
      e.stopPropagation();
      triggerLock("CONTEXT_MENU");
      return false;
    },
    true
  );

  // 2. Block Keyboard Shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+Shift+K, Ctrl+U, Ctrl+S)
  window.addEventListener(
    "keydown",
    function (e) {
      const key = e.key || "";
      const code = e.keyCode || 0;
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      // F12
      if (key === "F12" || code === 123) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("F12");
        return false;
      }

      // Ctrl + Shift + I / Meta + Alt + I (Inspect)
      if ((isCtrl && isShift && (key === "I" || key === "i" || code === 73)) ||
          (isCtrl && isAlt && (key === "I" || key === "i" || code === 73))) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("CTRL_SHIFT_I");
        return false;
      }

      // Ctrl + Shift + J / Meta + Alt + J (Console)
      if ((isCtrl && isShift && (key === "J" || key === "j" || code === 74)) ||
          (isCtrl && isAlt && (key === "J" || key === "j" || code === 74))) {
        e.preventDefault();
        e.stopPropagation();
        triggerLock("CTRL_SHIFT_J");
        return false;
      }

      // Ctrl + Shift + C / Meta + Alt + C (Element selector)
      if ((isCtrl && isShift && (key === "C" || key === "c" || code === 67)) ||
          (isCtrl && isAlt && (key === "C" || key === "c" || code === 67))) {
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

      // Ctrl + U / Meta + Alt + U (View Source)
      if ((isCtrl && (key === "U" || key === "u" || code === 85)) ||
          (isCtrl && isAlt && (key === "U" || key === "u" || code === 85))) {
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

      // Ctrl + P (Print / Save PDF)
      if (isCtrl && (key === "P" || key === "p" || code === 80)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    },
    true
  );

  // 3. DevTools Outer Dimensions Threshold Probe
  function checkDevToolsDimensions() {
    const threshold = 100;
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
    if (duration > 80) {
      triggerLock("DEVTOOLS_DEBUGGER_TIMING");
    }
  }

  // 5. Console Element Evaluation Probe
  try {
    const detector = new Image();
    Object.defineProperty(detector, "id", {
      get: function () {
        triggerLock("DEVTOOLS_CONSOLE_PROBE");
        return "shield";
      }
    });
    setInterval(function () {
      if (!isLocked) {
        console.log("%c", detector);
        console.clear();
      }
    }, 1500);
  } catch (e) {}

  // Periodic Watcher
  setInterval(function () {
    if (!isLocked) {
      checkDevToolsDimensions();
      checkDebuggerTiming();
    }
  }, 800);

  window.addEventListener("resize", function () {
    if (!isLocked) {
      checkDevToolsDimensions();
    }
  });
})();
