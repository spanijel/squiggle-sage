(function (root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SquiggleSageDefaults = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MAX_PERSONAL_REPLACEMENTS = 100;
  var MAX_REPLACEMENT_FIND_LENGTH = 80;
  var MAX_REPLACEMENT_VALUE_LENGTH = 80;

  var DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    nativeSpellcheck: true,
    spelling: true,
    grammar: true,
    style: true,
    typography: true,
    capitalization: true,
    debounceMs: 350,
    disabledRules: Object.freeze([]),
    disabledSites: Object.freeze([]),
    personalDictionary: Object.freeze([]),
    personalReplacements: Object.freeze([]),
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

  function normalizedPersonalDictionary(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    var seen = Object.create(null);
    var normalized = [];

    value.forEach(function (item) {
      if (typeof item !== "string") {
        return;
      }

      var candidate = item
        .normalize("NFC")
        .replace(/\u2019/g, "'")
        .trim()
        .toLowerCase();

      if (
        !candidate ||
        candidate.length > 64 ||
        !/^[a-z]+(?:['-][a-z]+)*$/.test(candidate) ||
        seen[candidate]
      ) {
        return;
      }

      seen[candidate] = true;
      normalized.push(candidate);
    });

    return normalized.sort();
  }

  function normalizedReplacementText(value, maxLength) {
    if (typeof value !== "string") {
      return "";
    }

    var candidate = value
      .normalize("NFC")
      .replace(/\u2019/g, "'")
      .trim()
      .replace(/ +/g, " ");

    if (
      !candidate ||
      candidate.length > maxLength ||
      /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(candidate) ||
      /[^\S ]/.test(candidate)
    ) {
      return "";
    }

    return candidate;
  }

  function normalizedPersonalReplacements(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    var seen = Object.create(null);
    var normalized = [];

    value.some(function (item) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return false;
      }

      var find = normalizedReplacementText(item.find, MAX_REPLACEMENT_FIND_LENGTH);
      var replace = normalizedReplacementText(item.replace, MAX_REPLACEMENT_VALUE_LENGTH);
      var key = find.toLowerCase();

      if (!find || !replace || find === replace || seen[key]) {
        return false;
      }

      seen[key] = true;
      normalized.push(Object.freeze({ find: find, replace: replace }));
      return normalized.length >= MAX_PERSONAL_REPLACEMENTS;
    });

    return normalized.sort(function (left, right) {
      var leftKey = left.find.toLowerCase();
      var rightKey = right.find.toLowerCase();
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
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
      spelling: booleanSetting(input, "spelling"),
      grammar: booleanSetting(input, "grammar"),
      style: booleanSetting(input, "style"),
      typography: booleanSetting(input, "typography"),
      capitalization: booleanSetting(input, "capitalization"),
      debounceMs: debounceMs,
      disabledRules: normalizedStringArray(input.disabledRules),
      disabledSites: normalizedStringArray(input.disabledSites),
      personalDictionary: normalizedPersonalDictionary(input.personalDictionary),
      personalReplacements: normalizedPersonalReplacements(input.personalReplacements),
    };
  }

  return Object.freeze({
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    MAX_PERSONAL_REPLACEMENTS: MAX_PERSONAL_REPLACEMENTS,
    MAX_REPLACEMENT_FIND_LENGTH: MAX_REPLACEMENT_FIND_LENGTH,
    MAX_REPLACEMENT_VALUE_LENGTH: MAX_REPLACEMENT_VALUE_LENGTH,
    normalizePersonalReplacements: normalizedPersonalReplacements,
    normalizeSettings: normalizeSettings,
  });
});
