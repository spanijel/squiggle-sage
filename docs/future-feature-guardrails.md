# Future feature guardrails

This document describes engineering safeguards for proposed SquiggleSage features. It is a product and review checklist, not legal advice. Before shipping third-party material, confirm its current license and Mozilla's current add-on policies; ask qualified counsel when rights are unclear.

The baseline remains local processing, no remotely hosted executable code or rule data, no automatic uploads, and no storage of editor text.

## 5. Personal dictionary import and export

### Components and permissions

- A versioned JSON schema for personal words and personal replacement pairs.
- An options-page file picker for import, a preview/confirmation screen, and a locally generated download for export.
- Validation, duplicate handling, conflict reporting, and tests for malformed files.
- No new Firefox permission is needed when import uses a user-selected file input and export uses a locally generated `Blob` download.

### Product guardrails

- Accept data only after an explicit file selection and confirmation; never scan folders, cloud drives, the clipboard, or browser history.
- Accept only plain JSON matching the documented schema. Reject JavaScript, WebAssembly, HTML, URLs, executable expressions, unknown object types, and prototype-related keys.
- Normalize text and enforce limits before preview or storage: for example, a 2 MiB file, 10,000 personal words, 2,000 replacement pairs, and 80 Unicode characters per field. Treat these as engineering limits that can be tightened after testing.
- Show exactly how many entries will be added, changed, skipped, or rejected. Never overwrite the existing collection without confirmation and a recoverable backup/export option.
- Export only SquiggleSage settings selected by the user. Never include editor text, hostnames, browsing data, diagnostics, or hidden identifiers.
- Keep import/export local. Do not automatically upload, sync, publish, or share a dictionary.

## 6. Regional English dictionaries

### Components and permissions

- Separately packaged, pinned dictionaries such as `en-GB`, `en-CA`, and `en-AU`, each with provenance, an exact upstream revision, hashes, license text, and attribution.
- A settings selector, packaged-resource loader, cache keyed by dictionary identity, and spelling-corpus tests per region.
- Build-size and performance checks. No new Firefox permission is needed for packaged dictionaries.

### Product guardrails

- Offer only dictionary identifiers shipped in the reviewed extension. Do not fetch dictionaries or updates from a URL.
- Do not add an arbitrary dictionary-pack importer until there is a safe provenance and licensing workflow. A filename or a user's assertion is not enough evidence that redistribution is permitted.
- Keep every upstream dictionary and license file unmodified unless its license and Mozilla policy clearly allow a documented transformation. Prefer official, unmodified release artifacts.
- Block activation when the package identity, expected hash, schema, encoding, or license record does not match the reviewed catalog.
- Describe variants neutrally as language/region choices. Do not imply endorsement by a government, standards organization, browser vendor, or dictionary publisher.

## 7. Local writing statistics

### Components and permissions

- A bounded local analyzer for word count, sentence count, sentence length, vocabulary repetition, and a clearly identified readability formula.
- An on-demand panel with metric definitions, limitations, and tests for empty, large, and multilingual input.
- No new Firefox permission is needed if analysis remains in the existing focused-editor process.

### Product guardrails

- Compute from the active editor only and keep raw text and derived results in memory. Do not persist history or compare documents unless the user explicitly requests and approves such a feature later.
- Do not upload text or metrics, automatically copy them to the clipboard, or include them in telemetry or diagnostic reports.
- Cap analyzed text and processing time so a large editor cannot freeze the page.
- Do not label statistics as proof of authorship, plagiarism, AI generation, intelligence, disability, education, emotion, health, or another sensitive personal trait.
- Present readability as an estimate with a named formula, not a legal, medical, employment, educational, or accessibility determination.
- Require an explicit user action before exporting any report, and export metrics without source text by default.

## 8. Original rule packs

### Components and permissions

- A declarative, versioned rule schema; a bounded interpreter; namespaces; conflict ordering; test fixtures; and per-pack enablement.
- Authorship, provenance, license, and review records for every message, example, pattern, icon, and other asset.
- No new Firefox permission is needed for reviewed packs bundled in the XPI.

### Product guardrails

- Ship original rules or material with verified redistribution rights. Do not copy proprietary rules, explanations, test corpora, icons, branding, or interface text from another writing product.
- Accept data only, never executable code. Reject JavaScript, WebAssembly, dynamic imports, network locations, page selectors, and unrestricted regular expressions. Use a safe bounded pattern vocabulary with maximum lengths and execution budgets.
- Do not download or silently update packs. New bundled packs must pass source review, licensing review, tests, and the normal Mozilla release process.
- Do not expose arbitrary user/community pack import until schema safety, provenance display, and clear local-only trust controls exist. If it is later offered, keep it disabled by default and visibly label unverified local material.
- Prevent rules from reading page context outside the active editor, contacting services, or writing arbitrary settings.
- Use descriptive, trademark-neutral names and never claim equivalence, certification, sponsorship, or compatibility that has not been verified.

## 9. Editor compatibility adapters

### Components and permissions

- Small SquiggleSage-owned adapters behind a common editor interface, using feature detection and focused-editor boundaries.
- Sanitized local test fixtures, lifecycle tests, accessibility tests, and Firefox smoke tests for each supported editor type.
- Prefer generic capability adapters. If a site-specific adapter genuinely requires extra access, request the narrowest optional origin permission at the moment the user enables it and explain why.

### Product guardrails

- Process only the editor the user focuses or explicitly activates. Do not scrape surrounding documents, comments, contacts, account data, revision history, or unrelated page content.
- Never read passwords, payment fields, one-time codes, hidden inputs, or editors marked as sensitive. Maintain explicit exclusions and fail closed when field purpose is uncertain.
- Do not bypass authentication, paywalls, access controls, closed shadow roots, security boundaries, or a site's technical restrictions.
- Do not persist document text, inject text without an explicit correction action, submit forms, publish documents, alter sharing, or trigger site commands.
- Keep replacement actions guarded by current text/range checks and preserve undo behavior. Disable the adapter when mappings are stale or ambiguous.
- Avoid copying proprietary site code or reverse-engineered assets into the extension. Implement against observable, documented behavior with original code.
- Use names such as “canvas-based editor adapter” or “adapter tested with [service]”. Include a clear non-affiliation notice and never use third-party logos or imply official endorsement.
- Provide a per-adapter off switch and a visible compatibility status. A broken adapter must degrade to no checking, not broader page access.

## Release gate for all five features

Before release, verify that the feature:

1. Has an explicit data-flow description and the minimum permissions needed.
2. Has no network or remotely executable path unless a future, separately reviewed product decision changes the privacy model.
3. Rejects malformed, executable, oversized, ambiguous, or unreviewed input before it reaches runtime behavior.
4. Includes provenance and license evidence for every third-party file and uses original product copy and artwork.
5. Preserves the focused-editor boundary, does not persist editor text, and does not act without a clear user gesture.
6. Has unit tests, Firefox lifecycle tests, accessibility checks, and updated AMO reviewer notes and privacy disclosures.
