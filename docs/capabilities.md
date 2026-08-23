# SquiggleSage capabilities

Version `0.1.2` provides local writing assistance for ordinary Firefox text editors.

## Current capabilities

| Area | Behavior |
|---|---|
| Continuous checking | Debounced checks while the user types, with checks paused during IME composition |
| Spelling | Firefox's native dictionaries, red underlines, and context-menu corrections |
| Grammar | Cautious built-in English agreement, repeated-word, modal, and article rules |
| Capitalization | Standalone pronoun and sentence-start checks |
| Typography | Repeated-space and space-before-punctuation checks |
| Style | Three conservative wordiness rules |
| Suggestions | Prominent red squiggles, clickable cards, guarded replacement, ignore once, and rule disablement |
| Editor badge | Draggable issue count for the active editor, with keyboard repositioning |
| Controls | Global enablement, exact-hostname exclusions, categories, individual rules, and typing delay |
| Privacy | Processing occurs inside Firefox; the extension has no network endpoint or telemetry |
| Page access | Content scripts run on HTTP, HTTPS, and local-file pages, including frames, to find the focused supported editor |
| Editors | Ordinary `textarea`, text `input`, and `contenteditable` elements in HTTP, HTTPS, and local-file pages |

## Current limits

- Built-in grammar, capitalization, typography, and style rules are English-only.
- Spelling language and personal dictionary management remain Firefox features.
- Google Docs, Google Slides, canvas editors, closed shadow roots, and some framework-specific rich editors need dedicated adapters.
- The extension does not provide synonyms, rewriting, translation, statistics, accounts, or synchronization.
- Named web services should be validated in Firefox before support is claimed for them.

New capabilities should be added only when a concrete editor or writing behavior has a reproducible gap and a focused test.
