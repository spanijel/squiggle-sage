# Third-party notices

SquiggleSage 0.2.1 includes the following third-party components:

## Typo.js

- Project: Typo.js by Christopher Finke and contributors
- Upstream: <https://github.com/cfinke/Typo.js>
- Official release: [`typo-js@1.3.2`](https://www.npmjs.com/package/typo-js/v/1.3.2)
- Release `gitHead`: `1d594ebd9a12f922fa4884324cfb67ae569e4095`
- License: Modified BSD License
- Packaged license text: `src/vendor/typo-js/LICENSE.txt`
- Packaged `typo.js`: byte-for-byte identical to the official npm release and its pinned upstream `gitHead`

## American-English SCOWL/Hunspell dictionary

- Source package: `dictionary-en` from the `wooorm/dictionaries` project
- Upstream: <https://github.com/wooorm/dictionaries>
- Pinned revision: `8cfea406b505e4d7df52d5a19bce525df98c54ab`
- Dictionary identity: `en_US Hunspell Dictionary`, version `2020.12.07`, derived from SCOWL
- Packaged license and attribution text: `src/data/en-us/LICENSE.txt`

These components are included as readable files and are not downloaded at runtime. SquiggleSage loads the packaged `.aff` and `.dic` text before constructing the unmodified Typo.js engine, so Typo.js's optional loader is not invoked. Their original license terms remain in effect. See [docs/dictionary-decision.md](docs/dictionary-decision.md) for provenance and selection details.

# Trademark notice

SquiggleSage is an independent project and is not affiliated with or endorsed by Mozilla.

Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries.
