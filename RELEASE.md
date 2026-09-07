# Release creation instructions

Currently this is a manual process.

 0. Are there changes to the public API? Have they been documented in [the wiki](https://github.com/crossfilter/crossfilter/wiki/API-Reference)?
 1. Increment package.json version
 2. `pnpm test`
 3. `pnpm run clean`
 4. `pnpm run build`
 5. `git commit -am "*.*.* Release Prep"`
 6. `git tag -am "*.*.* Release" *.*.*`
 7. `git push`
 8. `git push origin *.*.*`
 9. `pnpm publish`
 10. Update release notes on Github
