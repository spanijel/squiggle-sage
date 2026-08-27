# English spelling engine and dictionary decision

## Decision

SquiggleSage 0.2.0 uses:

- Typo.js from commit `1d594ebd9a12f922fa4884324cfb67ae569e4095` of `cfinke/Typo.js`.
- The normalized American-English SCOWL/Hunspell dictionary from commit `8cfea406b505e4d7df52d5a19bce525df98c54ab` of `wooorm/dictionaries`, package `dictionary-en`.

Both inputs are checked into the source tree and packaged directly. The release build does not download, transpile, minify, bundle, or generate them.

The vendored Typo.js file has one security-focused local modification: its optional automatic file-loading implementation was removed. SquiggleSage always passes already-loaded packaged dictionary strings to the constructor, so the removed path is unnecessary and removing it ensures the vendor component cannot initiate an HTTP request.

## Why this combination

Typo.js is a human-readable browser JavaScript implementation of Hunspell-style lookup and suggestions. It supports the affix, compound, replacement, keep-case, no-suggest, and need-affix behavior used by the selected dictionary. It is distributed under the Modified BSD License.

The selected dictionary is the normal American-English SCOWL size-60 dictionary rather than the larger experimental edition. Its upstream documentation states that the normal edition is more carefully checked and avoids uncommon valid words that can hide likely misspellings. It contains 49,568 dictionary entries before affix expansion and is approximately 555 KB with its affix data.

The dictionary is redistributable under the permissions and notices reproduced in `src/data/en-us/LICENSE.txt`. Typo.js licensing is reproduced in `src/vendor/typo-js/LICENSE.txt`.

## Provenance

| Component | Upstream | Pinned revision | Local files |
| --- | --- | --- | --- |
| Typo.js | `https://github.com/cfinke/Typo.js` | `1d594ebd9a12f922fa4884324cfb67ae569e4095` | `src/vendor/typo-js/typo.js`, `src/vendor/typo-js/LICENSE.txt` |
| American-English dictionary | `https://github.com/wooorm/dictionaries` | `8cfea406b505e4d7df52d5a19bce525df98c54ab` | `src/data/en-us/index.aff`, `src/data/en-us/index.dic`, `src/data/en-us/LICENSE.txt` |

The dictionary identifies itself as `en_US Hunspell Dictionary`, version `2020.12.07`, derived from SCOWL.

## Vendored file hashes

SHA-256 values for the exact files included in version 0.2.0:

| File | SHA-256 |
| --- | --- |
| `src/vendor/typo-js/typo.js` | `466180bbc5a6bd0960463a3f0b657ea640900514eafe38de8bff15ba7dcb46ae` |
| `src/vendor/typo-js/LICENSE.txt` | `33fd773defec2404a208bd7a1f6c1d371b22c7973f1f2316d26aa9b005cfb1ed` |
| `src/data/en-us/index.aff` | `8ae1f19d4840d957728ad90555d5a8dff6cc5c046279c95ff0c00fc0a0136c7b` |
| `src/data/en-us/index.dic` | `f0b1a234bd178bdd01875b2a392a9647f888b8fe879f79c52aae62c2759b3647` |
| `src/data/en-us/LICENSE.txt` | `2a7e8d8ae9e8facc84818546ae2a8d83aec5e9c80a675ff789acd1c338b53b3d` |

## Alternatives considered

- Firefox native spelling remains enabled but ordinary WebExtensions cannot read its misspelled ranges or suggestions, so it cannot power SquiggleSage cards.
- A plain word list would be smaller conceptually but would lose Hunspell affix handling and produce poorer results for normal inflections.
- A network spelling service conflicts with the extension's offline privacy guarantee.
- A bundled native or WebAssembly Hunspell build would add substantially more build and AMO review complexity.

## Review and maintenance rules

- Do not update either component without recording the new upstream revision, license review, file hashes, size impact, and spelling-corpus results.
- Keep both license files in the runtime XPI and source archive.
- Never load dictionary code or data from a remote URL at runtime.
- Any local modifications to vendored code must be documented in this file and marked in the source.
