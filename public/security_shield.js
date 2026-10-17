/**
 * TradersDesk Terminal Anti-Tamper & Security Shield
 * Note: Context menu (Right Click) and general navigation are fully permitted.
 */
(function () {
  "use strict";

  // Zero interference with right-click or normal user clicks
  try {
    if (typeof console !== "undefined" && console.log) {
      console.log(
        "%c⚡ TradersDesk Terminal %c| Institutional Quantitative Analytics Terminal",
        "background: #0284c7; color: #ffffff; padding: 4px 8px; border-radius: 4px; font-weight: bold;",
        "color: #94a3b8; padding: 4px;"
      );
    }
  } catch (e) {}

  // Resilient Fetch & Response.prototype.json Guard
  // Prevents SyntaxError: Unexpected token 'S', "Service Unavailable" is not valid JSON
  // across all network fetch calls when endpoints return 503, 502, 504, or non-JSON HTML/text
  try {
    if (typeof Response !== "undefined" && Response.prototype && Response.prototype.json) {
      const originalJson = Response.prototype.json;
      Response.prototype.json = async function () {
        try {
          return await originalJson.call(this);
        } catch (err) {
          if (!this.ok) {
            return {
              ok: false,
              status: this.status,
              error: "HTTP " + this.status + ": Service temporarily unavailable (" + (this.statusText || 'Server Busy') + ")",
              message: "HTTP " + this.status + ": Service temporarily unavailable"
            };
          }
          return {
            ok: false,
            status: this.status,
            error: err.message || "Failed to parse JSON response",
            message: "Invalid response format"
          };
        }
      };
    }
  } catch (_) {}
})();
