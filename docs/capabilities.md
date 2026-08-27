# SquiggleSage capabilities

Version `0.2.1` provides local spelling and writing assistance for ordinary Firefox text editors.

## Current capabilities

| Area | Behavior |
|---|---|
| Continuous checking | Debounced checks while the user types, with checks paused during IME composition |
| Spelling | Bundled American-English SCOWL/Hunspell dictionary, local Typo.js checks, and clickable suggestions |
| Personal dictionary | Accepted words stored only in local extension storage, with search, add, and removal controls |
| Personal replacements | Bounded user-defined typo-to-correction pairs stored only in local extension storage |
| Grammar | Cautious built-in English agreement, repeated-word and phrase, modal, article, and common-confusion rules |
| Capitalization | Standalone pronoun and sentence-start checks |
| Typography | Repeated-space, repeated-punctuation, space-before-punctuation, and missing-space checks |
| Style | Three conservative wordiness rules |
| Suggestions | Prominent red squiggles, clickable cards, guarded replacement, undo last correction, ignore once, **Ignore for session**, and rule disablement |
| Keyboard use | Issue markers, suggestion cards, corrections, dismissals, and undo are operable while the relevant SquiggleSage control is focused |
| Editor badge | Draggable issue count for the active editor, with keyboard repositioning |
| Controls | Global enablement, exact-hostname exclusions, categories, individual rules, and typing delay |
| Privacy | Processing occurs inside Firefox; the extension has no network requests, telemetry, or editor-text persistence |
| Page access | Content scripts run on HTTP, HTTPS, and local-file pages, including frames, to find the focused supported editor |
| Editors | Ordinary `textarea`, text `input`, and `contenteditable` elements in HTTP, HTTPS, and local-file pages |

## Current limits

- Built-in grammar, capitalization, typography, and style rules are English-only.
- Bundled spelling currently supports American English only. Firefox-native dictionaries remain a separate optional feature.
- SquiggleSage's personal dictionary is profile-local and does not synchronize across devices.
- Google Docs, Google Slides, canvas editors, closed shadow roots, and some framework-specific rich editors need dedicated adapters.
- The extension does not provide synonyms, rewriting, translation, statistics, accounts, or synchronization.
- Named web services should be validated in Firefox before support is claimed for them.

New capabilities should be added only when a concrete editor or writing behavior has a reproducible gap and a focused test.

Proposed import/export, regional dictionaries, local writing statistics, original rule packs, and editor adapters must follow the engineering and rights/privacy checks in [future-feature-guardrails.md](future-feature-guardrails.md).

## Correction and suppression boundaries

- **Undo last correction** keeps only the most recent SquiggleSage replacement for each live editor. It is held in memory, is not stored across reloads, and is offered only while the recorded edit can be reversed safely.
- **Ignore once** suppresses one exact occurrence in the current editor content.
- **Ignore for session** suppresses the same rule and original text in the current tab until reload or close. It is not a global rule exception and is not persisted.
- **Personal replacements** are normalized plain-text pairs limited to 100 pairs and 80 Unicode characters per side. They never contain or execute code, do not invoke a service, and are applied through the same guarded replacement action as built-in suggestions.
- Personal replacement suggestions use the local spelling suggestion channel and are active while the SquiggleSage spelling category is enabled.

## Keyboard controls

- Tab to the SquiggleSage badge and press Enter or Space to open its suggestion card.
- While the badge or suggestion UI is focused, press Alt+Left Arrow or Alt+Right Arrow to move between issues and open the selected issue.
- When an issue marker is focused, use an arrow key to move between issues, Home or End to jump to the first or last issue, and Enter or Space to open its card.
- Use Tab and Shift+Tab to reach card actions, then Enter or Space to activate the focused correction, undo, ignore, dictionary, or rule control.
- Press Escape to close a card and return focus to its SquiggleSage trigger. Plain arrow keys on the focused badge move the badge; holding Shift moves it farther.

## Spelling data flow

The active editor's content script sends text through Firefox's internal extension messaging to the background spelling engine. SquiggleSage first reads the complete packaged dictionary files and passes their text to the unmodified Typo.js constructor, so Typo.js's optional loader is not invoked. The engine returns only local issue data to the content script and does not log or retain the editor text. No part of this flow uses the network.
