# CI Integration with WinCC OA Docker image

This document describes how GitHub Actions runs integration tests against the WinCC OA Docker image `mpokornyetm/winccoa:v3.19.9-full`.

Required repository/organization secrets:

Workflow file: `.github/workflows/integration-winccoa.yml`

How it runs:

Running manually:

1. Ensure secrets `DOCKER_USER` and `DOCKER_PASSWORD` are added to the repository or organization.
2. From the Actions tab, find `Integration Tests - WinCC OA` and click `Run workflow`.

Notes:

## Running Unit Tests (no WinCC OA required)

The repository provides a lightweight bootstrap test entrypoint for unit tests that do not require a WinCC OA installation.

- Command: `npm test`
- What it does:
  - Runs style checks and the TypeScript build.
  - Executes `test/npm-winccoa-core.test.js`, which scans the `test/` folder for `*.test.ts` files and runs them using `ts-node` via `npx`.

Notes:

- `test/npm-winccoa-core.test.js` will attempt to run tests with `npx ts-node --transpile-only <file>` so you don't need to add `ts-node` as a permanent devDependency.
  The first run may install `ts-node` transiently via `npx`, which can be slower.
- If you prefer to avoid `npx` fetching packages during CI, install `ts-node` as a devDependency and the bootstrap will use the local binary automatically.
- The bootstrap intentionally skips files in `test/fixtures`.

Test folder layout

- `test/unit/` — unit tests that do NOT require a WinCC OA installation. These are executed by the
  `test/npm-winccoa-core.test.js` bootstrap and are suitable for running on GitHub-hosted runners.
- `test/integration/` — tests that require a real WinCC OA runtime or containerized environment.
  These are not executed by the default `npm test` and should be run by the `integration-winccoa.yml`
  workflow or locally inside the WinCC OA container.

Node runtime requirement for unit tests

- The repo uses Node's built-in test runner for `test:unit`. This requires Node >= 20.
- CI runners should use a Node 20+ image when running `npm run test:unit`.

Running TypeScript unit tests

- If you want to run `.ts` tests directly with Node's test runner, use `npm run test:unit:ts`.
  This uses `ts-node` ESM loader — ensure `ts-node` is installed in devDependencies for CI stability.

Troubleshooting:

- If tests are skipped because `ts-node` cannot be run, you can run them locally after installing `ts-node`:

```powershell
npm install --save-dev ts-node
npm test
```

## Integration test toggle

Integration tests in `test/integration` require a WinCC OA runtime. To allow developers to run the test suite locally without WinCC OA installed, the
integration tests will run when WinCC OA is available in the environment.

- CI/Container runs: Integration tests run automatically when WinCC OA is installed in the Docker container.
- Local runs: Integration tests run automatically when WinCC OA is installed locally.

## Help / Safe Triggering

If you only want to build and run tests, you can run the workflow without those secrets — the job will build and run tests but will skip the push step when
credentials are missing.
Always supply your own Docker Hub namespace (or leave blank to default to the repository owner) so that images are not pushed into the upstream template
namespace by mistake.
Click "Run workflow" and set `docker_namespace` to your Docker Hub username and `repo_name` to an appropriate repo name.

```powershell
# Run workflow and set your namespace/repo to avoid pushing into upstream
gh workflow run build-winccoa-image.yml \
    -f docker_namespace=your-docker-namespace \
    -f repo_name=your-repo-name \
    -f node_version=20
```

Use Docker to run the official WinCC OA image and execute `npm run ci:integration` inside the container;
see the `integration-winccoa.yml` steps for the exact invocation.

**Note:** The `ci:integration` script runs `npm ci` which requires `package-lock.json` to be in sync with `package.json`.
If you see an error about lock file sync, run `npm install` locally to update `package-lock.json` and commit the changes.
