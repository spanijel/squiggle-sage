# SquiggleSage

SquiggleSage is a Firefox-first writing assistant whose checks run entirely inside the browser.

Version `0.2.1` supports ordinary `textarea`, text `input`, and `contenteditable` editors. It adds bundled, local American-English spelling suggestions to SquiggleSage's existing grammar, capitalization, typography, and style checks. Firefox's native spelling underlines can remain enabled alongside SquiggleSage.

## What works now

- Continuous, debounced checking while you type.
- Bundled American-English spelling checks and clickable corrections, including errors such as `likededd`.
- A local personal dictionary for accepted words, plus optional Firefox-native spelling underlines.
- Prominent red grammar, capitalization, typography, and style squiggles.
- Clickable suggestion cards with guarded one-click replacement.
- Undo for the last SquiggleSage correction in each live editor.
- Keyboard operation for focused issue markers and suggestion controls.
- A draggable issue-count badge on the active editor, with keyboard repositioning.
- Suggestion messages close from their close button, the badge, Escape, or when the editor disappears.
- **Ignore once**, **Ignore for session** (current tab until reload/close), and disable-rule actions.
- Bounded personal typo-to-correction pairs stored locally with the other settings.
- Global and exact-hostname enable/disable controls.
- Settings for rule categories, individual rules, and typing delay.
- All-frame support for ordinary HTTP, HTTPS, and local-file pages.
- No network request, analytics, logging, accounts, cloud service, or editor-text storage.

## Try it in Firefox

Validate the extension without installing a dependency:

```bash
cd ~/squiggle-sage
node scripts/validate.cjs
node --test
```

Load it temporarily:

1. Open `about:debugging` in Firefox.
2. Select **This Firefox**.
3. Select **Load Temporary Add-on**.
4. Choose this project's `manifest.json`.
5. Reload any page that was already open.

Use [test/manual-smoke.html](test/manual-smoke.html) for a quick manual check. Focus each field. SquiggleSage should flag `likededd` or `mispeling` as a possible misspelling and continue to flag examples such as `the the`, lowercase `i`, and `could of`.

Choose a spelling suggestion to replace the word, undo the latest SquiggleSage correction, use **Ignore once** or **Ignore for session**, or add a valid word to SquiggleSage's personal dictionary. Session ignore applies only to the current tab until it reloads or closes. You can also define personal typo-to-correction pairs in settings. Personal words and replacements stay in Firefox's local extension storage. Session ignores and undo history remain in memory; session ignores disappear on reload/close and undo disappears with its editor or page. Firefox-native spelling remains a separate optional aid controlled through Firefox's **Check Spelling** and **Languages** menus.

Temporary add-ons disappear when Firefox restarts. Release and Beta Firefox require Mozilla signing for persistent installation. See [Firefox distribution and signing](docs/firefox-distribution.md).

## Local processing

| Function | Implementation | Network transmission by SquiggleSage |
|---|---|---|
| Spelling | Bundled Typo.js engine and American-English SCOWL/Hunspell dictionary | None |
| Grammar and style | Eighteen cautious English rules bundled with the extension | None |
| Suggestions and replacement | Content script, background script, and local overlay | None |

The manifest declares no data collection. To provide automatic checks, SquiggleSage's content scripts run on HTTP, HTTPS, and local-file pages, including embedded frames and eligible blank frames. Firefox may describe this as access to data on all websites. Within each page or embedded frame, the access is used for the most recently focused or activated supported editor. The content script passes the active editor text through Firefox's internal extension messaging to the background spelling engine. The text is not sent over a network, logged, or persisted. SquiggleSage does not scan unrelated page text and declares no separate `host_permissions` or `optional_host_permissions` entry.

## Development

```bash
node scripts/validate.cjs
node --test
node scripts/build.cjs
```

`npm run build` writes three distribution artifacts under `dist/`:

- `squiggle-sage-<version>-unsigned.xpi` - the complete unsigned extension for testing or Mozilla submission.
- `squiggle-sage-<version>-source.zip` - readable source, documentation, tests, and build scripts for review.
- `SHA256SUMS-<version>.txt` - integrity hashes for both archives.

The XPI includes an exact, unmodified copy of the pinned official `typo-js@1.3.2` npm release file and a SCOWL/Hunspell American-English dictionary. SquiggleSage always provides Typo.js with complete, preloaded packaged dictionary text, so its optional automatic loader is not invoked. Their license texts are packaged with the extension and summarized in [NOTICE.md](NOTICE.md). No package installation, download, minification, transpilation, bundling, or code generation is required. Building archives requires Node.js 20 or newer and a supported ZIP tool. See [BUILD.md](BUILD.md) for the exact reviewer build procedure. Where Mozilla's `web-ext` is already available, it can optionally provide an additional manifest lint:

```bash
npm run lint:webext
```

The optional lint is not required to validate, build, or submit the readable XPI. Mozilla also runs its validator during upload.

## Current limits

- Bundled spelling is American English; Firefox-native spelling can use any dictionary installed by the user.
- Generic DOM editors are supported. Google Docs, Google Slides, canvas editors, closed shadow roots, and some framework-specific rich editors need dedicated adapters.
- Rich-editor support models ordinary block elements, explicit line breaks, and protected embedded nodes.
- SquiggleSage's personal dictionary is local to this Firefox profile and does not synchronize.
- There are no synonyms, AI rewrites, translation, statistics, cross-device sync, or account features.
- Named web services still need site-specific Firefox validation before support is claimed.

See [docs/capabilities.md](docs/capabilities.md) for the capability matrix, [PRIVACY.md](PRIVACY.md) for the exact data boundary, [docs/amo-submission.md](docs/amo-submission.md) for the public listing and reviewer notes, and [docs/future-feature-guardrails.md](docs/future-feature-guardrails.md) for the implementation and rights/privacy release gates proposed for features 5-9.

## License

SquiggleSage's original source, interface, icon, and writing rules are MIT-licensed. The bundled Typo.js engine and SCOWL/Hunspell dictionary retain their respective third-party licenses; see [NOTICE.md](NOTICE.md).

SquiggleSage is an independent project and is not affiliated with or endorsed by Mozilla.

Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries.
