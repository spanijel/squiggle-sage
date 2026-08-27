# Mozilla Add-ons submission information

## Public summary

Private, local American-English spelling and writing suggestions while you type.

## Permission explanation

- The HTTP, HTTPS, and local-file patterns in `content_scripts.matches` let automatic checking work in supported `input`, `textarea`, and `contenteditable` editors.
- `all_frames` and `match_about_blank` support editors embedded in frames.
- `activeTab` is used only when the user opens the toolbar popup, to determine the active tab hostname and request the local issue count.
- `storage` stores settings, exact hostnames explicitly disabled by the user, words explicitly added to the personal dictionary, and bounded plain-text typo-to-correction pairs explicitly created by the user.

Within each page or embedded frame, SquiggleSage processes the most recently focused or activated supported editor. The content script sends that editor's text only through Firefox's internal extension messaging to the packaged background spelling engine. Editor text, page content, full URLs, issue data, and suggestions are not sent over a network, logged, or persisted. Words that the user explicitly adds to the personal dictionary and bounded plain-text replacement pairs that the user explicitly creates are stored locally. Undo and tab-session ignore state remain in memory only. The manifest therefore declares `data_collection_permissions.required` as `none`.

## Reviewer notes

SquiggleSage contains no login, account, analytics, telemetry, diagnostic logging, remote code, native messaging, or network request. All spelling and writing checks occur locally inside Firefox.

Version 0.2.1 includes an exact, unmodified readable copy of the official [`typo-js@1.3.2` npm release](https://www.npmjs.com/package/typo-js/v/1.3.2). It is byte-for-byte identical to that release's `typo/typo.js`; npm metadata identifies upstream [`gitHead` commit `1d594ebd9a12f922fa4884324cfb67ae569e4095`](https://github.com/cfinke/Typo.js/commit/1d594ebd9a12f922fa4884324cfb67ae569e4095). Version 0.2.1 also includes an American-English SCOWL/Hunspell dictionary from pinned upstream commit [`8cfea406b505e4d7df52d5a19bce525df98c54ab`](https://github.com/wooorm/dictionaries/commit/8cfea406b505e4d7df52d5a19bce525df98c54ab). License texts are included at `src/vendor/typo-js/LICENSE.txt` and `src/data/en-us/LICENSE.txt`; provenance and exact hashes are documented in `docs/dictionary-decision.md` and `NOTICE.md`.

The background script reads the complete packaged `.aff` and `.dic` files from extension URLs and always passes both strings to the Typo.js constructor. Typo.js therefore uses its preloaded-data construction path; its optional automatic loader is not invoked. SquiggleSage does not download code or data.

All JavaScript, CSS, HTML, and dictionary files in the submitted XPI are human-readable and are not minified, transpiled, bundled, obfuscated, or generated during the build. The XPI contains the runtime source directly, so a separate source submission is normally unnecessary. `BUILD.md` and the source ZIP remain available if a reviewer requests them.

## Build-tool question

For Mozilla's question about code generators, minifiers, bundlers, template engines, or other tools that process files into runtime code, answer **No**. The build script only validates the checked-in files and packages them into ZIP/XPI archives; it does not transform or combine the runtime source. No dependency installation or code generation is required.

## Test procedure

1. Install the XPI on Firefox 142 or later.
2. Open `test/manual-smoke.html` from the source package.
3. Focus an editor and enter `I likededd this. The the result could of worked.`
4. Verify that SquiggleSage marks `likededd` as a possible misspelling and also reports the repeated word and `could of` writing issues.
5. Open the spelling suggestion and apply a replacement. Verify that the editor text changes and the resolved issue disappears.
6. Enter a valid project or product name that is not in the dictionary, choose **Add to dictionary**, and verify that its spelling issue disappears.
7. Reload the page and enter the same word again. Verify that the personal-dictionary entry remains effective.
8. Apply a correction and activate **Undo last correction**. Verify that the exact prior text is restored. Reload the page and verify that undo history was not persisted.
9. With a SquiggleSage issue control focused, use its documented keyboard controls to open and move through the suggestion UI, apply a correction, and dismiss it without using a pointer.
10. Choose **Ignore once** for one occurrence and verify that another occurrence can still be reported. Choose **Ignore for session** and verify that the same rule and original text are suppressed in the current tab until it reloads or closes.
11. In settings, add a personal replacement such as `hte` to `the`. Enter `hte`, apply the offered correction, and verify that the pair remains after reload and can be removed from settings.
12. Drag the badge, dismiss a suggestion with Escape, and verify that the overlay disappears when the editor is removed or the page is closed.

Firefox-native spelling is optional and independent of SquiggleSage's bundled spelling checks.

## Version 0.2.1 release notes

Restored Typo.js as an exact, unmodified file from the official pinned `typo-js@1.3.2` npm release while retaining the local-only spelling path: SquiggleSage always supplies preloaded packaged dictionary data and never invokes Typo.js's optional loader. Added undo for the last correction in each live editor, keyboard-operable issue and suggestion controls, a tab-session ignore option, and bounded personal typo-to-correction pairs stored locally. No writing is sent to a server.

## Trademark notice

SquiggleSage is an independent project and is not affiliated with or endorsed by Mozilla.

Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries.
