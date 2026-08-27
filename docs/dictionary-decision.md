# English spelling engine and dictionary decision

## Decision

SquiggleSage 0.2.1 uses:

- Official npm release [`typo-js@1.3.2`](https://www.npmjs.com/package/typo-js/v/1.3.2). Its npm `gitHead` is commit `1d594ebd9a12f922fa4884324cfb67ae569e4095` of `cfinke/Typo.js`.
- The normalized American-English SCOWL/Hunspell dictionary from commit `8cfea406b505e4d7df52d5a19bce525df98c54ab` of `wooorm/dictionaries`, package `dictionary-en`.

Both inputs are checked into the source tree and packaged directly. The release build does not download, transpile, minify, bundle, modify, or generate them. The vendored `typo.js` is byte-for-byte identical to the file in the official `typo-js@1.3.2` npm release and to the file at its pinned upstream `gitHead` revision.

Typo.js supports an optional automatic loader when dictionary data is omitted. SquiggleSage never constructs it that way: the background script first reads both packaged `.aff` and `.dic` resources from extension URLs and passes their complete text to the constructor. Consequently, Typo.js takes its preloaded-data branch and its optional loader is unreachable in SquiggleSage's normal construction path. Tests and runtime validation must continue to enforce the extension's no-network boundary.

## Why this combination

Typo.js is a human-readable browser JavaScript implementation of Hunspell-style lookup and suggestions. It supports the affix, compound, replacement, keep-case, no-suggest, and need-affix behavior used by the selected dictionary. It is distributed under the Modified BSD License.

The selected dictionary is the normal American-English SCOWL size-60 dictionary rather than the larger experimental edition. Its upstream documentation states that the normal edition is more carefully checked and avoids uncommon valid words that can hide likely misspellings. It contains 49,568 dictionary entries before affix expansion and is approximately 555 KB with its affix data.

The dictionary is redistributable under the permissions and notices reproduced in `src/data/en-us/LICENSE.txt`. Typo.js licensing is reproduced in `src/vendor/typo-js/LICENSE.txt`.

## Provenance

| Component | Upstream | Pinned revision | Local files |
| --- | --- | --- | --- |
| Typo.js | `https://www.npmjs.com/package/typo-js/v/1.3.2`; `https://github.com/cfinke/Typo.js` | npm `1.3.2`; `gitHead` `1d594ebd9a12f922fa4884324cfb67ae569e4095` | `src/vendor/typo-js/typo.js`, `src/vendor/typo-js/LICENSE.txt` |
| American-English dictionary | `https://github.com/wooorm/dictionaries` | `8cfea406b505e4d7df52d5a19bce525df98c54ab` | `src/data/en-us/index.aff`, `src/data/en-us/index.dic`, `src/data/en-us/LICENSE.txt` |

The dictionary identifies itself as `en_US Hunspell Dictionary`, version `2020.12.07`, derived from SCOWL.

## Vendored file hashes

SHA-256 values for the exact files included in version 0.2.1:

| File | SHA-256 |
| --- | --- |
| `src/vendor/typo-js/typo.js` | `38aca145fe2f2ff727d4b8f25c8698c8199f2884a0811458d6fc0d41d1f81ba3` |
| `src/vendor/typo-js/LICENSE.txt` | `33fd773defec2404a208bd7a1f6c1d371b22c7973f1f2316d26aa9b005cfb1ed` |
| `src/data/en-us/index.aff` | `8ae1f19d4840d957728ad90555d5a8dff6cc5c046279c95ff0c00fc0a0136c7b` |
| `src/data/en-us/index.dic` | `f0b1a234bd178bdd01875b2a392a9647f888b8fe879f79c52aae62c2759b3647` |
| `src/data/en-us/LICENSE.txt` | `2a7e8d8ae9e8facc84818546ae2a8d83aec5e9c80a675ff789acd1c338b53b3d` |

Official npm release verification for `typo-js@1.3.2`:

- Tarball: `https://registry.npmjs.org/typo-js/-/typo-js-1.3.2.tgz`
- npm tarball SHA-1 (`dist.shasum`): `03a0e0e20b06fede619ffee16d5f4e3e032b8eb2`
- npm tarball integrity (`dist.integrity`): `sha512-Z1YkJ7IIYNrFeOxAlHUercY4Q2I+PhYD/3VkWpJGy/Oqudy3bFpNcQxnv6Oa9fTSXCHPGz1eDoX1bZYm2Z891A==`
- Extracted upstream/local `typo/typo.js` SHA-256: `38aca145fe2f2ff727d4b8f25c8698c8199f2884a0811458d6fc0d41d1f81ba3`

## Alternatives considered

- Firefox native spelling remains enabled but ordinary WebExtensions cannot read its misspelled ranges or suggestions, so it cannot power SquiggleSage cards.
- A plain word list would be smaller conceptually but would lose Hunspell affix handling and produce poorer results for normal inflections.
- A network spelling service conflicts with the extension's offline privacy guarantee.
- A bundled native or WebAssembly Hunspell build would add substantially more build and AMO review complexity.

## Review and maintenance rules

- Do not update either component without recording the new upstream revision, license review, file hashes, size impact, and spelling-corpus results.
- Keep both license files in the runtime XPI and source archive.
- Never load dictionary code or data from a remote URL at runtime.
- Keep third-party runtime files unmodified. Put integration behavior in SquiggleSage-owned code instead.
- Verify the vendored Typo.js hash against the official pinned npm release and its upstream `gitHead` raw file before each release.
- Always provide the complete packaged `.aff` and `.dic` strings to the Typo.js constructor; never invoke its optional loader.
