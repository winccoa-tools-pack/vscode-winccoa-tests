# Test Helpers

This directory contains helper functions for integration tests.

## test-project-helpers.ts

Helper functions for working with WinCC OA test projects in integration tests.

### Functions

#### `registerRunnableTestProject()`

Creates and registers a runnable WinCC OA test project from `test/fixtures/projects/runnable`.

Returns a `ProjEnvProject` instance that is registered with WinCC OA.

**Example:**

```typescript
const project = await registerRunnableTestProject();
try {
    await project.start();
    // ... test code
} finally {
    await unregisterTestProject(project);
}
```

#### `unregisterTestProject(project: ProjEnvProject)`

Unregisters and cleans up a test project. Automatically stops the project if running.

#### `withRunnableTestProject(testFn: (project) => Promise<void>)`

Convenience wrapper that automatically registers a test project, runs your test function, and cleans up afterwards.

**Example:**

```typescript
await withRunnableTestProject(async (project) => {
    await project.start();
    assert.ok(project.isRunning());
});
// Project is automatically unregistered here
```

#### `getFixturesPath()`

Returns the absolute path to the `test/fixtures` directory.

#### `getTestProjectPath(projectName: string)`

Returns the absolute path to a specific test project fixture.

**Example:**

```typescript
const path = getTestProjectPath('runnable');
// Returns: /path/to/test/fixtures/projects/runnable
```

## Usage in Tests

see also:

+ test\integration\test-project-helpers.test.ts

## Test Fixtures

The helper uses test project fixtures located in `test/fixtures/projects/`:

+ `runnable/` - A complete runnable WinCC OA project for testing
+ `sub-proj/` - A sub-project fixture (not runnable)

Each fixture contains a `config/` directory with WinCC OA configuration files.
