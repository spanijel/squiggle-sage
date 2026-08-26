# Building SquiggleSage

## Requirements

- Node.js 20 or newer.
- Info-ZIP 3.0 available on `PATH` as `zip`, or the built-in `tar.exe` on Windows.

No `npm install`, network access, transpilation, bundling, minification, code generation, or third-party library is required. The XPI contains the readable runtime files listed in `scripts/build.cjs`.

## Validate and build

From the repository root, run:

```bash
node --version
zip -v
node scripts/validate.cjs
node --test
node scripts/build.cjs
```

The build writes:

- `dist/squiggle-sage-<version>-unsigned.xpi`
- `dist/squiggle-sage-<version>-source.zip`
- `dist/SHA256SUMS-<version>.txt`

Verify the published checksums from the `dist` directory:

```bash
cd dist
shasum -a 256 -c SHA256SUMS-<version>.txt
```
