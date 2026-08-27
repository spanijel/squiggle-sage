# Firefox distribution and signing

## Why signing is required

Standard Firefox Release and Beta builds install extensions persistently only when Mozilla has signed them. Renaming a ZIP file to `.xpi` creates a valid extension archive, but it does not add Mozilla's signature.

SquiggleSage uses one stable Gecko identity for updates:

```text
squiggle-sage@spanijel.github.io
```

## Build the distribution bundle

```bash
cd ~/squiggle-sage
node scripts/validate.cjs
node --test
node scripts/build.cjs
```

The build produces:

- `dist/squiggle-sage-<version>-unsigned.xpi`
- `dist/squiggle-sage-<version>-source.zip`
- `dist/SHA256SUMS-<version>.txt`

The XPI contains only the runtime files declared by `scripts/build.cjs`, including an exact, unmodified copy of the official `typo-js@1.3.2` npm release file, the American-English SCOWL/Hunspell dictionary, and both third-party license files. SquiggleSage passes complete packaged dictionary strings to Typo.js, so its optional loader is not invoked. The source ZIP contains readable runtime code, documentation, tests, and build scripts. No dependency installation, download, minification, transpilation, bundling, or code generation is required. Building requires Node.js 20 or newer and either Info-ZIP 3.0 on `PATH` as `zip` or the built-in `tar.exe` on Windows. See [../BUILD.md](../BUILD.md).

## Submit an update to the public Mozilla Add-ons listing

1. Sign in to the [Mozilla Add-ons Developer Hub](https://addons.mozilla.org/developers/).
2. Open the existing SquiggleSage listing and choose **Upload New Version**. Do not create a second add-on listing.
3. Upload `dist/squiggle-sage-<version>-unsigned.xpi`.
4. If Mozilla requests source code, upload `dist/squiggle-sage-<version>-source.zip`.
5. Complete Mozilla's privacy and licensing declarations using `PRIVACY.md`, `LICENSE`, `NOTICE.md`, and the packaged third-party license files as the source of truth.
6. Explain that content scripts need HTTP, HTTPS, and local-file page access to find the focused supported editor, while all processing remains local.
7. Use [amo-submission.md](amo-submission.md) for the listing copy, permission explanation, reviewer notes, build-tool answer, release notes, and test procedure.
8. Complete the version details and submit version 0.2.1 for validation or review.

After approval, Mozilla signs version 0.2.1 and publishes it through the existing listing. Firefox installations obtained from that listing then receive the update through Mozilla's normal update channel.

Do not paste Mozilla API keys or secrets into chat, source files, Git history, or shell commands.

## Install a signed build on another Firefox

For a public listing, open its Mozilla Add-ons page in the other Firefox and select **Add to Firefox**. If Mozilla instead provides a signed file, use the gear menu in `about:addons`, select **Install Add-on From File...**, and choose the signed `.xpi`.

Pin **SquiggleSage** from Firefox's Extensions menu if desired. The unsigned XPI remains suitable for temporary testing through `about:debugging`, but standard Firefox rejects it as a permanent installation.

SquiggleSage is an independent project and is not affiliated with or endorsed by Mozilla.

Firefox is a trademark of the Mozilla Foundation in the U.S. and other countries.

## Official Mozilla references

- [Add-on signing in Firefox](https://support.mozilla.org/en-US/kb/add-on-signing-in-firefox)
- [Signing and distribution overview](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)
- [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- [Updating your extension](https://extensionworkshop.com/documentation/manage/updating-your-extension/)
