"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const Typo = require("../src/vendor/typo-js/typo.js");
const spelling = require("../src/core/spelling.js");

const affData = fs.readFileSync(path.join(__dirname, "../src/data/en-us/index.aff"), "utf8");
const dictionaryData = fs.readFileSync(path.join(__dirname, "../src/data/en-us/index.dic"), "utf8");
const dictionary = new Typo("en_US", affData, dictionaryData);
const checker = spelling.createSpellingChecker(dictionary);

test("bundled dictionary loads and detects the reported misspelling", () => {
  assert.equal(dictionary.loaded, true);
  assert.equal(dictionary.check("liked"), true);
  assert.equal(dictionary.check("likededd"), false);

  const issues = checker.checkText("I likededd this message.");
  assert.equal(issues.length, 1);
  assert.equal(issues[0].original, "likededd");
  assert.equal(issues[0].offset, 2);
  assert.equal(issues[0].category, "spelling");
  assert(issues[0].replacements.includes("liked"));
});

test("spelling offsets and suggestions are deterministic", () => {
  const text = "A mesage with a mispeling and an adress.";
  const issues = checker.checkText(text);

  assert.deepEqual(issues.map((issue) => issue.original), ["mesage", "mispeling", "adress"]);
  for (const issue of issues) {
    assert.equal(text.slice(issue.offset, issue.offset + issue.length), issue.original);
    assert(issue.replacements.length <= 4);
  }
  assert(issues[0].replacements.includes("message"));
  assert(issues[1].replacements.includes("misspelling"));
  assert(issues[2].replacements.includes("address"));
});

test("tokenizer excludes web and code-like content", () => {
  const text = [
    "Visit https://exampl.invalid/mispeling today.",
    "Email likededd@example.invalid or mention @likededd.",
    "Keep camelCaseValue, snake_case_value, release-2026, API, and 12th unchanged."
  ].join(" ");

  assert.deepEqual(checker.checkText(text), []);
});

test("personal dictionary is normalized and suppresses matching issues", () => {
  assert.equal(spelling.normalizePersonalWord("  SquiggleSage  "), "squigglesage");
  assert.equal(spelling.normalizePersonalWord("not valid!"), "");
  assert.deepEqual(
    spelling.normalizePersonalWords(["SquiggleSage", "squigglesage", "Codex", ""]),
    ["codex", "squigglesage"]
  );

  assert.equal(checker.checkText("squigglesage likededd", ["SquiggleSage"]).length, 1);
  assert.equal(checker.checkText("squigglesage", ["SquiggleSage"]).length, 0);
});

test("personal replacements are normalized as bounded inert literal pairs", () => {
  const normalized = spelling.normalizePersonalReplacements([
    { find: "  teh  ", replace: " the " },
    { find: "TEH", replace: "duplicate" },
    { find: "two   spaces", replace: "one space" },
    { find: "unsafe\ntext", replace: "blocked" },
    { find: "hidden\u202econtrol", replace: "blocked" },
    { find: "same", replace: "same" },
    null
  ]);

  assert.deepEqual(normalized, [
    { find: "teh", replace: "the" },
    { find: "two spaces", replace: "one space" }
  ]);
});

test("personal replacements use whole literal ranges and preserve explicit casing", () => {
  const text = "teh cathedral iphone iPhone two spaces";
  const issues = spelling.checkPersonalReplacements(text, [
    { find: "teh", replace: "the" },
    { find: "iphone", replace: "iPhone" },
    { find: "two spaces", replace: "one space" }
  ]);

  assert.deepEqual(
    issues.map((issue) => [issue.original, issue.replacements[0], issue.offset]),
    [
      ["teh", "the", 0],
      ["iphone", "iPhone", 14],
      ["two spaces", "one space", 28]
    ]
  );
  assert(issues.every((issue) => issue.ruleId === "PERSONAL_REPLACEMENT"));
});

test("overlapping personal replacements resolve deterministically and stay bounded", () => {
  const issues = spelling.checkPersonalReplacements(
    "new york new york new york",
    [
      { find: "new", replace: "old" },
      { find: "new york", replace: "NYC" }
    ],
    { maxIssues: 2 }
  );

  assert.deepEqual(issues.map((issue) => issue.original), ["new york", "new york"]);
});

test("common correct prose does not produce spelling issues", () => {
  const text = "The local writing assistant checks ordinary English words while you type and keeps your private text inside Firefox.";
  assert.deepEqual(checker.checkText(text), []);
});

test("curated common misspellings are detected with useful top-four suggestions", () => {
  const cases = new Map([
    ["teh", "the"],
    ["recieve", "receive"],
    ["seperate", "separate"],
    ["occured", "occurred"],
    ["untill", "until"],
    ["definately", "definitely"],
    ["accomodate", "accommodate"],
    ["goverment", "government"],
    ["tommorow", "tomorrow"],
    ["wierd", "weird"]
  ]);
  let usefulSuggestions = 0;
  for (const [misspelling, correction] of cases) {
    const issue = checker.checkText(misspelling)[0];
    assert(issue, `Expected ${misspelling} to be detected`);
    if (issue.replacements.includes(correction)) {
      usefulSuggestions += 1;
    }
  }
  assert(usefulSuggestions / cases.size >= 0.9);
});

test("warm checking stays responsive for a 5,000-character correct editor", () => {
  const text = (
    "The local writing assistant checks ordinary English words while you type and keeps private text inside Firefox. "
  ).repeat(50);
  const started = performance.now();
  const issues = checker.checkText(text);
  const elapsed = performance.now() - started;

  assert.deepEqual(issues, []);
  assert(text.length >= 5000);
  assert(elapsed < 100, `Warm spelling check took ${elapsed.toFixed(1)} ms`);
});

test("checker bounds issue and suggestion work", () => {
  const bounded = spelling.createSpellingChecker(dictionary, {
    maxIssues: 2,
    maxSuggestions: 3,
    maxSuggestionWords: 1
  });
  const issues = bounded.checkText("mispeling mesage adress");

  assert.equal(issues.length, 2);
  assert(issues[0].replacements.length <= 3);
  assert.deepEqual(issues[1].replacements, []);
});
