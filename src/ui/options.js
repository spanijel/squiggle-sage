(function () {
  "use strict";

  const extensionApi = globalThis.browser || globalThis.chrome;
  const defaultsApi = globalThis.SquiggleSageDefaults || {};
  const checkerApi = globalThis.SquiggleSageChecker || {};
  const fallbackSettings = {
    enabled: true,
    nativeSpellcheck: true,
    spelling: true,
    grammar: true,
    style: true,
    typography: true,
    capitalization: true,
    debounceMs: 350,
    disabledRules: [],
    disabledSites: [],
    personalDictionary: [],
    personalReplacements: []
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
  const spellingInput = document.querySelector("#spelling");
  const grammarInput = document.querySelector("#grammar");
  const styleInput = document.querySelector("#style");
  const typographyInput = document.querySelector("#typography");
  const capitalizationInput = document.querySelector("#capitalization");
  const debounceInput = document.querySelector("#debounce-ms");
  const disabledSitesInput = document.querySelector("#disabled-sites");
  const dictionaryWordInput = document.querySelector("#dictionary-word");
  const dictionaryAddButton = document.querySelector("#dictionary-add-button");
  const dictionarySearchInput = document.querySelector("#dictionary-search");
  const dictionaryCount = document.querySelector("#dictionary-count");
  const dictionaryStatus = document.querySelector("#dictionary-status");
  const dictionaryList = document.querySelector("#dictionary-list");
  const dictionaryEmpty = document.querySelector("#dictionary-empty");
  const replacementFindInput = document.querySelector("#replacement-find");
  const replacementValueInput = document.querySelector("#replacement-value");
  const replacementAddButton = document.querySelector("#replacement-add-button");
  const replacementSearchInput = document.querySelector("#replacement-search");
  const replacementCount = document.querySelector("#replacement-count");
  const replacementStatus = document.querySelector("#replacement-status");
  const replacementList = document.querySelector("#replacement-list");
  const replacementEmpty = document.querySelector("#replacement-empty");
  const rulesContainer = document.querySelector("#rules-container");
  const saveStatus = document.querySelector("#save-status");
  const saveButton = document.querySelector("#save-button");
  const resetButton = document.querySelector("#reset-button");
  let personalDictionary = [];
  let personalReplacements = [];

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
    dictionaryAddButton.disabled = busy;
    replacementAddButton.disabled = busy;
    for (const button of dictionaryList.querySelectorAll("button")) {
      button.disabled = busy;
    }
    for (const button of replacementList.querySelectorAll("button")) {
      button.disabled = busy;
    }
  }

  function setDictionaryStatus(message, kind = "") {
    dictionaryStatus.textContent = message;
    dictionaryStatus.className = kind;
  }

  function personalWord(value) {
    const normalized = String(value || "")
      .normalize("NFC")
      .replace(/\u2019/g, "'")
      .trim()
      .toLowerCase();
    return normalized.length <= 64 && /^[a-z]+(?:['-][a-z]+)*$/.test(normalized)
      ? normalized
      : "";
  }

  function renderPersonalDictionary() {
    const query = dictionarySearchInput.value.trim().toLowerCase();
    const visibleWords = personalDictionary.filter((word) => word.includes(query));
    dictionaryList.replaceChildren();

    for (const word of visibleWords) {
      const item = document.createElement("li");
      const wordLabel = document.createElement("span");
      wordLabel.textContent = word;

      const removeButton = document.createElement("button");
      removeButton.className = "dictionary-remove";
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove ${word} from the personal dictionary`);
      removeButton.addEventListener("click", () => {
        personalDictionary = personalDictionary.filter((candidate) => candidate !== word);
        renderPersonalDictionary();
        setDictionaryStatus(`Removed “${word}”. Save settings to apply.`, "success");
        setStatus("Unsaved changes");
      });

      item.append(wordLabel, removeButton);
      dictionaryList.append(item);
    }

    const total = personalDictionary.length;
    dictionaryCount.textContent = `${total} personal word${total === 1 ? "" : "s"}`;
    dictionaryEmpty.hidden = visibleWords.length > 0;
    dictionaryEmpty.textContent = total === 0
      ? "No personal words yet."
      : "No personal words match your search.";
  }

  function addPersonalWord() {
    const rawWord = dictionaryWordInput.value;
    const word = personalWord(rawWord);
    if (!word) {
      setDictionaryStatus("Enter one word using letters, apostrophes, or hyphens.", "error");
      dictionaryWordInput.focus();
      return;
    }
    if (personalDictionary.includes(word)) {
      setDictionaryStatus(`“${word}” is already in your personal dictionary.`, "error");
      dictionaryWordInput.select();
      return;
    }

    personalDictionary = [...personalDictionary, word].sort();
    dictionaryWordInput.value = "";
    dictionarySearchInput.value = "";
    renderPersonalDictionary();
    setDictionaryStatus(`Added “${word}”. Save settings to apply.`, "success");
    setStatus("Unsaved changes");
    dictionaryWordInput.focus();
  }

  function setReplacementStatus(message, kind = "") {
    replacementStatus.textContent = message;
    replacementStatus.className = kind;
  }

  function replacementKey(entry) {
    return entry.find.toLowerCase();
  }

  function renderPersonalReplacements() {
    const query = replacementSearchInput.value.trim().toLowerCase();
    const visibleEntries = personalReplacements.filter((entry) =>
      entry.find.toLowerCase().includes(query) || entry.replace.toLowerCase().includes(query)
    );
    replacementList.replaceChildren();

    for (const entry of visibleEntries) {
      const item = document.createElement("li");
      const pair = document.createElement("span");
      pair.className = "replacement-pair";

      const findText = document.createElement("span");
      findText.textContent = entry.find;
      const arrow = document.createElement("span");
      arrow.className = "replacement-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";
      const arrowLabel = document.createElement("span");
      arrowLabel.className = "visually-hidden";
      arrowLabel.textContent = "is replaced with";
      const replaceText = document.createElement("span");
      replaceText.textContent = entry.replace;
      pair.append(findText, arrow, arrowLabel, replaceText);

      const removeButton = document.createElement("button");
      removeButton.className = "dictionary-remove";
      removeButton.type = "button";
      removeButton.textContent = "Remove";
      removeButton.setAttribute("aria-label", `Remove the replacement ${entry.find} with ${entry.replace}`);
      removeButton.addEventListener("click", () => {
        const key = replacementKey(entry);
        personalReplacements = personalReplacements.filter((candidate) => replacementKey(candidate) !== key);
        renderPersonalReplacements();
        setReplacementStatus(`Removed “${entry.find}” → “${entry.replace}”. Save settings to apply.`, "success");
        setStatus("Unsaved changes");
      });

      item.append(pair, removeButton);
      replacementList.append(item);
    }

    const total = personalReplacements.length;
    replacementCount.textContent = `${total} personal replacement${total === 1 ? "" : "s"}`;
    replacementEmpty.hidden = visibleEntries.length > 0;
    replacementEmpty.textContent = total === 0
      ? "No personal replacements yet."
      : "No personal replacements match your search.";
  }

  function addPersonalReplacement() {
    const candidate = normalizeSettings({
      personalReplacements: [{
        find: replacementFindInput.value,
        replace: replacementValueInput.value
      }]
    }).personalReplacements[0];

    if (!candidate) {
      setReplacementStatus("Enter two different visible values without line breaks or control characters.", "error");
      replacementFindInput.focus();
      return;
    }
    if (personalReplacements.length >= (defaultsApi.MAX_PERSONAL_REPLACEMENTS || 100)) {
      setReplacementStatus("You can save up to 100 personal replacements.", "error");
      return;
    }
    if (personalReplacements.some((entry) => replacementKey(entry) === replacementKey(candidate))) {
      setReplacementStatus(`A replacement for “${candidate.find}” already exists.`, "error");
      replacementFindInput.select();
      return;
    }

    personalReplacements = normalizeSettings({
      personalReplacements: [...personalReplacements, candidate]
    }).personalReplacements;
    replacementFindInput.value = "";
    replacementValueInput.value = "";
    replacementSearchInput.value = "";
    renderPersonalReplacements();
    setReplacementStatus(`Added “${candidate.find}” → “${candidate.replace}”. Save settings to apply.`, "success");
    setStatus("Unsaved changes");
    replacementFindInput.focus();
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
    spellingInput.checked = normalized.spelling;
    grammarInput.checked = normalized.grammar;
    styleInput.checked = normalized.style;
    typographyInput.checked = normalized.typography;
    capitalizationInput.checked = normalized.capitalization;
    debounceInput.value = normalized.debounceMs;
    disabledSitesInput.value = normalized.disabledSites.join("\n");
    personalDictionary = [...normalized.personalDictionary];
    personalReplacements = normalized.personalReplacements.map((entry) => ({ ...entry }));
    dictionaryWordInput.value = "";
    dictionarySearchInput.value = "";
    setDictionaryStatus("");
    renderPersonalDictionary();
    replacementFindInput.value = "";
    replacementValueInput.value = "";
    replacementSearchInput.value = "";
    setReplacementStatus("");
    renderPersonalReplacements();

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
      spelling: spellingInput.checked,
      grammar: grammarInput.checked,
      style: styleInput.checked,
      typography: typographyInput.checked,
      capitalization: capitalizationInput.checked,
      debounceMs,
      disabledSites: parseDisabledSites(disabledSitesInput.value),
      disabledRules,
      personalDictionary,
      personalReplacements
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

  dictionaryAddButton.addEventListener("click", addPersonalWord);
  dictionaryWordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addPersonalWord();
    }
  });
  dictionarySearchInput.addEventListener("input", renderPersonalDictionary);
  replacementAddButton.addEventListener("click", addPersonalReplacement);
  for (const input of [replacementFindInput, replacementValueInput]) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addPersonalReplacement();
      }
    });
  }
  replacementSearchInput.addEventListener("input", renderPersonalReplacements);

  form.addEventListener("input", (event) => {
    if (
      event.target === dictionaryWordInput ||
      event.target === dictionarySearchInput ||
      event.target === replacementFindInput ||
      event.target === replacementValueInput ||
      event.target === replacementSearchInput
    ) {
      return;
    }
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
    if (!window.confirm("Reset all SquiggleSage settings, disabled websites, personal words, and personal replacements to their defaults?")) {
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
