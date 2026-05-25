# End-to-end tests

Playwright tests that hit the running web UI against the running API.

## One-time setup

```bash
npm install --workspace e2e
npm --workspace e2e run install:browsers      # downloads Chromium (~150 MB)
```

## Running

The tests assume both servers are up. In one terminal:

```bash
npm run dev      # starts api on :4000 and web on :5173
```

In another:

```bash
npm --workspace e2e test               # headless
npm --workspace e2e run test:headed    # see the browser
```

Alternatively, set `START_DEV=1` so Playwright spins up the web server itself:

```bash
START_DEV=1 npm --workspace e2e test
```

(The API still has to be running separately — see the comment in
`playwright.config.ts`.)

## Why this isn't wired into CI yet

- Browser binaries are big; the install adds ~3 min to CI cold-start
- The test relies on the SQLite DB at `apps/api/prisma/dev.db`. CI would
  need to spin up a fresh one and run migrations before each run.
- A proper CI gate also needs `expect()`s on the **values** of the resulting
  stations, not just the count — which means it depends on the fixture suite
  (see `packages/shared/test/fixtures/README.md`) being filled in first.

Run it locally for now; CI integration is a Phase-7 polish item.
