# Mozilla Add-ons submission information

## Public summary

Private, local American-English spelling and writing suggestions while you type.

## Permission explanation

- The HTTP, HTTPS, and local-file patterns in `content_scripts.matches` let automatic checking work in supported `input`, `textarea`, and `contenteditable` editors.
- `all_frames` and `match_about_blank` support editors embedded in frames.
- `activeTab` is used only when the user opens the toolbar popup, to determine the active tab hostname and request the local issue count.
- `storage` stores settings, exact hostnames explicitly disabled by the user, and words explicitly added to the personal dictionary.

Within each page or embedded frame, SquiggleSage processes the most recently focused or activated supported editor. The content script sends that editor's text only through Firefox's internal extension messaging to the packaged background spelling engine. Editor text, page content, full URLs, issue data, and suggestions are not sent over a network, logged, or persisted. Words that the user explicitly adds to the personal dictionary are stored locally. The manifest therefore declares `data_collection_permissions.required` as `none`.

## Reviewer notes

SquiggleSage contains no login, account, analytics, telemetry, diagnostic logging, remote code, native messaging, or network request. All spelling and writing checks occur locally inside Firefox.

Version 0.2.0 includes readable copies of Typo.js and an American-English SCOWL/Hunspell dictionary. Their license texts are included at `src/vendor/typo-js/LICENSE.txt` and `src/data/en-us/LICENSE.txt`; provenance is documented in `docs/dictionary-decision.md` and `NOTICE.md`. The background script reads the packaged `.aff` and `.dic` files from extension URLs. It does not download code or data.

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
8. Drag the badge, dismiss a suggestion with Escape, and verify that the overlay disappears when the editor is removed or the page is closed.

Firefox-native spelling is optional and independent of SquiggleSage's bundled spelling checks.

## Version 0.2.0 release notes

Added private, offline American-English spelling checks and clickable corrections, including detection of misspellings such as `likededd`. Added a local personal dictionary for accepted words. Expanded grammar and typography coverage for common confusions, repeated phrases and punctuation, and missing spaces after sentence punctuation. Spelling code and dictionary data are packaged with the extension; no writing is sent to a server.

## Trademark notice

SquiggleSage is an independent project and is not affiliated with or endorsed by Mozilla.

Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries.
