# SquiggleSage

SquiggleSage is a Firefox-first writing assistant whose checks run entirely inside the browser.

Version `0.1.2` supports ordinary `textarea`, text `input`, and `contenteditable` editors. Firefox provides native spelling dictionaries and red spelling underlines. SquiggleSage adds cautious English grammar, capitalization, typography, and style rules with prominent red squiggles and clickable corrections.

## What works now

- Continuous, debounced checking while you type.
- Firefox-native spelling underlines and right-click spelling corrections.
- Prominent red grammar, capitalization, typography, and style squiggles.
- Clickable suggestion cards with guarded one-click replacement.
- A draggable issue-count badge on the active editor, with keyboard repositioning.
- Ignore-once and disable-rule actions.
- Global and exact-hostname enable/disable controls.
- Settings for rule categories, individual rules, and typing delay.
- All-frame support for ordinary HTTP, HTTPS, and local-file pages.
- No network endpoint, analytics, accounts, cloud service, or editor-text storage.

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

Use [test/manual-smoke.html](test/manual-smoke.html) for a quick manual check. Focus each field. Firefox should mark `mispeling` in red, and SquiggleSage should flag examples such as `the the`, lowercase `i`, and `could of`.

If misspellings are not red, right-click inside the editor, enable **Check Spelling**, and select an installed dictionary under **Languages**. SquiggleSage uses Firefox's native spelling feature and does not ship a separate dictionary.

Temporary add-ons disappear when Firefox restarts. Release and Beta Firefox require Mozilla signing for persistent installation. See [Firefox distribution and signing](docs/firefox-distribution.md).

## Local processing

| Function | Implementation | Text transmission by SquiggleSage |
|---|---|---|
| Spelling | Firefox's installed dictionaries | None |
| Grammar and style | Eleven cautious English rules bundled with the extension | None |
| Suggestions and replacement | Content script and local overlay | None |

The manifest declares no data collection. To provide automatic checks, SquiggleSage's content scripts run on HTTP, HTTPS, and local-file pages, including embedded frames and eligible blank frames. Firefox may describe this as access to data on all websites. Within each page or embedded frame, the access is used for the most recently focused or activated supported editor. The extension does not scan unrelated page text, transmit editor text or page content, or contain a network connection source. It declares no separate `host_permissions` or `optional_host_permissions` entry.

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

The runtime and validation paths have no third-party dependency. Building archives requires Node.js 20 or newer and Info-ZIP 3.0 on `PATH` as `zip`. See [BUILD.md](BUILD.md) for the exact reviewer build procedure. Where Mozilla's `web-ext` is already available, it can optionally provide an additional manifest lint:

```bash
npm run lint:webext
```

The optional lint is not required to validate, build, or submit the readable XPI. Mozilla also runs its validator during upload.

## Current limits

- Built-in grammar, capitalization, typography, and style rules are English-only. Spelling can use any Firefox dictionary installed by the user.
- Generic DOM editors are supported. Google Docs, Google Slides, canvas editors, closed shadow roots, and some framework-specific rich editors need dedicated adapters.
- Rich-editor support models ordinary block elements, explicit line breaks, and protected embedded nodes.
- Personal dictionary management remains in Firefox through **Add to Dictionary**.
- There are no synonyms, AI rewrites, translation, statistics, cross-device sync, or account features.
- Named web services still need site-specific Firefox validation before support is claimed.

See [docs/capabilities.md](docs/capabilities.md) for the capability matrix, [PRIVACY.md](PRIVACY.md) for the exact data boundary, and [docs/amo-submission.md](docs/amo-submission.md) for the public listing and reviewer notes.

## License

SquiggleSage is MIT-licensed. Its source, interface, icon, and bundled writing rules are maintained in this repository.

SquiggleSage is an independent project and is not affiliated with or endorsed by Mozilla.

Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries.
