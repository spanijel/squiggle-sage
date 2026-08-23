"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const archivePath = path.join(
  root,
  "dist",
  `squiggle-sage-${manifest.version}-unsigned.xpi`
);
const bidiUrl = process.env.SQUIGGLE_SAGE_BIDI_URL || "ws://127.0.0.1:9223/session";
const testUrl = process.env.SQUIGGLE_SAGE_TEST_URL || "http://127.0.0.1:8765/test/manual-smoke.html";
const screenshotPath = process.env.SQUIGGLE_SAGE_SCREENSHOT || "/private/tmp/squiggle-sage-firefox-smoke.png";

if (typeof WebSocket !== "function") {
  throw new Error("This smoke test requires a Node.js runtime with the built-in WebSocket client.");
}
if (!fs.existsSync(archivePath)) {
  throw new Error(`Build the extension before the smoke test: ${archivePath}`);
}

class BidiClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", () => reject(new Error(`Could not connect to ${this.url}`)), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === "event") {
        this.events.push(message);
        return;
      }
      const waiter = this.pending.get(message.id);
      if (!waiter) {
        return;
      }
      this.pending.delete(message.id);
      if (message.type === "error") {
        waiter.reject(new Error(`${message.error}: ${message.message}`));
      } else {
        waiter.resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function evaluate(client, context, expression) {
  const response = await client.send("script.evaluate", {
    expression,
    target: { context },
    awaitPromise: true
  });
  if (response.result.type !== "string") {
    throw new Error(`Unexpected script result type: ${response.result.type}`);
  }
  return JSON.parse(response.result.value);
}

async function waitFor(client, context, expression, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await evaluate(client, context, expression);
    if (result) {
      return result;
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function clickAt(client, context, x, y) {
  await client.send("input.performActions", {
    context,
    actions: [{
      type: "pointer",
      id: "squiggle-sage-smoke-mouse",
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", x: Math.round(x), y: Math.round(y), duration: 0, origin: "viewport" },
        { type: "pointerDown", button: 0 },
        { type: "pointerUp", button: 0 }
      ]
    }]
  });
  await client.send("input.releaseActions", { context });
}

async function dragFromTo(client, context, start, end) {
  await client.send("input.performActions", {
    context,
    actions: [{
      type: "pointer",
      id: "squiggle-sage-smoke-mouse",
      parameters: { pointerType: "mouse" },
      actions: [
        { type: "pointerMove", x: Math.round(start.x), y: Math.round(start.y), duration: 0, origin: "viewport" },
        { type: "pointerDown", button: 0 },
        { type: "pointerMove", x: Math.round(end.x), y: Math.round(end.y), duration: 300, origin: "viewport" },
        { type: "pointerUp", button: 0 }
      ]
    }]
  });
  await client.send("input.releaseActions", { context });
}

function readOverlayExpression() {
  return `(() => {
    const host = document.querySelector("#squiggle-sage-overlay-host");
    if (!host) {
      return JSON.stringify(null);
    }
    const number = (name) => {
      const value = Number(host.dataset[name]);
      return Number.isFinite(value) ? value : null;
    };
    return JSON.stringify({
      shadowClosed: host.shadowRoot === null,
      issueCount: number("squiggleSageIssueCount"),
      markerCount: number("squiggleSageMarkerCount"),
      badgeText: host.dataset.squiggleSageBadgeText || "",
      badgeX: number("squiggleSageBadgeX"),
      badgeY: number("squiggleSageBadgeY"),
      badgeMoved: host.dataset.squiggleSageBadgeMoved === "true",
      state: host.dataset.squiggleSageState || "",
      cardVisible: host.dataset.squiggleSageCardVisible === "true",
      replacementCount: number("squiggleSageReplacementCount"),
      firstMarkerX: number("squiggleSageFirstMarkerX"),
      firstMarkerY: number("squiggleSageFirstMarkerY"),
      lastMarkerX: number("squiggleSageLastMarkerX"),
      lastMarkerY: number("squiggleSageLastMarkerY"),
      firstReplacementX: number("squiggleSageFirstReplacementX"),
      firstReplacementY: number("squiggleSageFirstReplacementY")
    });
  })()`;
}

async function run() {
  const client = new BidiClient(bidiUrl);
  let extensionId = null;
  await client.connect();
  try {
    const session = await client.send("session.new", {
      capabilities: {
        alwaysMatch: {
          acceptInsecureCerts: true,
          browserName: "firefox"
        }
      }
    });
    await client.send("session.subscribe", { events: ["log.entryAdded"] });
    const installed = await client.send("webExtension.install", {
      extensionData: { type: "archivePath", path: archivePath },
      "moz:allowPrivateBrowsing": false,
      "moz:permanent": false
    });
    extensionId = installed.extension;

    const tree = await client.send("browsingContext.getTree", {});
    const context = tree.contexts[0]?.context;
    if (!context) {
      throw new Error("Firefox did not expose a top-level browsing context.");
    }
    await client.send("browsingContext.navigate", { context, url: testUrl, wait: "complete" });
    await waitFor(
      client,
      context,
      `JSON.stringify(document.documentElement.dataset.squiggleSageLoaded === "true")`
    );

    const beforeText = "this is is a local test ,and i could of written the mispeling.";
    const textareaRect = await evaluate(
      client,
      context,
      `(() => {
        const editor = document.querySelector("textarea");
        editor.value = ${JSON.stringify(beforeText)};
        editor.scrollIntoView({ block: "center" });
        const rect = editor.getBoundingClientRect();
        return JSON.stringify({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
      })()`
    );
    await clickAt(client, context, textareaRect.x, textareaRect.y);
    await delay(900);

    let overlayBefore;
    try {
      overlayBefore = await waitFor(
        client,
        context,
        `(() => {
          const host = document.querySelector("#squiggle-sage-overlay-host");
          return JSON.stringify(host && Number(host.dataset.squiggleSageMarkerCount) >= 4);
        })()`
      );
    } catch (error) {
      const diagnostics = await evaluate(client, context, readOverlayExpression());
      const pageState = await evaluate(
        client,
        context,
        `(() => {
          const editor = document.querySelector("textarea");
          return JSON.stringify({
            extensionLoaded: document.documentElement.dataset.squiggleSageLoaded === "true",
            activeTag: document.activeElement?.tagName || null,
            activeIsTextarea: document.activeElement === editor,
            value: editor?.value || null
          });
        })()`
      );
      const errors = client.events
        .filter((event) => event.method === "log.entryAdded")
        .map((event) => event.params)
        .filter((entry) => entry.level === "error")
        .map((entry) => entry.text);
      throw new Error(`${error.message}\nOverlay diagnostics: ${JSON.stringify(diagnostics)}\nPage state: ${JSON.stringify(pageState)}\nBrowser errors: ${JSON.stringify(errors)}`);
    }
    if (!overlayBefore) {
      throw new Error("The textarea overlay did not become ready.");
    }
    const overlayDiagnostics = await evaluate(client, context, readOverlayExpression());
    const editorBefore = await evaluate(
      client,
      context,
      `(() => {
        const editor = document.querySelector("textarea");
        return JSON.stringify({
          loaded: document.documentElement.dataset.squiggleSageLoaded === "true",
          nativeSpellcheck: editor.spellcheck,
          value: editor.value
        });
      })()`
    );
    const before = { ...editorBefore, ...overlayDiagnostics };

    const badgeTarget = {
      x: Math.max(50, before.badgeX - 120),
      y: Math.max(50, before.badgeY - 55)
    };
    await dragFromTo(
      client,
      context,
      { x: before.badgeX, y: before.badgeY },
      badgeTarget
    );
    const afterDrag = await waitFor(
      client,
      context,
      `(() => {
        const host = document.querySelector("#squiggle-sage-overlay-host");
        const x = Number(host?.dataset.squiggleSageBadgeX);
        const y = Number(host?.dataset.squiggleSageBadgeY);
        if (!host || host.dataset.squiggleSageBadgeMoved !== "true" || Math.abs(x - ${badgeTarget.x}) > 3 || Math.abs(y - ${badgeTarget.y}) > 3) {
          return JSON.stringify(null);
        }
        return ${readOverlayExpression()};
      })()`
    );
    const focusAfterDrag = await evaluate(
      client,
      context,
      `JSON.stringify(document.activeElement === document.querySelector("textarea"))`
    );
    await windowDispatch(client, context, "resize");
    const afterRender = await waitFor(
      client,
      context,
      `(() => {
        const host = document.querySelector("#squiggle-sage-overlay-host");
        const x = Number(host?.dataset.squiggleSageBadgeX);
        const y = Number(host?.dataset.squiggleSageBadgeY);
        if (!host || Math.abs(x - ${afterDrag.badgeX}) > 1 || Math.abs(y - ${afterDrag.badgeY}) > 1) {
          return JSON.stringify(null);
        }
        return ${readOverlayExpression()};
      })()`
    );
    await clickAt(client, context, afterDrag.badgeX, afterDrag.badgeY);
    const badgeCard = await waitFor(
      client,
      context,
      `(() => {
        const host = document.querySelector("#squiggle-sage-overlay-host");
        return JSON.stringify(host?.dataset.squiggleSageCardVisible === "true");
      })()`
    );
    const focusAfterBadgeClick = await evaluate(
      client,
      context,
      `JSON.stringify(document.activeElement === document.querySelector("textarea"))`
    );
    await clickAt(client, context, textareaRect.x, textareaRect.y);
    await waitFor(
      client,
      context,
      `(() => {
        const host = document.querySelector("#squiggle-sage-overlay-host");
        return JSON.stringify(host?.dataset.squiggleSageCardVisible === "false");
      })()`
    );

    const screenshot = await client.send("browsingContext.captureScreenshot", {
      context,
      format: { type: "png" },
      origin: "viewport"
    });
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));

    await clickAt(client, context, before.firstMarkerX, before.firstMarkerY);
    const card = await waitFor(
      client,
      context,
      `(() => {
        const host = document.querySelector("#squiggle-sage-overlay-host");
        if (!host || host.dataset.squiggleSageCardVisible !== "true") {
          return JSON.stringify(null);
        }
        return ${readOverlayExpression()};
      })()`
    );
    await clickAt(client, context, card.firstReplacementX, card.firstReplacementY);
    const expectedAfterText = "This is is a local test ,and i could of written the mispeling.";
    await waitFor(
      client,
      context,
      `JSON.stringify(document.querySelector("textarea").value === ${JSON.stringify(expectedAfterText)})`
    );
    const after = await evaluate(
      client,
      context,
      `(() => {
        const editor = document.querySelector("textarea");
        return JSON.stringify({
          value: editor.value,
          selectionStart: editor.selectionStart,
          selectionEnd: editor.selectionEnd
        });
      })()`
    );

    const inputResult = await focusAndReadEditor(
      client,
      context,
      `document.querySelector("input[type='text']")`
    );
    const richTextResult = await focusAndReadEditor(
      client,
      context,
      `document.querySelector("[contenteditable]")`
    );
    await clickAt(client, context, richTextResult.lastMarkerX, richTextResult.lastMarkerY);
    const richCard = await waitFor(
      client,
      context,
      `(() => {
        const host = document.querySelector("#squiggle-sage-overlay-host");
        if (!host || host.dataset.squiggleSageCardVisible !== "true") {
          return JSON.stringify(null);
        }
        return ${readOverlayExpression()};
      })()`
    );
    await clickAt(client, context, richCard.firstReplacementX, richCard.firstReplacementY);
    await waitFor(
      client,
      context,
      `JSON.stringify(document.querySelector("[contenteditable]").innerText.includes("i would have corrected"))`
    );
    const richTextAfter = await evaluate(
      client,
      context,
      `JSON.stringify(document.querySelector("[contenteditable]").innerText)`
    );

    const browserErrors = client.events
      .filter((event) => event.method === "log.entryAdded")
      .map((event) => event.params)
      .filter((entry) => entry.level === "error")
      .map((entry) => entry.text);
    const passed = before.loaded
      && before.nativeSpellcheck
      && before.shadowClosed
      && before.markerCount >= 4
      && afterDrag.badgeMoved
      && Math.abs(afterDrag.badgeX - before.badgeX) >= 100
      && Math.abs(afterDrag.badgeY - before.badgeY) >= 40
      && afterDrag.cardVisible === false
      && focusAfterDrag
      && afterRender.badgeMoved
      && badgeCard
      && focusAfterBadgeClick
      && card.cardVisible
      && card.replacementCount > 0
      && after.value === expectedAfterText
      && after.selectionStart === 1
      && after.selectionEnd === 1
      && inputResult.markerCount >= 3
      && richTextResult.markerCount >= 4
      && richTextAfter.includes("i would have corrected")
      && browserErrors.length === 0;
    const receipt = {
      passed,
      browserVersion: session.capabilities.browserVersion,
      extensionId,
      before,
      afterDrag,
      focusAfterDrag,
      afterRender,
      badgeCard,
      focusAfterBadgeClick,
      card,
      after,
      inputResult,
      richTextResult,
      richCard,
      richTextAfter,
      screenshotPath,
      browserErrors
    };
    console.log(JSON.stringify(receipt, null, 2));
    if (!passed) {
      process.exitCode = 1;
    }
  } finally {
    if (extensionId) {
      await client.send("webExtension.uninstall", { extension: extensionId }).catch(() => {});
    }
    await client.send("browser.close", {}).catch(() => {});
    client.close();
  }
}

async function windowDispatch(client, context, eventName) {
  await evaluate(
    client,
    context,
    `(() => {
      window.dispatchEvent(new Event(${JSON.stringify(eventName)}));
      return JSON.stringify(true);
    })()`
  );
}

async function focusAndReadEditor(client, context, selectorExpression) {
  const rect = await evaluate(
    client,
    context,
    `(() => {
      const editor = ${selectorExpression};
      editor.scrollIntoView({ block: "center" });
      const bounds = editor.getBoundingClientRect();
      return JSON.stringify({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 });
    })()`
  );
  await clickAt(client, context, rect.x, rect.y);
  await delay(700);
  return evaluate(
    client,
    context,
    readOverlayExpression()
  );
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
