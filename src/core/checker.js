(function (root, factory) {
  "use strict";

  var defaultsApi = root.SquiggleSageDefaults;

  if (!defaultsApi && typeof module === "object" && module.exports) {
    try {
      defaultsApi = require("../shared/defaults.js");
    } catch (_error) {
      defaultsApi = null;
    }
  }

  var api = factory(defaultsApi);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SquiggleSageChecker = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (defaultsApi) {
  "use strict";

  var METADATA = [
    {
      id: "REPEATED_WORD",
      category: "grammar",
      title: "Repeated word",
      description: "Finds a likely accidental word repeated immediately.",
    },
    {
      id: "BASIC_SUBJECT_VERB_AGREEMENT",
      category: "grammar",
      title: "Basic subject-verb agreement",
      description: "Finds a small set of unambiguous is/are agreement errors.",
    },
    {
      id: "MODAL_OF",
      category: "grammar",
      title: "Modal followed by of",
      description: "Suggests have after could, should, would, might, or must.",
    },
    {
      id: "MODAL_BASE_FORM",
      category: "grammar",
      title: "Modal verb form",
      description: "Suggests have after a modal followed by has or had.",
    },
    {
      id: "YOUR_YOURE",
      category: "grammar",
      title: "Your/you're",
      description: "Finds your where you're is required in a small set of constructions.",
    },
    {
      id: "ITS_ITS",
      category: "grammar",
      title: "Its/it's",
      description: "Finds its where the contraction it's is required.",
    },
    {
      id: "THEN_THAN",
      category: "grammar",
      title: "Then/than",
      description: "Finds then after an explicit comparative word.",
    },
    {
      id: "REPEATED_PHRASE",
      category: "grammar",
      title: "Repeated phrase",
      description: "Finds a likely accidental two-word phrase repeated immediately.",
    },
    {
      id: "A_AN_ARTICLE",
      category: "grammar",
      title: "A/an article",
      description: "Finds clear article mismatches using conservative sound heuristics.",
    },
    {
      id: "LOWERCASE_I",
      category: "capitalization",
      title: "Lowercase I",
      description: "Capitalizes the standalone first-person pronoun.",
    },
    {
      id: "SENTENCE_START_CASE",
      category: "capitalization",
      title: "Sentence-start capitalization",
      description: "Capitalizes a lowercase word at a clear sentence boundary.",
    },
    {
      id: "SPACE_BEFORE_PUNCTUATION",
      category: "typography",
      title: "Space before punctuation",
      description: "Removes horizontal whitespace before common punctuation.",
    },
    {
      id: "MULTIPLE_SPACES",
      category: "typography",
      title: "Multiple spaces",
      description: "Collapses repeated horizontal spaces inside a line.",
    },
    {
      id: "REPEATED_PUNCTUATION",
      category: "typography",
      title: "Repeated punctuation",
      description: "Collapses repeated commas, semicolons, colons, question marks, or exclamation marks.",
    },
    {
      id: "MISSING_SPACE_AFTER_SENTENCE",
      category: "typography",
      title: "Missing space after sentence punctuation",
      description: "Adds a space at a clear boundary between sentences.",
    },
    {
      id: "WORDY_IN_ORDER_TO",
      category: "style",
      title: "Wordy phrase",
      description: "Suggests to in place of in order to.",
    },
    {
      id: "WORDY_DUE_TO_THE_FACT_THAT",
      category: "style",
      title: "Wordy phrase",
      description: "Suggests because in place of due to the fact that.",
    },
    {
      id: "WORDY_AT_THIS_POINT_IN_TIME",
      category: "style",
      title: "Wordy phrase",
      description: "Suggests now in place of at this point in time.",
    },
  ];

  METADATA.forEach(function (rule) {
    Object.freeze(rule);
  });

  var RULES = Object.freeze(METADATA.slice());
  var RULE_BY_ID = Object.create(null);

  RULES.forEach(function (rule) {
    RULE_BY_ID[rule.id] = rule;
  });

  var CATEGORY_PRIORITY = Object.freeze({
    grammar: 400,
    capitalization: 300,
    typography: 200,
    style: 100,
  });

  function fallbackSettings(value) {
    var input = value && typeof value === "object" ? value : {};

    return {
      enabled: typeof input.enabled === "boolean" ? input.enabled : true,
      grammar: typeof input.grammar === "boolean" ? input.grammar : true,
      style: typeof input.style === "boolean" ? input.style : true,
      typography: typeof input.typography === "boolean" ? input.typography : true,
      capitalization:
        typeof input.capitalization === "boolean" ? input.capitalization : true,
      disabledRules: Array.isArray(input.disabledRules) ? input.disabledRules : [],
    };
  }

  function settingsFor(value) {
    if (defaultsApi && typeof defaultsApi.normalizeSettings === "function") {
      return defaultsApi.normalizeSettings(value);
    }

    return fallbackSettings(value);
  }

  function contextFor(text, offset, length) {
    var radius = 40;
    var start = Math.max(0, offset - radius);
    var end = Math.min(text.length, offset + length + radius);

    return {
      text: text.slice(start, end),
      offset: offset - start,
      length: length,
    };
  }

  function normalizedReplacements(replacements) {
    var seen = Object.create(null);
    var result = [];

    (Array.isArray(replacements) ? replacements : []).forEach(function (replacement) {
      if (typeof replacement !== "string" || seen[replacement]) {
        return;
      }

      seen[replacement] = true;
      result.push(replacement);
    });

    return result.slice(0, 8);
  }

  function makeIssue(ruleId, text, offset, length, message, replacements) {
    var rule = RULE_BY_ID[ruleId];

    if (
      !rule ||
      !Number.isInteger(offset) ||
      !Number.isInteger(length) ||
      offset < 0 ||
      length <= 0 ||
      offset + length > text.length
    ) {
      return null;
    }

    return {
      id: ruleId + ":" + offset + ":" + length,
      ruleId: ruleId,
      category: rule.category,
      message: message,
      offset: offset,
      length: length,
      replacements: normalizedReplacements(replacements),
      context: contextFor(text, offset, length),
      _priority: CATEGORY_PRIORITY[rule.category] || 0,
    };
  }

  function preserveInitialCase(original, replacement) {
    if (original && original.charAt(0) === original.charAt(0).toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }

    return replacement;
  }

  function addRepeatedWords(text, issues) {
    var acceptedRepeats = Object.freeze({
      bye: true,
      go: true,
      had: true,
      ha: true,
      no: true,
      do: true,
      so: true,
      that: true,
      very: true,
    });
    var expression = /\b([A-Za-z][A-Za-z'-]{1,})[ \t]+\1\b/gi;
    var match;

    while ((match = expression.exec(text)) !== null) {
      if (acceptedRepeats[match[1].toLowerCase()]) {
        continue;
      }

      issues.push(
        makeIssue(
          "REPEATED_WORD",
          text,
          match.index,
          match[0].length,
          "This word appears twice in a row.",
          [match[1]]
        )
      );
    }
  }

  function addBasicAgreement(text, issues) {
    var pluralExpression = /\b(I|you|we|they)([ \t]+)is\b/gi;
    var singularExpression = /\b(he|she|it)([ \t]+)are\b/gi;
    var demonstrativeSingularExpression = /\b(this|that)([ \t]+)are\b/gi;
    var demonstrativePluralExpression = /\b(these|those)([ \t]+)is\b/gi;
    var match;

    while ((match = pluralExpression.exec(text)) !== null) {
      var expected = match[1].toLowerCase() === "i" ? "am" : "are";
      var verbOffset = match.index + match[1].length + match[2].length;

      issues.push(
        makeIssue(
          "BASIC_SUBJECT_VERB_AGREEMENT",
          text,
          verbOffset,
          2,
          "Use “" + expected + "” with “" + match[1] + "”.",
          [expected]
        )
      );
    }

    while ((match = singularExpression.exec(text)) !== null) {
      var singularOffset = match.index + match[1].length + match[2].length;

      issues.push(
        makeIssue(
          "BASIC_SUBJECT_VERB_AGREEMENT",
          text,
          singularOffset,
          3,
          "Use “is” with “" + match[1] + "”.",
          ["is"]
        )
      );
    }

    while ((match = demonstrativeSingularExpression.exec(text)) !== null) {
      var demonstrativeSingularOffset = match.index + match[1].length + match[2].length;

      issues.push(
        makeIssue(
          "BASIC_SUBJECT_VERB_AGREEMENT",
          text,
          demonstrativeSingularOffset,
          3,
          "Use is with " + match[1] + ".",
          ["is"]
        )
      );
    }

    while ((match = demonstrativePluralExpression.exec(text)) !== null) {
      var demonstrativePluralOffset = match.index + match[1].length + match[2].length;

      issues.push(
        makeIssue(
          "BASIC_SUBJECT_VERB_AGREEMENT",
          text,
          demonstrativePluralOffset,
          2,
          "Use are with " + match[1] + ".",
          ["are"]
        )
      );
    }
  }

  function addModalOf(text, issues) {
    var expression = /\b(could|should|would|might|must)([ \t]+)of\b/gi;
    var match;

    while ((match = expression.exec(text)) !== null) {
      var replacement = preserveInitialCase(match[1], match[1].toLowerCase() + " have");

      issues.push(
        makeIssue(
          "MODAL_OF",
          text,
          match.index,
          match[0].length,
          "Use “have” after this modal verb.",
          [replacement]
        )
      );
    }
  }

  function addModalBaseForm(text, issues) {
    var expression = /\b(could|should|would|might|must)([ \t]+)(has|had)\b/gi;
    var match;

    while ((match = expression.exec(text)) !== null) {
      var verbOffset = match.index + match[1].length + match[2].length;

      issues.push(
        makeIssue(
          "MODAL_BASE_FORM",
          text,
          verbOffset,
          match[3].length,
          "Use have after this modal verb.",
          ["have"]
        )
      );
    }
  }

  function addYourYoure(text, issues) {
    var expression = /\byour(?=[ \t]+(?:not\b|(?:definitely|probably|certainly|absolutely|clearly)[ \t]+(?:welcome|right|wrong|sure)\b))/gi;
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          "YOUR_YOURE",
          text,
          match.index,
          match[0].length,
          "Use you're, meaning you are, in this construction.",
          [preserveInitialCase(match[0], "you're")]
        )
      );
    }
  }

  function addItsIts(text, issues) {
    var expression = /\bits(?=[ \t]+(?:a\b|an\b|the\b|been\b|being\b|not\b|too\b))/gi;
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          "ITS_ITS",
          text,
          match.index,
          match[0].length,
          "Use it's, meaning it is or it has, in this construction.",
          [preserveInitialCase(match[0], "it's")]
        )
      );
    }
  }

  function addThenThan(text, issues) {
    var expression = /\b(?:more|less|fewer|better|worse|greater|smaller|older|younger|rather|other)([ \t]+)then\b/gi;
    var match;

    while ((match = expression.exec(text)) !== null) {
      var offset = match.index + match[0].length - 4;

      issues.push(
        makeIssue(
          "THEN_THAN",
          text,
          offset,
          4,
          "Use than in this comparison.",
          ["than"]
        )
      );
    }
  }

  function addRepeatedPhrases(text, issues) {
    var expression = /\b([A-Za-z][A-Za-z'-]*[ \t]+[A-Za-z][A-Za-z'-]*)([ \t]+)\1\b/gi;
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          "REPEATED_PHRASE",
          text,
          match.index,
          match[0].length,
          "This two-word phrase appears twice in a row.",
          [match[1]]
        )
      );
    }
  }

  function expectedArticle(word) {
    var lower = word.toLowerCase();

    if (/^(herb|historic|homage|hotel)/.test(lower)) {
      return null;
    }

    if (/^(heir|honest|honor|honour|hour)/.test(lower)) {
      return "an";
    }

    if (
      /^(eulogy|euphem|euro|ewe|one|once|ubiquit|ufo|unicorn|uniform|unilateral|union|unique|unit|univer|use|user|usual)/.test(
        lower
      )
    ) {
      return "a";
    }

    return /^[aeiou]/.test(lower) ? "an" : "a";
  }

  function addArticleIssues(text, issues) {
    var expression = /\b(a|an)([ \t]+)([A-Za-z][A-Za-z'-]+)\b/gi;
    var match;

    while ((match = expression.exec(text)) !== null) {
      var word = match[3];

      if (word !== word.toLowerCase() || word.indexOf("-") !== -1) {
        continue;
      }

      var expected = expectedArticle(word);

      if (!expected || match[1].toLowerCase() === expected) {
        continue;
      }

      var replacement = preserveInitialCase(match[1], expected);

      issues.push(
        makeIssue(
          "A_AN_ARTICLE",
          text,
          match.index,
          match[1].length,
          "Use “" + replacement + "” before “" + word + "”.",
          [replacement]
        )
      );
    }
  }

  function addLowercaseI(text, issues) {
    var expression = /\bi\b/g;
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          "LOWERCASE_I",
          text,
          match.index,
          1,
          "Capitalize the first-person pronoun “I”.",
          ["I"]
        )
      );
    }
  }

  function followsKnownAbbreviation(text, boundaryOffset) {
    var prefix = text.slice(Math.max(0, boundaryOffset - 12), boundaryOffset + 1);

    return /(?:\b(?:[a-z]\.){2,}|\betc\.|\bmr\.|\bmrs\.|\bms\.|\bdr\.|\bprof\.|\bvs\.)$/i.test(
      prefix
    );
  }

  function addSentenceStartCase(text, issues) {
    var expression = /(^|[.!?][ \t\r\n]+)(["'(\[]*)([a-z])(?=[a-z])/g;
    var match;

    while ((match = expression.exec(text)) !== null) {
      if (match[1].charAt(0) === "." && followsKnownAbbreviation(text, match.index)) {
        continue;
      }

      var offset = match.index + match[1].length + match[2].length;
      var replacement = match[3].toUpperCase();

      issues.push(
        makeIssue(
          "SENTENCE_START_CASE",
          text,
          offset,
          1,
          "Capitalize the first word of this sentence.",
          [replacement]
        )
      );
    }
  }

  function addSpaceBeforePunctuation(text, issues) {
    var expression = /[ \t]+(?=[,.;:!?])/g;
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          "SPACE_BEFORE_PUNCTUATION",
          text,
          match.index,
          match[0].length,
          "Remove the space before this punctuation mark.",
          [""]
        )
      );
    }
  }

  function addMultipleSpaces(text, issues) {
    var expression = /(\S)([ \t]{2,})(?=\S)/g;
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          "MULTIPLE_SPACES",
          text,
          match.index + match[1].length,
          match[2].length,
          "Use a single space here.",
          [" "]
        )
      );
    }
  }

  function addRepeatedPunctuation(text, issues) {
    var expression = /([,;:!?])\1+/g;
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          "REPEATED_PUNCTUATION",
          text,
          match.index,
          match[0].length,
          "Use this punctuation mark only once.",
          [match[1]]
        )
      );
    }
  }

  function addMissingSpaceAfterSentence(text, issues) {
    var expression = /([.!?])(?=(?:I\b|We\b|You\b|He\b|She\b|It\b|They\b|This\b|That\b|These\b|Those\b|There\b|Here\b|The\b|A\b|An\b|My\b|Your\b))/g;
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          "MISSING_SPACE_AFTER_SENTENCE",
          text,
          match.index,
          1,
          "Add a space after this sentence punctuation.",
          [match[1] + " "]
        )
      );
    }
  }

  function addPhraseIssues(text, issues, ruleId, expression, replacement, message) {
    var match;

    while ((match = expression.exec(text)) !== null) {
      issues.push(
        makeIssue(
          ruleId,
          text,
          match.index,
          match[0].length,
          message,
          [preserveInitialCase(match[0], replacement)]
        )
      );
    }
  }

  var RUNNERS = Object.freeze({
    REPEATED_WORD: addRepeatedWords,
    BASIC_SUBJECT_VERB_AGREEMENT: addBasicAgreement,
    MODAL_OF: addModalOf,
    MODAL_BASE_FORM: addModalBaseForm,
    YOUR_YOURE: addYourYoure,
    ITS_ITS: addItsIts,
    THEN_THAN: addThenThan,
    REPEATED_PHRASE: addRepeatedPhrases,
    A_AN_ARTICLE: addArticleIssues,
    LOWERCASE_I: addLowercaseI,
    SENTENCE_START_CASE: addSentenceStartCase,
    SPACE_BEFORE_PUNCTUATION: addSpaceBeforePunctuation,
    MULTIPLE_SPACES: addMultipleSpaces,
    REPEATED_PUNCTUATION: addRepeatedPunctuation,
    MISSING_SPACE_AFTER_SENTENCE: addMissingSpaceAfterSentence,
    WORDY_IN_ORDER_TO: function (text, issues) {
      addPhraseIssues(
        text,
        issues,
        "WORDY_IN_ORDER_TO",
        /\bin order to\b/gi,
        "to",
        "For a more direct sentence, consider “to”."
      );
    },
    WORDY_DUE_TO_THE_FACT_THAT: function (text, issues) {
      addPhraseIssues(
        text,
        issues,
        "WORDY_DUE_TO_THE_FACT_THAT",
        /\bdue to the fact that\b/gi,
        "because",
        "For a more direct sentence, consider “because”."
      );
    },
    WORDY_AT_THIS_POINT_IN_TIME: function (text, issues) {
      addPhraseIssues(
        text,
        issues,
        "WORDY_AT_THIS_POINT_IN_TIME",
        /\bat this point in time\b/gi,
        "now",
        "For a more direct sentence, consider “now”."
      );
    },
  });

  function categoryIsEnabled(category, settings) {
    return settings[category] !== false;
  }

  function withoutOverlaps(issues) {
    var sorted = issues
      .filter(function (issue) {
        return issue !== null;
      })
      .sort(function (left, right) {
        return (
          left.offset - right.offset ||
          right._priority - left._priority ||
          right.length - left.length ||
          left.ruleId.localeCompare(right.ruleId)
        );
      });
    var result = [];
    var lastEnd = -1;

    sorted.forEach(function (issue) {
      if (issue.offset < lastEnd) {
        return;
      }

      delete issue._priority;
      result.push(issue);
      lastEnd = issue.offset + issue.length;
    });

    return result;
  }

  function checkText(value, rawSettings) {
    var text = typeof value === "string" ? value : value == null ? "" : String(value);
    var settings = settingsFor(rawSettings);

    if (!settings.enabled || !text) {
      return [];
    }

    var disabledRules = Object.create(null);
    var issues = [];

    settings.disabledRules.forEach(function (ruleId) {
      disabledRules[ruleId] = true;
    });

    RULES.forEach(function (rule) {
      if (disabledRules[rule.id] || !categoryIsEnabled(rule.category, settings)) {
        return;
      }

      RUNNERS[rule.id](text, issues);
    });

    return withoutOverlaps(issues);
  }

  return Object.freeze({
    RULES: RULES,
    checkText: checkText,
  });
});
