# SquiggleSage privacy

SquiggleSage processes writing locally inside Firefox.

## Editor processing

- Within each page or embedded frame, SquiggleSage processes the most recently focused or activated supported editor. It does not scan unrelated page text.
- Its bundled English writing rules run inside the Firefox content script.
- For spelling, the content script sends the active editor text through Firefox's internal extension messaging to SquiggleSage's background script. The background script checks it against the packaged American-English dictionary and returns issue ranges and suggestions to the content script.
- This internal message does not leave Firefox. The extension makes no network request and contains no network endpoint.
- The extension does not log or persist editor text, page content, page URLs, issue ranges, or suggestions.
- Firefox's native spellchecker remains optional and under Firefox's control. SquiggleSage does not read Firefox's spelling results.

## Stored settings

The following values are stored in `browser.storage.local`:

- Global enablement.
- Enabled rule categories and disabled rule identifiers.
- Typing delay.
- Exact hostnames on which the user disabled checking.
- Words explicitly added to SquiggleSage's personal dictionary.

When you open the toolbar popup, SquiggleSage reads the active tab URL only long enough to determine its hostname and apply the per-site setting. It does not store the full URL. Exact hostnames that you explicitly disable and personal-dictionary words that you explicitly add are stored locally.

No telemetry, analytics, diagnostic logging, advertising identifier, account, external service, or cloud synchronization is present.

The manifest declares `data_collection_permissions.required` as `none`. To provide automatic checks, SquiggleSage's content scripts run on HTTP, HTTPS, and local-file pages, including embedded frames and eligible blank frames. Firefox may describe this as access to data on all websites. This page access is used only for local editor processing. Internal content-to-background messages do not transmit data to the developer or any third party. The manifest declares no separate `host_permissions` or `optional_host_permissions` entry. It sets `incognito` to `not_allowed`, so the extension does not run in private-browsing windows.
