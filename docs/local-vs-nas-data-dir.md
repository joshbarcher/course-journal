# Committing `.env` across machines with a different `DATA_DIR`

## The problem

`DATA_DIR` is the one setting in `.env` that genuinely differs by machine:

- Windows dev machine: a UNC path (`\\192.168.86.74\app-data`)
- Ubuntu production VM: a local mount point (`/mnt/data-dir`)

Everything else in `.env` (`PORT`, `READ_ONLY`) is identical everywhere. The
values here aren't sensitive (no credentials, just a hostname/path), so
there's no reason `.env` itself needs to be gitignored — the only annoyance
is that a single shared `.env` would need hand-editing every time you pull
on one machine after committing from the other.

## The fix: a small, committed override file per environment

- **`.env`** — the shared defaults: `PORT`, `READ_ONLY`, and the
  Windows-dev-machine value for `DATA_DIR`. This is what `vite dev` and a
  local `npm run start` read directly, unchanged from what's always been
  there.
- **`.env.production`** — one line, committed, that overrides just
  `DATA_DIR` for the Linux production host:
  ```
  DATA_DIR=/mnt/data-dir
  ```

Both files are tracked in git. Pulling on either machine just works —
neither ever needs hand-editing again after initial setup.

### `.gitignore`

```gitignore
# Env
.env.*
!.env.example
!.env.test
!.env.production
```

`.env.*` is ignored by default (so a personal, uncommitted `.env.local`
still works as an escape hatch — see below), but `.env.example`,
`.env.test`, and `.env.production` are explicitly negated back into
tracking.

## How the two files get combined

Node's `--env-file` flag can be passed more than once, and **a later file
overrides an earlier file's value for the same key** (verified against
Node v24 — this isn't documented particularly loudly, worth remembering).
Loading order matters:

```bash
node --env-file=.env --env-file=.env.production build/index.js
```

- `.env` loads first: `PORT`, `READ_ONLY`, and a `DATA_DIR` that's about to
  be overridden.
- `.env.production` loads second: its `DATA_DIR` wins.

This is exactly what production's `node_args` in PM2's `apps.json` does:

```json
{
    "name": "course-journal",
    "cwd": "/home/jarcher/course-journal",
    "script": "start.js",
    "node_args": "--env-file=/home/jarcher/course-journal/.env --env-file=/home/jarcher/course-journal/.env.production"
}
```

Locally, `vite dev` and `npm run start` only ever load `.env` — there's no
`.env.production` on the dev machine, and no need for one.

### The inherited-env nuance (why `start.js` doesn't need to change)

`start.js` itself spawns the actual server as a child process, and
re-specifies just `--env-file .env` on that inner spawn:

```js
const server = spawn('node', ['--env-file', '.env', 'build/index.js'], { stdio: 'inherit' })
```

This does **not** clobber `DATA_DIR` back to the dev-machine value in
production. `--env-file` only sets a variable if it **isn't already
present** in the process's environment — it never overrides an
already-set value. Since `spawn()` inherits the parent's `process.env` by
default, and the parent (`start.js`, launched by PM2 with both `--env-file`
flags) already has the correct `/mnt/data-dir` set, the child's own
`--env-file .env` is a no-op for `DATA_DIR` (already present) and only
fills in anything the child doesn't already have. Confirmed empirically:

```bash
DATA_DIR=FROM_PARENT node --env-file .env -e "console.log(process.env.DATA_DIR)"
# -> FROM_PARENT, even though .env sets DATA_DIR=FROM_ENV_FILE
```

## Extending this to a third environment

Same pattern: add `.env.staging` (or whatever), negate it in `.gitignore`,
and load it as the last `--env-file` in that environment's invocation. No
code changes needed — this is purely a matter of which files get loaded in
which order, wired up in `package.json` scripts / PM2's `apps.json`, not in
`src/lib/server/env.ts`.

## If a future value actually needs to be a secret

This technique works because nothing in `.env` today is sensitive. If that
ever changes (an API key, a credential), don't add it to `.env` or
`.env.production` — use `.env.local` instead (already covered by the
`.env.*` gitignore rule, never negated) and load it as an additional,
uncommitted `--env-file` on whichever machine actually needs that secret.
