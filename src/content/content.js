(function installContentScript(global) {
  "use strict";

  const extensionApi = global.browser || global.chrome;
  const defaultsApi = global.SquiggleSageDefaults;
  const checkerApi = global.SquiggleSageChecker;
  const spellingApi = global.SquiggleSageSpelling;
  const highlighterApi = global.SquiggleSageHighlighter;
  if (!extensionApi || !defaultsApi || !checkerApi || !spellingApi || !highlighterApi) {
    return;
  }

  const CODE_EDITOR_SELECTOR = [
    ".ace_editor",
    ".CodeMirror",
    ".monaco-editor",
    "[data-squiggle-sage='off']",
    "[role='textbox'][aria-roledescription*='code' i]"
  ].join(",");
  const modifiedSpellcheck = new Map();
  let settings = defaultsApi.normalizeSettings({});
  let activeController = null;
  let overlay = null;

  function elementTag(element) {
    return typeof element?.localName === "string" ? element.localName.toLowerCase() : "";
  }

  function isDomElement(value) {
    return value?.nodeType === 1 && typeof value.closest === "function";
  }

  function getOverlay() {
    if (!overlay) {
      overlay = new highlighterApi.OverlayView(handleOverlayAction);
    }
    return overlay;
  }

  function isSupportedEditor(element) {
    if (!isDomElement(element)) {
      return false;
    }
    if (element.closest(CODE_EDITOR_SELECTOR)) {
      return false;
    }
    if (elementTag(element) === "textarea") {
      return !element.disabled && !element.readOnly;
    }
    if (elementTag(element) === "input") {
      return highlighterApi.isTextControl(element) && !element.disabled && !element.readOnly;
    }
    return element.isContentEditable && !element.closest("[contenteditable='false']");
  }

  function editableFromPath(path) {
    for (const value of path) {
      if (!isDomElement(value)) {
        continue;
      }
      if (["textarea", "input"].includes(elementTag(value)) && isSupportedEditor(value)) {
        return value;
      }
      const editable = value.closest("[contenteditable]");
      if (editable && isSupportedEditor(editable)) {
        return editable;
      }
    }
    return null;
  }

  function normalizeDomainPattern(value) {
    return String(value || "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  }

  function isSiteDisabled(hostname, patterns) {
    const host = String(hostname || "").toLowerCase();
    return (patterns || []).some((rawPattern) => {
      const pattern = normalizeDomainPattern(rawPattern);
      if (!pattern) {
        return false;
      }
      return host === pattern;
    });
  }

  function effectiveHostname() {
    if (location.hostname) {
      return location.hostname;
    }
    try {
      if (global.top !== global && global.top.location.hostname) {
        return global.top.location.hostname;
      }
    } catch (_error) {
      // Cross-origin parent access is expected to fail here.
    }
    try {
      return document.referrer ? new URL(document.referrer).hostname : "";
    } catch (_error) {
      return "";
    }
  }

  function siteCheckingEnabled() {
    return settings.enabled && !isSiteDisabled(effectiveHostname(), settings.disabledSites);
  }

  function setNativeSpellcheck(element) {
    if (!modifiedSpellcheck.has(element)) {
      modifiedSpellcheck.set(element, element.getAttribute("spellcheck"));
    }
    if (settings.nativeSpellcheck && siteCheckingEnabled()) {
      element.setAttribute("spellcheck", "true");
      element.spellcheck = true;
    } else {
      restoreNativeSpellcheck(element);
    }
  }

  function restoreNativeSpellcheck(element) {
    if (!modifiedSpellcheck.has(element)) {
      return;
    }
    const original = modifiedSpellcheck.get(element);
    if (original === null) {
      element.removeAttribute("spellcheck");
    } else {
      element.setAttribute("spellcheck", original);
    }
    modifiedSpellcheck.delete(element);
  }

  function restoreAllSpellcheck() {
    for (const element of [...modifiedSpellcheck.keys()]) {
      restoreNativeSpellcheck(element);
    }
  }

  function issueKey(issue, text) {
    const original = text.slice(issue.offset, issue.offset + issue.length);
    return `${issue.ruleId}:${issue.offset}:${issue.length}:${original}`;
  }

  function normalizeIssues(issues, text) {
    return (Array.isArray(issues) ? issues : [])
      .filter((issue) => Number.isInteger(issue.offset) && Number.isInteger(issue.length) && issue.length > 0)
      .filter((issue) => issue.offset >= 0 && issue.offset + issue.length <= text.length)
      .map((issue, index) => ({
        ...issue,
        id: issue.id || `${issue.ruleId || "rule"}:${issue.offset}:${issue.length}:${index}`,
        category: ["spelling", "grammar", "capitalization", "style", "typography"].includes(issue.category)
          ? issue.category
          : "grammar",
        original: text.slice(issue.offset, issue.offset + issue.length),
        replacements: Array.isArray(issue.replacements) ? issue.replacements.map(String) : []
      }));
  }

  function categoryEnabled(issue) {
    if (issue.category === "spelling") {
      return settings.spelling;
    }
    if (issue.category === "style") {
      return settings.style;
    }
    if (issue.category === "typography") {
      return settings.typography;
    }
    if (issue.category === "capitalization") {
      return settings.capitalization;
    }
    return settings.grammar;
  }

  function sendRuntimeMessage(message) {
    if (global.browser) {
      return extensionApi.runtime.sendMessage(message);
    }
    return new Promise((resolve, reject) => {
      extensionApi.runtime.sendMessage(message, (response) => {
        const error = extensionApi.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(response);
      });
    });
  }

  async function checkSpelling(text) {
    if (!settings.spelling) {
      return { issues: [], personalDictionaryCount: 0 };
    }
    const response = await sendRuntimeMessage({
      type: "squiggle-sage:check-spelling",
      text,
      personalDictionary: settings.personalDictionary
    });
    return {
      issues: Array.isArray(response?.issues) ? response.issues : [],
      personalDictionaryCount: Number(response?.personalDictionaryCount) || 0
    };
  }

  class EditorController {
    constructor(element) {
      this.element = element;
      this.composing = false;
      this.ignored = new Set();
      this.issues = [];
      this.revision = 0;
      this.timer = null;
      this.onInput = () => {
        if (!this.composing) {
          this.schedule();
        }
      };
      this.onCompositionStart = () => {
        this.composing = true;
        clearTimeout(this.timer);
        getOverlay().clear();
      };
      this.onCompositionEnd = () => {
        this.composing = false;
        this.schedule(0);
      };
      element.addEventListener("input", this.onInput);
      element.addEventListener("compositionstart", this.onCompositionStart);
      element.addEventListener("compositionend", this.onCompositionEnd);
      this.resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(() => this.render())
        : null;
      this.resizeObserver?.observe(element);
      setNativeSpellcheck(element);
      this.schedule(0);
    }

    schedule(delay = settings.debounceMs) {
      clearTimeout(this.timer);
      const revision = ++this.revision;
      this.timer = setTimeout(() => this.check(revision), Math.max(0, delay));
    }

    async check(revision) {
      if (revision !== this.revision || this.composing || !siteCheckingEnabled()) {
        this.clear();
        return;
      }
      const text = highlighterApi.getEditableText(this.element);
      if (text.trim().length < 2) {
        this.issues = [];
        this.render();
        return;
      }
      const localIssues = checkerApi.checkText(text, settings);
      let spellingIssues = [];
      let spellingPersonalDictionaryCount = 0;
      if (settings.spelling) {
        try {
          const spellingResult = await checkSpelling(text);
          spellingIssues = spellingResult.issues;
          spellingPersonalDictionaryCount = spellingResult.personalDictionaryCount;
        } catch (_error) {
          spellingIssues = [];
        }
      }
      if (
        revision !== this.revision ||
        this.composing ||
        activeController !== this ||
        !this.element.isConnected ||
        !siteCheckingEnabled()
      ) {
        return;
      }
      this.issues = normalizeIssues([...localIssues, ...spellingIssues], text)
        .filter(categoryEnabled)
        .filter((issue) => !this.ignored.has(issueKey(issue, text)));
      this.lastSpellingIssueCount = spellingIssues.length;
      this.lastSpellingPersonalDictionaryCount = spellingPersonalDictionaryCount;
      this.render();
    }

    render() {
      if (activeController !== this || !siteCheckingEnabled()) {
        return;
      }
      const view = getOverlay();
      view.host.dataset.squiggleSagePersonalDictionaryCount = String(
        settings.personalDictionary?.length || 0
      );
      view.host.dataset.squiggleSageSpellingIssueCount = String(this.lastSpellingIssueCount || 0);
      view.host.dataset.squiggleSageSpellingPersonalDictionaryCount = String(
        this.lastSpellingPersonalDictionaryCount || 0
      );
      view.render(this.element, this.issues);
    }

    clear() {
      this.issues = [];
      if (activeController === this) {
        getOverlay().clear();
      }
    }

    ignore(issue) {
      const text = highlighterApi.getEditableText(this.element);
      this.ignored.add(issueKey(issue, text));
      this.issues = this.issues.filter((candidate) => candidate.id !== issue.id);
      this.render();
    }

    replace(issue, replacement) {
      this.element.focus({ preventScroll: true });
      const textModel = highlighterApi.isTextControl(this.element)
        ? null
        : highlighterApi.buildEditableTextModel(this.element);
      const currentText = textModel
        ? textModel.text
        : highlighterApi.getEditableText(this.element);
      if (currentText.slice(issue.offset, issue.offset + issue.length) !== issue.original) {
        this.schedule(0);
        return;
      }
      if (textModel && issue.original.includes("\n")) {
        this.schedule(0);
        return;
      }
      if (highlighterApi.isTextControl(this.element)) {
        this.element.setRangeText(replacement, issue.offset, issue.offset + issue.length, "end");
        this.element.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          composed: true,
          data: replacement,
          inputType: "insertReplacementText"
        }));
        return;
      }
      const start = highlighterApi.resolveTextPosition(
        this.element,
        issue.offset,
        "forward",
        textModel
      );
      const end = highlighterApi.resolveTextPosition(
        this.element,
        issue.offset + issue.length,
        "backward",
        textModel
      );
      if (!start || !end) {
        this.schedule(0);
        return;
      }
      const range = document.createRange();
      try {
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
      } catch (_error) {
        this.schedule(0);
        return;
      }
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      const inserted = document.execCommand("insertText", false, replacement);
      if (!inserted) {
        range.deleteContents();
        const replacementNode = document.createTextNode(replacement);
        range.insertNode(replacementNode);
        range.setStartAfter(replacementNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        this.element.dispatchEvent(new InputEvent("input", {
          bubbles: true,
          composed: true,
          data: replacement,
          inputType: "insertReplacementText"
        }));
      }
      this.schedule(0);
    }

    destroy() {
      clearTimeout(this.timer);
      this.revision += 1;
      this.element.removeEventListener("input", this.onInput);
      this.element.removeEventListener("compositionstart", this.onCompositionStart);
      this.element.removeEventListener("compositionend", this.onCompositionEnd);
      this.resizeObserver?.disconnect();
    }
  }

  async function handleOverlayAction(action) {
    if (!activeController) {
      return;
    }
    if (action.type === "replace") {
      activeController.replace(action.issue, action.replacement);
      return;
    }
    if (action.type === "ignore") {
      activeController.ignore(action.issue);
      return;
    }
    if (action.type === "add-to-dictionary") {
      const word = spellingApi.normalizePersonalWord(action.issue.original);
      if (!word) {
        return;
      }
      const personalDictionary = spellingApi.normalizePersonalWords([
        ...(settings.personalDictionary || []),
        word
      ]);
      settings = defaultsApi.normalizeSettings({ ...settings, personalDictionary });
      await extensionApi.storage.local.set({ settings });
      activeController?.schedule(0);
      return;
    }
    if (action.type === "disable-rule") {
      const disabledRules = [...new Set([...settings.disabledRules, action.issue.ruleId])];
      settings = defaultsApi.normalizeSettings({ ...settings, disabledRules });
      await extensionApi.storage.local.set({ settings });
      activeController.schedule(0);
    }
  }

  function activate(element) {
    if (!siteCheckingEnabled() || !isSupportedEditor(element)) {
      return;
    }
    getOverlay();
    if (activeController?.element === element) {
      setNativeSpellcheck(element);
      activeController.render();
      return;
    }
    activeController?.destroy();
    activeController = new EditorController(element);
  }

  function deactivateActiveEditor() {
    if (!activeController) {
      return;
    }
    const element = activeController.element;
    activeController.destroy();
    activeController = null;
    restoreNativeSpellcheck(element);
    overlay?.clear();
  }

  function refreshAfterSettingsChange() {
    if (!siteCheckingEnabled()) {
      restoreAllSpellcheck();
      activeController?.clear();
      return;
    }
    if (!settings.nativeSpellcheck) {
      restoreAllSpellcheck();
    }
    if (activeController) {
      setNativeSpellcheck(activeController.element);
      activeController.schedule(0);
    }
  }

  async function loadSettings() {
    const stored = await extensionApi.storage.local.get("settings");
    settings = defaultsApi.normalizeSettings(stored.settings || {});
    refreshAfterSettingsChange();
  }

  function activateFromEvent(event) {
    const path = event.composedPath();
    const element = editableFromPath(path);
    if (element) {
      activate(element);
    } else if (!overlay || !path.includes(overlay.host)) {
      overlay?.hideCard();
    }
  }

  const editorRemovalObserver = new MutationObserver(() => {
    if (activeController && !activeController.element.isConnected) {
      deactivateActiveEditor();
    }
  });
  editorRemovalObserver.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("pointerdown", activateFromEvent, true);
  document.addEventListener("focus", activateFromEvent, true);
  document.addEventListener("scroll", () => activeController?.render(), true);
  global.addEventListener("resize", () => activeController?.render());
  global.addEventListener("pagehide", () => {
    editorRemovalObserver.disconnect();
    deactivateActiveEditor();
    restoreAllSpellcheck();
  }, { once: true });
  extensionApi.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.settings) {
      settings = defaultsApi.normalizeSettings(changes.settings.newValue || {});
      refreshAfterSettingsChange();
    }
  });
  extensionApi.runtime.onMessage.addListener((message) => {
    if (message?.type === "squiggle-sage:get-content-status") {
      return Promise.resolve({
        active: Boolean(activeController),
        enabled: siteCheckingEnabled(),
        issueCount: activeController?.issues.length || 0
      });
    }
    return undefined;
  });

  loadSettings().then(() => {
    const active = document.activeElement;
    if (isSupportedEditor(active)) {
      activate(active);
    }
    document.documentElement.dataset.squiggleSageLoaded = "true";
  });

})(globalThis);
