"use strict";

const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const outputDirectory = path.join(root, "dist");
const extensionName = `squiggle-sage-${manifest.version}-unsigned.xpi`;
const sourceName = `squiggle-sage-${manifest.version}-source.zip`;
const checksumName = `SHA256SUMS-${manifest.version}.txt`;
const extensionPath = path.join(outputDirectory, extensionName);
const sourcePath = path.join(outputDirectory, sourceName);
const checksumPath = path.join(outputDirectory, checksumName);
const packageEntries = [
  "manifest.json",
  "assets/icon.svg",
  "src/shared/defaults.js",
  "src/core/checker.js",
  "src/content/content.css",
  "src/content/content.js",
  "src/content/highlighter.js",
  "src/ui/options.css",
  "src/ui/options.html",
  "src/ui/options.js",
  "src/ui/popup.css",
  "src/ui/popup.html",
  "src/ui/popup.js",
  "LICENSE",
  "NOTICE.md",
  "PRIVACY.md"
];
const sourceEntries = [...new Set([
  ...packageEntries,
  ".gitignore",
  "BUILD.md",
  "README.md",
  "docs/amo-submission.md",
  "docs/capabilities.md",
  "docs/firefox-distribution.md",
  "package.json",
  "scripts/build.cjs",
  "scripts/firefox-smoke.cjs",
  "scripts/validate.cjs",
  "test/manual-smoke.html",
  "tests/checker.test.js"
])];

fs.mkdirSync(outputDirectory, { recursive: true });
for (const entry of fs.readdirSync(outputDirectory, { withFileTypes: true })) {
  if (entry.isFile()) {
    fs.rmSync(path.join(outputDirectory, entry.name), { force: true });
  }
}
for (const artifactPath of [extensionPath, sourcePath, checksumPath]) {
  fs.rmSync(artifactPath, { force: true });
}

function createArchive(outputPath, entries) {
  const result = childProcess.spawnSync("zip", ["-q", "-X", outputPath, ...entries], {
    cwd: root,
    encoding: "utf8"
  });

  if (result.error?.code === "ENOENT" && process.platform === "win32") {
    const archivePath = outputPath.toLowerCase().endsWith(".zip")
      ? outputPath
      : `${outputPath}.zip`;
    const fallback = childProcess.spawnSync(
      "tar.exe",
      ["-a", "-c", "-f", archivePath, ...entries],
      { cwd: root, encoding: "utf8" }
    );
    if (fallback.error) {
      throw fallback.error;
    }
    if (fallback.status !== 0) {
      process.stderr.write(fallback.stderr || "tar.exe ZIP creation failed\n");
      process.exit(fallback.status || 1);
    }
    if (archivePath !== outputPath) {
      fs.renameSync(archivePath, outputPath);
    }
    return;
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "zip failed\n");
    process.exit(result.status || 1);
  }
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

createArchive(extensionPath, packageEntries);
createArchive(sourcePath, sourceEntries);
fs.writeFileSync(
  checksumPath,
  `${sha256(extensionPath)}  ${extensionName}\n${sha256(sourcePath)}  ${sourceName}\n`,
  "utf8"
);

for (const artifactPath of [extensionPath, sourcePath, checksumPath]) {
  console.log(`${artifactPath} (${fs.statSync(artifactPath).size} bytes)`);
}
