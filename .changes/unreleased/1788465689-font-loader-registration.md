---
type: Changed
title: Webfont loaders are registered by the app
breaking: true
---

The `@fontsource/*` imports moved out of the theme module and behind an opt-in
`@niclaslindstedt/oss-framework/theme/fontsource` import (or your own
`registerFontLoaders`), so the published package no longer names font packages
a consumer may not have installed — which previously broke the build of any app
that imported so much as a `Button`.
