"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const defaults = require("../src/shared/defaults.js");
const checker = require("../src/core/checker.js");

test("default settings expose the complete local checker configuration", () => {
  assert.deepEqual(defaults.DEFAULT_SETTINGS, {
    enabled: true,
    nativeSpellcheck: true,
    grammar: true,
    style: true,
    typography: true,
    capitalization: true,
    debounceMs: 350,
    disabledRules: [],
    disabledSites: [],
  });
  assert(Object.isFrozen(defaults.DEFAULT_SETTINGS));
});

test("normalizeSettings validates scalars and copies string lists", () => {
  const normalized = defaults.normalizeSettings({
    enabled: false,
    nativeSpellcheck: false,
    grammar: false,
    debounceMs: 12,
    disabledRules: [" RULE_A ", "RULE_A", "", 12],
    disabledSites: ["example.test", "example.test", null],
  });

  assert.deepEqual(normalized, {
    enabled: false,
    nativeSpellcheck: false,
    grammar: false,
    style: true,
    typography: true,
    capitalization: true,
    debounceMs: 100,
    disabledRules: ["RULE_A"],
    disabledSites: ["example.test"],
  });

  assert.equal(defaults.normalizeSettings({ debounceMs: 9000 }).debounceMs, 5000);
  assert.equal(defaults.normalizeSettings({ debounceMs: "invalid" }).debounceMs, 350);
});

test("checker exposes stable rule metadata", () => {
  assert(Array.isArray(checker.RULES));
  assert(checker.RULES.length >= 8);
  assert(Object.isFrozen(checker.RULES));

  const ids = checker.RULES.map((rule) => rule.id);

  assert.equal(new Set(ids).size, ids.length);
  checker.RULES.forEach((rule) => {
    assert.deepEqual(Object.keys(rule), ["id", "category", "title", "description"]);
    assert(["grammar", "style", "typography", "capitalization"].includes(rule.category));
    assert(Object.isFrozen(rule));
  });
});

test("checkText returns sorted issue objects with useful replacements and context", () => {
  const text = "we is ready, and i could of helped.";
  const issues = checker.checkText(text);

  assert.deepEqual(
    issues.map((issue) => issue.ruleId),
    ["SENTENCE_START_CASE", "BASIC_SUBJECT_VERB_AGREEMENT", "LOWERCASE_I", "MODAL_OF"]
  );
  assert.deepEqual(
    issues.map((issue) => issue.offset),
    [...issues.map((issue) => issue.offset)].sort((left, right) => left - right)
  );
  assert.deepEqual(issues[0].replacements, ["W"]);
  assert.deepEqual(issues[1].replacements, ["are"]);
  assert.deepEqual(issues[2].replacements, ["I"]);
  assert.deepEqual(issues[3].replacements, ["could have"]);

  issues.forEach((issue) => {
    assert.deepEqual(Object.keys(issue), [
      "id",
      "ruleId",
      "category",
      "message",
      "offset",
      "length",
      "replacements",
      "context",
    ]);
    assert.equal(issue.context.text.slice(issue.context.offset, issue.context.offset + issue.length), text.slice(issue.offset, issue.offset + issue.length));
  });
});

test("grammar checks use cautious repeat and article exceptions", () => {
  const text = "A apple met an banana. A user waited an hour. I had had enough, and that that was clear.";
  const issues = checker.checkText(text, {
    style: false,
    typography: false,
    capitalization: false,
  });

  assert.deepEqual(
    issues.map((issue) => ({ ruleId: issue.ruleId, replacement: issue.replacements[0] })),
    [
      { ruleId: "A_AN_ARTICLE", replacement: "An" },
      { ruleId: "A_AN_ARTICLE", replacement: "a" },
    ]
  );

  assert.deepEqual(
    checker.checkText("An historic result followed the U.S. government report.", {
      style: false,
      typography: false,
    }),
    []
  );
});

test("category toggles and disabledRules suppress only their own checks", () => {
  assert.deepEqual(
    checker.checkText("They is ready.", {
      grammar: false,
      capitalization: false,
    }),
    []
  );
  assert.deepEqual(
    checker.checkText("They is ready.", {
      disabledRules: ["BASIC_SUBJECT_VERB_AGREEMENT"],
      capitalization: false,
    }),
    []
  );

  const text = "This  works in order to test .";
  const noStyle = checker.checkText(text, { style: false });
  const noTypography = checker.checkText(text, { typography: false });

  assert(!noStyle.some((issue) => issue.category === "style"));
  assert(noStyle.some((issue) => issue.category === "typography"));
  assert(!noTypography.some((issue) => issue.category === "typography"));
  assert(noTypography.some((issue) => issue.category === "style"));
});

test("overlapping candidates resolve to one deterministic issue", () => {
  const issues = checker.checkText("This is  is fine.", {
    capitalization: false,
    style: false,
  });

  assert.deepEqual(issues.map((issue) => issue.ruleId), ["REPEATED_WORD"]);
  assert.equal(issues[0].replacements[0], "is");
});

test("disabled checker and empty input return no issues", () => {
  assert.deepEqual(checker.checkText("They is here.", { enabled: false }), []);
  assert.deepEqual(checker.checkText(""), []);
  assert.deepEqual(checker.checkText(null), []);
});

test("classic-script loading exposes APIs without a module loader", () => {
  const context = vm.createContext({});
  const defaultsSource = fs.readFileSync(
    path.join(__dirname, "../src/shared/defaults.js"),
    "utf8"
  );
  const checkerSource = fs.readFileSync(
    path.join(__dirname, "../src/core/checker.js"),
    "utf8"
  );

  vm.runInContext(defaultsSource, context);
  vm.runInContext(checkerSource, context);

  assert.equal(typeof context.SquiggleSageDefaults.normalizeSettings, "function");
  assert.equal(typeof context.SquiggleSageChecker.checkText, "function");
  assert.equal(context.SquiggleSageChecker.checkText("We is ready.").length, 1);
});
