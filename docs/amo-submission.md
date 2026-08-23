# Mozilla Add-ons submission information

## Public summary

Private, local spelling and English writing suggestions while you type.

## Permission explanation

- The HTTP, HTTPS, and local-file patterns in `content_scripts.matches` let automatic checking work in supported `input`, `textarea`, and `contenteditable` editors.
- `all_frames` and `match_about_blank` support editors embedded in frames.
- `activeTab` is used only when the user opens the toolbar popup, to determine the active tab hostname and request the local issue count.
- `storage` stores settings and exact hostnames explicitly disabled by the user.

Within each page or embedded frame, SquiggleSage processes the most recently focused or activated supported editor. Editor text, page content, full URLs, and suggestions are not transmitted or persisted. The manifest therefore declares `data_collection_permissions.required` as `none`.

## Reviewer notes

SquiggleSage contains no login, account, analytics, telemetry, remote code, native messaging, third-party library, or network request.

All JavaScript, CSS, and HTML in the submitted XPI is human-readable and is not minified, transpiled, bundled, obfuscated, or generated. The XPI contains the source directly, so a separate source submission is normally unnecessary. `BUILD.md` and the source ZIP remain available if a reviewer requests them.

## Test procedure

1. Install the XPI on Firefox 140 or later.
2. Open `test/manual-smoke.html` from the source package.
3. Focus an editor containing the supplied sample text.
4. Verify the red writing markers and numbered badge.
5. Drag the badge, open a suggestion, and apply a replacement.

Native spelling requires an installed Firefox dictionary and **Check Spelling** to be enabled.

## Trademark notice

SquiggleSage is an independent project and is not affiliated with or endorsed by Mozilla.

Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries.
