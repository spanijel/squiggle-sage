"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const errors = [];

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
for (const relativePath of runtimeFiles) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    continue;
  }
  const source = fs.readFileSync(absolutePath, "utf8");
  if (/\beval\s*\(|new\s+Function\s*\(/.test(source)) {
    errors.push(`Remote-code-sensitive construct found in ${relativePath}`);
  }
  if (/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b/.test(source)) {
    errors.push(`Network API found in runtime file ${relativePath}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${runtimeFiles.length} runtime scripts with no extension network path.`);
}
