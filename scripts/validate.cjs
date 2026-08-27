"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];
const TYPO_VENDOR_PATH = "src/vendor/typo-js/typo.js";
const TYPO_VENDOR_SHA256 = "38aca145fe2f2ff727d4b8f25c8698c8199f2884a0811458d6fc0d41d1f81ba3";

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Missing manifest target: ${relativePath}`);
  }
}

if (manifest.manifest_version !== 3) {
  errors.push("manifest_version must be 3");
}
for (const script of manifest.background?.scripts || []) {
  requireFile(script);
}
for (const contentScript of manifest.content_scripts || []) {
  for (const file of [...(contentScript.js || []), ...(contentScript.css || [])]) {
    requireFile(file);
  }
}
requireFile(manifest.action?.default_popup);
requireFile(manifest.options_ui?.page);
for (const icon of Object.values(manifest.icons || {})) {
  requireFile(icon);
}

if (manifest.host_permissions?.length) {
  errors.push("Editor access must stay in content_scripts.matches, not a separate host_permissions entry");
}
if (manifest.optional_host_permissions?.length) {
  errors.push("The extension must not declare optional host_permissions entries");
}

const dataPermissions = manifest.browser_specific_settings?.gecko?.data_collection_permissions;
if (!dataPermissions?.required?.includes("none")) {
  errors.push("The offline default must declare no required data transmission");
}
if (dataPermissions?.optional?.length) {
  errors.push("The extension must not declare optional data collection");
}

const runtimeFiles = [
  ...(manifest.background?.scripts || []),
  ...(manifest.content_scripts || []).flatMap((entry) => entry.js || []),
  "src/ui/popup.js",
  "src/ui/options.js"
];
const typoVendorSource = fs.readFileSync(path.join(root, TYPO_VENDOR_PATH));
const typoVendorHash = crypto.createHash("sha256").update(typoVendorSource).digest("hex");
if (typoVendorHash !== TYPO_VENDOR_SHA256) {
  errors.push(`Typo.js must remain the unmodified npm typo-js@1.3.2 release (${TYPO_VENDOR_SHA256})`);
}

const backgroundSource = fs.readFileSync(path.join(root, "src/background/background.js"), "utf8");
if (!backgroundSource.includes('new global.Typo("en_US", affData, dictionaryData)')) {
  errors.push("Background spelling must construct Typo.js with both packaged dictionary strings");
}
const contentSource = fs.readFileSync(path.join(root, "src/content/content.js"), "utf8");
if (!contentSource.includes("personalReplacements: settings.personalReplacements")) {
  errors.push("Content checks must pass normalized personal replacements to the local background engine");
}

for (const relativePath of runtimeFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    continue;
  }
  const source = fs.readFileSync(absolutePath, "utf8");
  if (/\beval\s*\(|new\s+Function\s*\(/.test(source)) {
    errors.push(`Remote-code-sensitive construct found in ${relativePath}`);
  }
  const packagedFetch = relativePath === "src/background/background.js"
    && source.includes("runtime.getURL(relativePath)")
    && !/https?:\/\//i.test(source);
  const pinnedTypoLoader = relativePath === TYPO_VENDOR_PATH && typoVendorHash === TYPO_VENDOR_SHA256;
  if (
    (/\bfetch\s*\(/.test(source) && !packagedFetch) ||
    (/\bXMLHttpRequest\b|\bWebSocket\b/.test(source) && !pinnedTypoLoader)
  ) {
    errors.push(`Network API found in runtime file ${relativePath}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${runtimeFiles.length} runtime scripts with no reachable extension network path.`);
}
