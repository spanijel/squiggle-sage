"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const typoPath = path.join(root, "src", "vendor", "typo-js", "typo.js");
const affPath = path.join(root, "src", "data", "en-us", "index.aff");
const dictionaryPath = path.join(root, "src", "data", "en-us", "index.dic");
const PINNED_SHA256 = "38aca145fe2f2ff727d4b8f25c8698c8199f2884a0811458d6fc0d41d1f81ba3";

test("vendored Typo.js remains the unmodified npm typo-js 1.3.2 release", () => {
  const digest = crypto.createHash("sha256").update(fs.readFileSync(typoPath)).digest("hex");
  assert.equal(digest, PINNED_SHA256);
});

test("preloaded packaged dictionary data never invokes the Typo.js loader", () => {
  const Typo = require(typoPath);
  const originalReadFile = Typo.prototype._readFile;
  Typo.prototype._readFile = () => {
    throw new Error("Typo.js loader must not be invoked");
  };

  try {
    const dictionary = new Typo(
      "en_US",
      fs.readFileSync(affPath, "utf8"),
      fs.readFileSync(dictionaryPath, "utf8")
    );
    assert.equal(dictionary.loaded, true);
    assert.equal(dictionary.check("message"), true);
  } finally {
    Typo.prototype._readFile = originalReadFile;
  }
});
