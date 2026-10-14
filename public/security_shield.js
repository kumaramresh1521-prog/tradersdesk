/**
 * TradersDesk Terminal Anti-Tamper & Security Shield
 * Note: Context menu (Right Click) and general navigation are fully permitted.
 */
(function () {
  "use strict";

  // Zero interference with right-click or normal user clicks
  // All user interactions, context menus, and links work 100% natively without blocking
  try {
    if (typeof console !== "undefined" && console.log) {
      console.log(
        "%c⚡ TradersDesk Terminal %c| Institutional Quantitative Analytics Terminal",
        "background: #0284c7; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-weight: bold;",
        "color: #94a3b8; padding: 4px;"
      );
    }
  } catch (e) {}
})();
