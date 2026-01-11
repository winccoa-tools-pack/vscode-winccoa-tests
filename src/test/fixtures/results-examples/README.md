# results-examples

Drop real WinCC OA test run artifacts here for local verification.

## Expected layout

Create a subfolder per run (recommended), for example:

- `src/test/fixtures/results-examples/run-2026-01-10-1/fullResult.json`
- `src/test/fixtures/results-examples/run-2026-01-10-1/quickResult.json` (optional)

Only `fullResult.json` is used by the current unit/integration-style tests.

## Running location parsing tests against a specific run

By default, the Location Parsing tests use the repo fixture:

- `src/test/fixtures/fullResult.json`

To run them against a real run you pasted here, you can either:

- point at a folder that contains `fullResult.json` (recommended), via `WINCCOA_TEST_RESULTS_DIR`, or
- point directly at a JSON file (useful when your artifacts are named like `1767995456_{...}.json`), via `WINCCOA_TEST_RESULTS_PATH`.

PowerShell:

```powershell
$env:WINCCOA_TEST_RESULTS_DIR = "${PWD}\src\test\fixtures\results-examples\run-2026-01-10-1"
npm test
```

Or point directly at a JSON file:

```powershell
$env:WINCCOA_TEST_RESULTS_PATH = "${PWD}\src\test\fixtures\results-examples\1767995456_{ed31b7fb-9b23-48e2-b68a-ee27853ef7a0}.json"
npm test
```

Notes:

- The tests validate general invariants (locations parse, line numbers match stack traces), so they should work across different TcIds.
