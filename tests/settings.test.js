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
