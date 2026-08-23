(function () {
  "use strict";

  const extensionApi = globalThis.browser || globalThis.chrome;
  const defaultsApi = globalThis.SquiggleSageDefaults || {};
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

  const enabledToggle = document.querySelector("#enabled-toggle");
  const siteTitle = document.querySelector("#site-title");
  const siteState = document.querySelector("#site-state");
  const siteToggle = document.querySelector("#site-toggle");
  const checkerTitle = document.querySelector("#checker-title");
  const checkerDetail = document.querySelector("#checker-detail");
  const checkerDot = document.querySelector("#checker-dot");
  const popupStatus = document.querySelector("#popup-status");
  const openOptionsButton = document.querySelector("#open-options");

  let settings = normalizeSettings({});
  let currentHostname = null;
  let currentTabId = null;
  let contentStatus = null;

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

  function setStoredSettings(nextSettings) {
    if (globalThis.browser) {
      return extensionApi.storage.local.set({ settings: nextSettings });
    }

    return new Promise((resolve, reject) => {
      extensionApi.storage.local.set({ settings: nextSettings }, () => {
        const error = extensionApi.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  function queryActiveTab() {
    if (globalThis.browser) {
      return extensionApi.tabs.query({ active: true, currentWindow: true });
    }

    return new Promise((resolve, reject) => {
      extensionApi.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const error = extensionApi.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve(tabs);
      });
    });
  }

  function openOptionsPage() {
    if (globalThis.browser) {
      return extensionApi.runtime.openOptionsPage();
    }

    return new Promise((resolve, reject) => {
      extensionApi.runtime.openOptionsPage(() => {
        const error = extensionApi.runtime.lastError;
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  function getContentStatus(tabId) {
    if (!Number.isInteger(tabId) || !extensionApi.tabs.sendMessage) {
      return Promise.resolve(null);
    }
    if (globalThis.browser) {
      return extensionApi.tabs
        .sendMessage(tabId, { type: "squiggle-sage:get-content-status" })
        .catch(() => null);
    }
    return new Promise((resolve) => {
      extensionApi.tabs.sendMessage(tabId, { type: "squiggle-sage:get-content-status" }, (status) => {
        if (extensionApi.runtime.lastError) {
          resolve(null);
          return;
        }
        resolve(status || null);
      });
    });
  }

  function hostnameFromTab(tab) {
    try {
      const url = new URL(tab && (tab.url || tab.pendingUrl));
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }
      return url.hostname.toLowerCase();
    } catch (_error) {
      return null;
    }
  }

  function showError(message) {
    popupStatus.textContent = message;
    popupStatus.hidden = false;
  }

  function clearError() {
    popupStatus.textContent = "";
    popupStatus.hidden = true;
  }

  function render() {
    enabledToggle.checked = Boolean(settings.enabled);

    checkerTitle.textContent = "Built-in English checker";
    checkerDot.classList.toggle("active", Boolean(settings.enabled));
    checkerDot.classList.remove("warning");

    if (!settings.enabled) {
      checkerDetail.textContent = "Checking is turned off";
    } else if (contentStatus?.active) {
      const count = contentStatus.issueCount || 0;
      checkerDetail.textContent = `Active field - ${count} suggestion${count === 1 ? "" : "s"}`;
    } else {
      checkerDetail.textContent = settings.nativeSpellcheck
        ? "English grammar and Firefox spelling"
        : "Built-in English grammar rules";
    }

    if (!currentHostname) {
      siteTitle.textContent = "This Firefox page";
      siteState.textContent = "Site controls are unavailable here";
      siteToggle.textContent = "Unavailable";
      siteToggle.disabled = true;
      return;
    }

    const disabledOnSite = settings.disabledSites.includes(currentHostname);
    siteTitle.textContent = currentHostname;
    if (!settings.enabled) {
      siteState.textContent = "Global writing checks are off";
    } else {
      siteState.textContent = disabledOnSite ? "Checks are disabled here" : "Checks are enabled here";
    }
    siteToggle.textContent = disabledOnSite ? "Enable here" : "Disable here";
    siteToggle.disabled = !settings.enabled;
  }

  async function saveSettings(nextSettings) {
    const normalized = normalizeSettings(nextSettings);
    await setStoredSettings(normalized);
    settings = normalized;
    contentStatus = await getContentStatus(currentTabId);
    render();
  }

  enabledToggle.addEventListener("change", async () => {
    clearError();
    const previousValue = settings.enabled;
    enabledToggle.disabled = true;
    try {
      await saveSettings({ ...settings, enabled: enabledToggle.checked });
    } catch (_error) {
      enabledToggle.checked = previousValue;
      showError("Could not update the extension setting.");
    } finally {
      enabledToggle.disabled = false;
    }
  });

  siteToggle.addEventListener("click", async () => {
    if (!currentHostname) {
      return;
    }

    clearError();
    siteToggle.disabled = true;
    const disabledSites = new Set(settings.disabledSites);
    if (disabledSites.has(currentHostname)) {
      disabledSites.delete(currentHostname);
    } else {
      disabledSites.add(currentHostname);
    }

    try {
      await saveSettings({ ...settings, disabledSites: [...disabledSites].sort() });
    } catch (_error) {
      showError("Could not update this website setting.");
      render();
    }
  });

  openOptionsButton.addEventListener("click", async () => {
    clearError();
    try {
      await openOptionsPage();
      window.close();
    } catch (_error) {
      showError("Could not open the settings page.");
    }
  });

  async function initialize() {
    if (!extensionApi || !extensionApi.storage || !extensionApi.tabs) {
      showError("The Firefox extension API is unavailable.");
      enabledToggle.disabled = true;
      return;
    }

    try {
      const [stored, tabs] = await Promise.all([getStoredSettings(), queryActiveTab()]);
      settings = normalizeSettings(stored.settings || {});
      currentTabId = Number.isInteger(tabs[0]?.id) ? tabs[0].id : null;
      currentHostname = hostnameFromTab(tabs[0]);
      contentStatus = await getContentStatus(currentTabId);
      render();
    } catch (_error) {
      showError("Could not load your local settings.");
      enabledToggle.disabled = true;
      siteToggle.disabled = true;
    }
  }

  initialize();
})();
