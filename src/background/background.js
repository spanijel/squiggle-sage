(function installBackground(global) {
  "use strict";

  const extensionApi = global.browser || global.chrome;
  const spellingApi = global.SquiggleSageSpelling;
  if (!extensionApi || !spellingApi || typeof global.Typo !== "function") {
    return;
  }

  let checkerPromise = null;

  function packagedText(relativePath) {
    const url = extensionApi.runtime.getURL(relativePath);
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(`Could not load packaged spelling data: ${response.status}`);
      }
      return response.text();
    });
  }

  function getChecker() {
    if (!checkerPromise) {
      checkerPromise = Promise.all([
        packagedText("src/data/en-us/index.aff"),
        packagedText("src/data/en-us/index.dic")
      ]).then(([affData, dictionaryData]) => {
        const dictionary = new global.Typo("en_US", affData, dictionaryData);
        return spellingApi.createSpellingChecker(dictionary);
      }).catch((error) => {
        checkerPromise = null;
        throw error;
      });
    }
    return checkerPromise;
  }

  extensionApi.runtime.onMessage.addListener((message) => {
    if (message?.type === "squiggle-sage:check-spelling") {
      return getChecker().then((checker) => ({
        issues: checker.checkText(message.text, message.personalDictionary),
        personalDictionaryCount: spellingApi.normalizePersonalWords(message.personalDictionary).length,
        ready: true
      }));
    }
    if (message?.type === "squiggle-sage:get-spelling-status") {
      return getChecker().then(
        () => ({ ready: true }),
        () => ({ ready: false })
      );
    }
    return undefined;
  });

  getChecker().catch(() => {
    // A later check retries initialization and reports failure without editor text.
  });
})(globalThis);
