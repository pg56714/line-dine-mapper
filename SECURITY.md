# Security

## Known issues

Last checked: 2026-10-30.

| Package | Version | Fixed in | Held back by | Impact and mitigation |
|---|---|---|---|---|
| decode-uri-component | 0.2.2 | 0.5.0 | query-string 7 inside @googlemaps/google-maps-services-js; the fix exists only in the ESM-only 0.5 line, which query-string 7 cannot load | Denial of service when decoding malformed percent-encoded input. The Google Maps client uses query-string to build request URLs, not to parse user input. |

## Not verified

The project is no longer in use, so it was not run against real services: a real ngrok tunnel, LINE replies and Google Maps lookups need real tokens. `tsc`, Biome and the Jest tests pass.
