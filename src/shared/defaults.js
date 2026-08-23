(function (root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SquiggleSageDefaults = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    nativeSpellcheck: true,
    grammar: true,
    style: true,
    typography: true,
    capitalization: true,
    debounceMs: 350,
    disabledRules: Object.freeze([]),
    disabledSites: Object.freeze([]),
  });

  function normalizedStringArray(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    var seen = Object.create(null);
    var normalized = [];

    value.forEach(function (item) {
      if (typeof item !== "string") {
        return;
      }

      var candidate = item.trim();

      if (!candidate || seen[candidate]) {
        return;
      }

      seen[candidate] = true;
      normalized.push(candidate);
    });

    return normalized;
  }

  function booleanSetting(input, key) {
    return typeof input[key] === "boolean" ? input[key] : DEFAULT_SETTINGS[key];
  }

  function normalizeSettings(value) {
    var input = value && typeof value === "object" ? value : {};
    var rawDebounce = Number(input.debounceMs);
    var debounceMs = Number.isFinite(rawDebounce)
      ? Math.max(100, Math.min(5000, Math.round(rawDebounce)))
      : DEFAULT_SETTINGS.debounceMs;
    return {
      enabled: booleanSetting(input, "enabled"),
      nativeSpellcheck: booleanSetting(input, "nativeSpellcheck"),
      grammar: booleanSetting(input, "grammar"),
      style: booleanSetting(input, "style"),
      typography: booleanSetting(input, "typography"),
      capitalization: booleanSetting(input, "capitalization"),
      debounceMs: debounceMs,
      disabledRules: normalizedStringArray(input.disabledRules),
      disabledSites: normalizedStringArray(input.disabledSites),
    };
  }

  return Object.freeze({
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    normalizeSettings: normalizeSettings,
  });
});
