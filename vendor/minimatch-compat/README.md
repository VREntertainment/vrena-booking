# Legacy lint API adapter

GHSA-g3hv-75wg-m249 is fixed in minimatch 11.0.1. ESLint 9 and several
Next.js lint plugins still expect minimatch 3's callable CommonJS export.
This adapter exposes that export shape and forwards every operation to the
unmodified upstream 11.0.1 package. It does not suppress audit findings or
copy the matching implementation. Modern consumers use 11.0.1 directly.

Remove this adapter when the lint dependencies support the modern named
export. Keep the upstream alias pinned and run lint, dependency compatibility
tests and npm audit when updating it.
