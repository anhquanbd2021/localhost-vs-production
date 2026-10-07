# Blast Radius Lab — companion demo

Interactive lab for the article *Localhost Works. Production Is a Different
System.* Thirteen production layers stand between a request and its blast
radius. Fire any of nine failure scenarios — a slow dependency, a 50× traffic
burst, a breaking migration on real data — and watch which layer catches it.
Toggle a layer off and the same failure reaches users.

Zero dependencies — Node 20+ only. `app/prod.mjs` holds the layer/scenario
model and is shared by the server, the browser UI, and the tests.

## What it shows

Every scenario names the thing localhost never exercises — expired certs,
connection-pool arithmetic, retry storms, p99 tails — and the layers that make
it survivable in production. Remove `timeouts` and the slow-dependency scenario
stops being contained; remove `migrations` and the breaking deploy has no fast
path back.

## Run it

```text
npm start   # lab on :3000
npm test    # layer coverage, blast-radius invariants
```
