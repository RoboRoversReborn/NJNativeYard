# Keep the review server separate from builds

Next.js owns its build directory and can replace its files during a build. An existing production process may still refer to chunks from the prior build. On 4 November the HTML endpoint returned 200 in 0.09 seconds while a referenced application JavaScript chunk returned 500 because its old filename was absent from `.next`.

Recovery used a complete matching build snapshot and restarted only NativeYard on port 3100. The recovery root returned 200 in 0.23 seconds and all eight referenced JavaScript/CSS assets returned 200. This establishes HTTP and asset health, not rendered visual approval. No RAM increase was needed or justified by that failure.

`next.config.ts` accepts `NATIVEYARD_DIST_DIR`. Keep the running preview in its own ignored directory, distinct from the build under validation. For example, after a successful default build, copy `.next` into a new dedicated `.next-preview-release` directory while excluding its `cache` directory (runtime caches are regenerated), then start it with:

```sh
NATIVEYARD_DIST_DIR=.next-preview-release npm start -- --hostname 127.0.0.1 --port 3100
```

Never build into or replace the directory used by the live preview. Verify the current process/cwd before a scoped restart, then check the root and every referenced static asset. Publish the build ID and serving directory for independent testing so recovery and final versions are distinguishable. Leave unrelated services and ports alone.
