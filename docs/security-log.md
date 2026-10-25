# Security Log

English | [繁體中文](security-log.zh-TW.md)

- Date: 2026-10-25
- Branch: `fix/security-upgrades`
- Scope: `package.json`, `yarn.lock`, `src/utils/ngrokUtil.ts`

## Summary

The unmaintained ngrok beta package was replaced with the official SDK, used only for local development, and the dependencies were upgraded within their major versions from the official npm registry. One low-impact advisory remains in decode-uri-component.

## Changes

| Item | Before | After | Reason |
|---|---|---|---|
| ngrok | 5.0.0-beta.2 (dependency) | removed | Command injection advisory; unmaintained beta that downloads the ngrok binary at install time |
| @ngrok/ngrok | - | ^1.7.0 (devDependency) | Official SDK; loaded with a dynamic import only when `IS_LOCAL=true` |
| express | 4.21.2 | 4.22.3 | Refreshed within 4.x |
| mongoose | 8.9.0 | 8.24.7 | Search injection, `$nor` sanitizeFilter bypass and prototype pollution advisories |
| @line/bot-sdk | 9.5.0 | 9.9.0 | Refreshed |
| axios | 1.7.9 (indirect) | 1.20.0 (direct) | SSRF, header-injection and DoS advisories; `googleMapsUtil.ts` imports it directly |
| body-parser | 1.20.3 | removed | Not used (it also had DoS advisories) |
| @types/mongoose | ^5.11.97 | removed | Deprecated stub (mongoose ships its own types) that pulled in a second mongoose copy |
| yarn.lock registry | registry.npmmirror.com | registry.npmjs.org | Use the official registry |
| `tsconfig.json` | - | `skipLibCheck: true` | opencc-js 1.4 ships `.d.ts` files that fail under NodeNext resolution |

## What you need to know

- For local development set `IS_LOCAL=true` and `NGROK_AUTHTOKEN` (see `.env.example`). Production installs do not need ngrok.

## Remaining issues

### Dependency versions held back upstream

| Package | Version | Advisories | Why it is not fixed | Impact and mitigation |
|---|---|---|---|---|
| decode-uri-component | 0.2.2 | 1 (fixed in 0.5.0) | Pulled in by query-string 7 inside @googlemaps/google-maps-services-js; the fix exists only in the ESM-only 0.5 line, which query-string 7 cannot load. | Denial of service when decoding malformed percent-encoded input. The Google Maps client uses query-string to build request URLs, not to parse user input. |

### Requires code changes

- Requests with an invalid LINE signature are rejected, but Express returns 500 instead of 401 because there is no error handler for `SignatureValidationFailed`. Adding one would return a proper 401.

## How it was verified

- `tsc`, `biome check` and `jest` (6 tests) pass.
- Against a local MongoDB: signed webhook requests return 200 and reach the database and the LINE reply API; requests with an invalid signature are rejected.
- With `IS_LOCAL=true`, `@ngrok/ngrok` loads and a connection failure is logged instead of crashing the app.
- osv-scanner on `yarn.lock`; only decode-uri-component remains.

## Not verified

- A real ngrok tunnel (outbound ngrok traffic is blocked in the test environment).
- Real LINE replies and Google Maps lookups (need real tokens).
