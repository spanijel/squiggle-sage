"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const Typo = require("../src/vendor/typo-js/typo.js");
const spelling = require("../src/core/spelling.js");
const root = path.resolve(__dirname, "..");
const backgroundSource = fs.readFileSync(
  path.join(root, "src", "background", "background.js"),
  "utf8"
);
const packagedFiles = new Map([
  [
    "moz-extension://squiggle-sage/src/data/en-us/index.aff",
    fs.readFileSync(path.join(root, "src", "data", "en-us", "index.aff"), "utf8")
  ],
  [
    "moz-extension://squiggle-sage/src/data/en-us/index.dic",
    fs.readFileSync(path.join(root, "src", "data", "en-us", "index.dic"), "utf8")
  ]
]);

function loadBackground() {
  let listener;
  const requestedUrls = [];
  const context = vm.createContext({
    Typo,
    SquiggleSageSpelling: spelling,
    browser: {
      runtime: {
        getURL(relativePath) {
          return `moz-extension://squiggle-sage/${relativePath}`;
        },
        onMessage: {
          addListener(nextListener) {
            listener = nextListener;
          }
        }
      }
    },
    fetch(url) {
      requestedUrls.push(url);
      const body = packagedFiles.get(url);
      return Promise.resolve({
        ok: typeof body === "string",
        status: typeof body === "string" ? 200 : 404,
        text: () => Promise.resolve(body || "")
      });
    }
  });
  vm.runInContext(backgroundSource, context, { filename: "background.js" });
  return { listener, requestedUrls };
}

test("background loads only packaged dictionaries and prioritizes personal replacements", async () => {
  const { listener, requestedUrls } = loadBackground();
  assert.equal(typeof listener, "function");

  const response = await listener({
    type: "squiggle-sage:check-spelling",
    text: "teh likededd",
    personalDictionary: [],
    personalReplacements: [{ find: "teh", replace: "the" }]
  });

  assert.deepEqual(requestedUrls.sort(), [...packagedFiles.keys()].sort());
  assert.equal(response.ready, true);
  assert.equal(response.personalReplacementCount, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(response.issues.map((issue) => [issue.ruleId, issue.original]))),
    [
      ["PERSONAL_REPLACEMENT", "teh"],
      ["LOCAL_SPELLING", "likededd"]
    ]
  );
  assert(response.issues[1].replacements.includes("liked"));

  const personalWordResponse = await listener({
    type: "squiggle-sage:check-spelling",
    text: "I use squigglesage daily.",
    personalDictionary: ["squigglesage"],
    personalReplacements: []
  });
  assert.equal(personalWordResponse.issues.length, 0);
  assert.equal(personalWordResponse.personalDictionaryCount, 1);
});
