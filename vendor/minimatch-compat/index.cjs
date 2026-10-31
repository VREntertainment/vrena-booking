// ESLint 9 and its plugins expect minimatch 3's callable CommonJS export.
// All matching and safety limits come from the unmodified patched upstream.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- This is the legacy CommonJS entry point.
const patched = require('minimatch-patched');
module.exports = Object.assign(patched.minimatch, patched);
