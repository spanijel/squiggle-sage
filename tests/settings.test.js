"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const defaults = require("../src/shared/defaults.js");

test("0.1 settings gain local spelling defaults without losing saved values", () => {
  const normalized = defaults.normalizeSettings({
    enabled: false,
    nativeSpellcheck: false,
    grammar: false,
    disabledSites: ["example.com"]
  });

  assert.equal(normalized.enabled, false);
  assert.equal(normalized.nativeSpellcheck, false);
  assert.equal(normalized.grammar, false);
  assert.equal(normalized.spelling, true);
  assert.deepEqual(normalized.personalDictionary, []);
  assert.deepEqual(normalized.personalReplacements, []);
  assert.deepEqual(normalized.disabledSites, ["example.com"]);
});

test("personal dictionary normalization is safe, deterministic, and deduplicated", () => {
  const normalized = defaults.normalizeSettings({
    spelling: false,
    personalDictionary: [
      "  SquiggleSage  ",
      "squigglesage",
      "O’Malley",
      "mother-in-law",
      "two words",
      "word2",
      "",
      null
    ]
  });

  assert.equal(normalized.spelling, false);
  assert.deepEqual(normalized.personalDictionary, [
    "mother-in-law",
    "o'malley",
    "squigglesage"
  ]);
});

test("default personal dictionary cannot be mutated", () => {
  assert(Object.isFrozen(defaults.DEFAULT_SETTINGS.personalDictionary));
});

test("personal replacements normalize safely and deterministically", () => {
  const normalized = defaults.normalizeSettings({
    personalReplacements: [
      { find: "  teh  ", replace: "  the  " },
      { find: "alot", replace: "a lot" },
      { find: "TEH", replace: "duplicate is rejected" },
      { find: "smart’s", replace: "clever" },
      { find: "same", replace: "same" },
      { find: "two   spaces", replace: "two words" },
      { find: "line\nbreak", replace: "unsafe" },
      { find: "hidden\u202etext", replace: "unsafe" },
      { find: "symbols!", replace: "allowed?" },
      { find: "", replace: "empty" },
      { find: "valid", replace: "" },
      { find: "x".repeat(81), replace: "too long" },
      { find: "too-long-value", replace: "x".repeat(81) },
      null,
      "not an object"
    ]
  });

  assert.deepEqual(normalized.personalReplacements, [
    { find: "alot", replace: "a lot" },
    { find: "smart's", replace: "clever" },
    { find: "symbols!", replace: "allowed?" },
    { find: "teh", replace: "the" },
    { find: "two spaces", replace: "two words" }
  ]);
  assert(normalized.personalReplacements.every(Object.isFrozen));
});

test("personal replacements are capped at a bounded count", () => {
  const personalReplacements = Array.from({ length: 105 }, (_value, index) => ({
    find: `entry ${String(index).padStart(3, "0")}`,
    replace: `replacement ${index}`
  }));
  const normalized = defaults.normalizeSettings({ personalReplacements });

  assert.equal(defaults.MAX_PERSONAL_REPLACEMENTS, 100);
  assert.equal(defaults.MAX_REPLACEMENT_FIND_LENGTH, 80);
  assert.equal(defaults.MAX_REPLACEMENT_VALUE_LENGTH, 80);
  assert.equal(normalized.personalReplacements.length, 100);
  assert.equal(normalized.personalReplacements[0].find, "entry 000");
  assert.equal(normalized.personalReplacements[99].find, "entry 099");
});

test("default personal replacements cannot be mutated", () => {
  assert(Object.isFrozen(defaults.DEFAULT_SETTINGS.personalReplacements));
});
