# SquiggleSage icon assets

`icon.svg` is the original white S on a purple rounded rectangle with a red squiggle.
The checked-in PNG exports provide 16, 32, 48, 64, 96, and 128 pixel icons for Firefox and Mozilla Add-ons.
The XPI build packages these files directly; it does not require an image converter.

## Re-export after changing the artwork

With `rsvg-convert` installed, run this from the repository root:

```bash
for size in 16 32 48 64 96 128; do
  rsvg-convert --width "$size" --height "$size" \
    --output "assets/icon-$size.png" assets/icon.svg
done
node scripts/validate.cjs
```

Review the exported PNGs before committing them.
For the public listing, upload `icon-128.png` through Mozilla Add-ons **Manage Listing** and save the icon change.
If the editor requests separate sizes, use `icon-32.png` and `icon-64.png`.
Mozilla's listing editor accepts PNG or JPEG artwork; Firefox also supports SVG icons.

Reference: [Create a captivating icon](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/#create-a-captivating-icon).
