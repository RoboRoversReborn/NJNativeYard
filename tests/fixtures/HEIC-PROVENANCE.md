# Public HEIC decoder regression fixture

`example.heic` is the public libheif project's example image, downloaded unchanged from:
https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic

Upstream repository and license: https://github.com/strukturag/libheif (LGPL-3.0).
Downloaded 2026-11-05. It is upstream sample content, not a user upload or private photograph.

SHA-256: `7f8b363e4936c0666a25f64f3a92fda10bd8e5453be4592530b65a55dd98f3f2`
Size: 718,114 bytes. Primary image: 1280 × 854. The test checks actual HEIF bytes,
locally decodes with libheif-js's bundled WASM, and verifies the resulting JPEG
signature, dimensions, MIME data URL and lossless storage handoff of those JPEG bytes.

The orientation test adds an HEIF `irot` property to this fixture in memory and
associates it with the primary item; no additional personal fixture is used.
