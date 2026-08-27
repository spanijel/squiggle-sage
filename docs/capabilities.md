# SquiggleSage capabilities

Version `0.2.0` provides local spelling and writing assistance for ordinary Firefox text editors.

## Current capabilities

| Area | Behavior |
|---|---|
| Continuous checking | Debounced checks while the user types, with checks paused during IME composition |
| Spelling | Bundled American-English SCOWL/Hunspell dictionary, local Typo.js checks, and clickable suggestions |
| Personal dictionary | Accepted words stored only in local extension storage, with no synchronization |
| Grammar | Cautious built-in English agreement, repeated-word and phrase, modal, article, and common-confusion rules |
| Capitalization | Standalone pronoun and sentence-start checks |
| Typography | Repeated-space, repeated-punctuation, space-before-punctuation, and missing-space checks |
| Style | Three conservative wordiness rules |
| Suggestions | Prominent red squiggles, clickable cards, guarded replacement, ignore once, and rule disablement |
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

## Spelling data flow

The active editor's content script sends text through Firefox's internal extension messaging to the background spelling engine. The engine loads Typo.js and the packaged dictionary from extension URLs, returns only local issue data to the content script, and does not log or retain the editor text. No part of this flow uses the network.
