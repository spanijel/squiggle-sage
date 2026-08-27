(function (root, factory) {
  "use strict";

  var api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SquiggleSageSpelling = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var TOKEN_PATTERN = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;
  var PERSONAL_WORD_PATTERN = /^[a-z]+(?:['-][a-z]+)*$/;
  var EXCLUDED_PATTERNS = [
    /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi,
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    /(?:^|\s)[#@][A-Za-z0-9_]+/g,
    /\b[A-Za-z0-9]+(?:[_-][A-Za-z0-9]+)+\b/g,
    /\b[A-Za-z]*\d[A-Za-z\d]*\b/g
  ];

  function normalizeLookupWord(value) {
    return String(value || "")
      .normalize("NFC")
      .replace(/’/g, "'");
  }

  function normalizePersonalWord(value) {
    var normalized = normalizeLookupWord(value).trim().toLowerCase();
    if (!normalized || normalized.length > 64 || !PERSONAL_WORD_PATTERN.test(normalized)) {
      return "";
    }
    return normalized;
  }

  function normalizePersonalWords(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    var seen = new Set();
    var result = [];
    value.forEach(function (word) {
      var normalized = normalizePersonalWord(word);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
      }
    });
    return result.sort();
  }

  function excludedRanges(text) {
    var ranges = [];
    EXCLUDED_PATTERNS.forEach(function (pattern) {
      pattern.lastIndex = 0;
      var match;
      while ((match = pattern.exec(text))) {
        var leadingWhitespace = /^\s/.test(match[0]) ? 1 : 0;
        ranges.push({
          start: match.index + leadingWhitespace,
          end: match.index + match[0].length
        });
        if (match[0].length === 0) {
          pattern.lastIndex += 1;
        }
      }
    });
    return ranges;
  }

  function overlapsExcludedRange(start, end, ranges) {
    return ranges.some(function (range) {
      return start < range.end && end > range.start;
    });
  }

  function shouldSkipToken(word, offset, text, ranges) {
    if (word.length < 2 || word.length > 40) {
      return true;
    }
    if (overlapsExcludedRange(offset, offset + word.length, ranges)) {
      return true;
    }
    if (/[a-z][A-Z]/.test(word) || /[A-Z].*[A-Z].*[a-z]/.test(word)) {
      return true;
    }
    if (word === word.toUpperCase() && word.length <= 8) {
      return true;
    }
    var previous = text[offset - 1] || "";
    var next = text[offset + word.length] || "";
    if (previous === "#" || previous === "@" || /[\w]/.test(previous) || /[\w]/.test(next)) {
      return true;
    }
    return false;
  }

  function tokenize(text) {
    var source = String(text || "");
    var ranges = excludedRanges(source);
    var tokens = [];
    TOKEN_PATTERN.lastIndex = 0;
    var match;
    while ((match = TOKEN_PATTERN.exec(source))) {
      var word = match[0];
      if (!shouldSkipToken(word, match.index, source, ranges)) {
        tokens.push({ word: word, offset: match.index, length: word.length });
      }
    }
    return tokens;
  }

  function createSpellingChecker(dictionary, options) {
    if (!dictionary || typeof dictionary.check !== "function" || typeof dictionary.suggest !== "function") {
      throw new TypeError("A loaded spelling dictionary is required.");
    }
    var settings = options && typeof options === "object" ? options : {};
    var maxIssues = Number.isInteger(settings.maxIssues) ? Math.max(1, settings.maxIssues) : 30;
    var maxSuggestions = Number.isInteger(settings.maxSuggestions)
      ? Math.max(1, Math.min(8, settings.maxSuggestions))
      : 4;
    var maxSuggestionWords = Number.isInteger(settings.maxSuggestionWords)
      ? Math.max(1, settings.maxSuggestionWords)
      : 10;

    function fallbackSuggestions(word) {
      var suggestions = [];
      var lowerWord = word.toLowerCase();
      function add(candidate) {
        if (candidate && dictionary.check(candidate) && !suggestions.includes(candidate)) {
          suggestions.push(candidate);
        }
      }

      for (var index = 1; index < word.length; index += 1) {
        if (lowerWord[index] === lowerWord[index - 1]) {
          add(word.slice(0, index) + word.slice(index + 1));
        }
        if (lowerWord[index] !== lowerWord[index - 1]) {
          add(
            word.slice(0, index - 1)
              + word[index]
              + word[index - 1]
              + word.slice(index + 1)
          );
        }
      }

      for (var trim = 1; trim <= 3 && word.length - trim >= 3; trim += 1) {
        var candidate = word.slice(0, -trim);
        var removed = lowerWord.slice(-trim);
        var candidateLower = candidate.toLowerCase();
        var looksLikeRepeatedEnding = /(?:ed|ing|ly|er|est|s)$/.test(candidateLower)
          || removed[0] === candidateLower.slice(-1);
        if (looksLikeRepeatedEnding) {
          add(candidate);
        }
      }
      return suggestions;
    }

    function suggestionsFor(word) {
      var result = fallbackSuggestions(word);
      dictionary.suggest(word, maxSuggestions).forEach(function (candidate) {
        if (!result.includes(candidate)) {
          result.push(candidate);
        }
      });
      return result.slice(0, maxSuggestions);
    }

    function checkText(value, personalWords) {
      var text = String(value || "");
      var personal = new Set(normalizePersonalWords(personalWords));
      var cache = new Map();
      var issues = [];
      var suggestionWords = 0;

      for (var token of tokenize(text)) {
        if (issues.length >= maxIssues) {
          break;
        }
        var lookupWord = normalizeLookupWord(token.word);
        var personalKey = normalizePersonalWord(lookupWord);
        if (personalKey && personal.has(personalKey)) {
          continue;
        }
        var cacheKey = lookupWord.toLowerCase();
        var result = cache.get(cacheKey);
        if (!result) {
          var correct = dictionary.check(lookupWord);
          var suggestions = [];
          if (!correct && suggestionWords < maxSuggestionWords) {
            suggestions = suggestionsFor(lookupWord);
            suggestionWords += 1;
          }
          result = { correct: correct, suggestions: suggestions };
          cache.set(cacheKey, result);
        }
        if (result.correct) {
          continue;
        }
        issues.push({
          id: "LOCAL_SPELLING:" + token.offset + ":" + token.length,
          ruleId: "LOCAL_SPELLING",
          category: "spelling",
          message: "Possible misspelling: “" + token.word + "”.",
          offset: token.offset,
          length: token.length,
          replacements: result.suggestions.slice(),
          original: token.word
        });
      }
      return issues;
    }

    return Object.freeze({ checkText: checkText });
  }

  return Object.freeze({
    createSpellingChecker: createSpellingChecker,
    normalizePersonalWord: normalizePersonalWord,
    normalizePersonalWords: normalizePersonalWords,
    tokenize: tokenize
  });
});
