(function () {
  "use strict";

  const extensionApi = globalThis.browser || globalThis.chrome;
  const defaultsApi = globalThis.SquiggleSageDefaults || {};
  const checkerApi = globalThis.SquiggleSageChecker || {};
  const fallbackSettings = {
    enabled: true,
    nativeSpellcheck: true,
    grammar: true,
    style: true,
    typography: true,
    capitalization: true,
    debounceMs: 350,
    disabledRules: [],
    disabledSites: []
  };
  const categoryLabels = {
    grammar: "Grammar",
    style: "Style",
    typography: "Typography",
    capitalization: "Capitalization"
  };

  const form = document.querySelector("#settings-form");
  const enabledInput = document.querySelector("#enabled");
  const nativeSpellcheckInput = document.querySelector("#native-spellcheck");
  const grammarInput = document.querySelector("#grammar");
  const styleInput = document.querySelector("#style");
  const typographyInput = document.querySelector("#typography");
  const capitalizationInput = document.querySelector("#capitalization");
  const debounceInput = document.querySelector("#debounce-ms");
  const disabledSitesInput = document.querySelector("#disabled-sites");
  const rulesContainer = document.querySelector("#rules-container");
  const saveStatus = document.querySelector("#save-status");
  const saveButton = document.querySelector("#save-button");
  const resetButton = document.querySelector("#reset-button");

  function normalizeSettings(input) {
    if (typeof defaultsApi.normalizeSettings === "function") {
      return defaultsApi.normalizeSettings(input);
    }

    return {
      ...fallbackSettings,
      ...(defaultsApi.DEFAULT_SETTINGS || {}),
      ...(input || {})
    };
  }

  const defaultSettings = normalizeSettings(defaultsApi.DEFAULT_SETTINGS || fallbackSettings);

  function getStoredSettings() {
    if (globalThis.browser) {
      return extensionApi.storage.local.get("settings");
    }

    return new Promise((resolve, reject) => {
      extensionApi.storage.local.get("settings", (result) => {
        const error = extensionApi.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      });
    });
  }

  function setStoredSettings(settings) {
    if (globalThis.browser) {
      return extensionApi.storage.local.set({ settings });
    }

    return new Promise((resolve, reject) => {
      extensionApi.storage.local.set({ settings }, () => {
        const error = extensionApi.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  function setStatus(message, kind = "") {
    saveStatus.textContent = message;
    saveStatus.className = kind;
  }

  function setBusy(busy) {
    saveButton.disabled = busy;
    resetButton.disabled = busy;
  }

  function formatCategory(category) {
    if (categoryLabels[category]) {
      return categoryLabels[category];
    }
    return String(category || "Other").replace(/(^|[-_])([a-z])/g, (_match, prefix, letter) => `${prefix ? " " : ""}${letter.toUpperCase()}`);
  }

  function availableRules() {
    if (Array.isArray(checkerApi.RULES)) {
      return checkerApi.RULES.filter((rule) => rule && typeof rule.id === "string");
    }

    if (checkerApi.RULES && typeof checkerApi.RULES === "object") {
      return Object.values(checkerApi.RULES).filter((rule) => rule && typeof rule.id === "string");
    }

    return [];
  }

  function buildRuleControls() {
    const rules = availableRules();
    rulesContainer.replaceChildren();

    if (rules.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.className = "empty-rules";
      emptyMessage.textContent = "No individually configurable built-in rules are available.";
      rulesContainer.append(emptyMessage);
      return;
    }

    const groups = new Map();
    for (const rule of rules) {
      const category = rule.category || "other";
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category).push(rule);
    }

    for (const [category, categoryRules] of groups) {
      const group = document.createElement("section");
      group.className = "rule-group";
      group.dataset.category = category;

      const heading = document.createElement("h3");
      heading.textContent = formatCategory(category);
      group.append(heading);

      for (const rule of categoryRules) {
        const label = document.createElement("label");
        label.className = "rule-row";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.ruleId = rule.id;
        input.dataset.category = category;

        const mark = document.createElement("span");
        mark.className = "check-mark";
        mark.setAttribute("aria-hidden", "true");

        const copy = document.createElement("span");
        copy.className = "rule-copy";

        const title = document.createElement("strong");
        title.textContent = rule.title || rule.id;
        copy.append(title);

        if (rule.description) {
          const description = document.createElement("small");
          description.textContent = rule.description;
          copy.append(description);
        }

        label.append(input, mark, copy);
        group.append(label);
      }

      rulesContainer.append(group);
    }
  }

  function populateForm(settings) {
    const normalized = normalizeSettings(settings);
    buildRuleControls();
    enabledInput.checked = normalized.enabled;
    nativeSpellcheckInput.checked = normalized.nativeSpellcheck;
    grammarInput.checked = normalized.grammar;
    styleInput.checked = normalized.style;
    typographyInput.checked = normalized.typography;
    capitalizationInput.checked = normalized.capitalization;
    debounceInput.value = normalized.debounceMs;
    disabledSitesInput.value = normalized.disabledSites.join("\n");

    const disabledRules = new Set(normalized.disabledRules);
    for (const input of rulesContainer.querySelectorAll("input[data-rule-id]")) {
      input.checked = !disabledRules.has(input.dataset.ruleId);
    }

    syncDependentControls();
  }

  function parseDisabledSites(value) {
    const sites = new Set();
    const lines = value.split(/\r?\n/);

    for (const rawLine of lines) {
      const entry = rawLine.trim().toLowerCase();
      if (!entry) {
        continue;
      }
      if (entry.includes("://") || /[/?#*@]/.test(entry)) {
        throw new Error(`Use a hostname only for "${rawLine.trim()}".`);
      }

      let parsed;
      try {
        parsed = new URL(`http://${entry}/`);
      } catch (_error) {
        throw new Error(`"${rawLine.trim()}" is not a valid hostname.`);
      }

      if (parsed.port || parsed.hostname.length === 0) {
        throw new Error(`Use a hostname without a port for "${rawLine.trim()}".`);
      }
      sites.add(parsed.hostname.replace(/\.$/, ""));
    }

    return [...sites].sort();
  }

  function readForm() {
    const debounceMs = Number(debounceInput.value);
    if (!Number.isInteger(debounceMs) || debounceMs < 100 || debounceMs > 5000) {
      throw new Error("Typing delay must be a whole number from 100 to 5000 milliseconds.");
    }

    const disabledRules = [...rulesContainer.querySelectorAll("input[data-rule-id]")]
      .filter((input) => !input.checked)
      .map((input) => input.dataset.ruleId)
      .sort();

    return normalizeSettings({
      enabled: enabledInput.checked,
      nativeSpellcheck: nativeSpellcheckInput.checked,
      grammar: grammarInput.checked,
      style: styleInput.checked,
      typography: typographyInput.checked,
      capitalization: capitalizationInput.checked,
      debounceMs,
      disabledSites: parseDisabledSites(disabledSitesInput.value),
      disabledRules
    });
  }

  function syncDependentControls() {
    const categoryState = {
      grammar: grammarInput.checked,
      style: styleInput.checked,
      typography: typographyInput.checked,
      capitalization: capitalizationInput.checked
    };
    for (const input of rulesContainer.querySelectorAll("input[data-category]")) {
      input.disabled = categoryState[input.dataset.category] === false;
    }
  }

  for (const input of [grammarInput, styleInput, typographyInput, capitalizationInput]) {
    input.addEventListener("change", syncDependentControls);
  }

  form.addEventListener("input", () => {
    if (!saveButton.disabled) {
      setStatus("Unsaved changes");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("");

    let nextSettings;
    try {
      nextSettings = readForm();
    } catch (error) {
      setStatus(error.message, "error");
      return;
    }

    setBusy(true);
    try {
      await setStoredSettings(nextSettings);
      populateForm(nextSettings);
      setStatus("Settings saved.", "success");
    } catch (_error) {
      setStatus("Could not save settings. Try again.", "error");
    } finally {
      setBusy(false);
    }
  });

  resetButton.addEventListener("click", async () => {
    if (!window.confirm("Reset all SquiggleSage settings and disabled websites to their defaults?")) {
      return;
    }

    setBusy(true);
    setStatus("");
    try {
      await setStoredSettings(defaultSettings);
      populateForm(defaultSettings);
      setStatus("Default settings restored.", "success");
    } catch (_error) {
      setStatus("Could not reset settings. Try again.", "error");
    } finally {
      setBusy(false);
    }
  });

  async function initialize() {
    buildRuleControls();

    if (!extensionApi || !extensionApi.storage) {
      populateForm(defaultSettings);
      setStatus("The Firefox extension API is unavailable. Settings cannot be saved.", "error");
      setBusy(true);
      return;
    }

    try {
      const stored = await getStoredSettings();
      populateForm(stored.settings || defaultSettings);
    } catch (_error) {
      populateForm(defaultSettings);
      setStatus("Could not load saved settings. Defaults are shown.", "error");
    }
  }

  initialize();
})();
