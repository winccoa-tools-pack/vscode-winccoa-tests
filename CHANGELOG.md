# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.8] - 2026-01-11

### Fixed

- **CI/CD Tests**: Added xvfb-run for headless VS Code tests on Linux CI
  - Tests now run successfully on GitHub Actions without X server
  - Fixes "Missing X server or $DISPLAY" error

## [1.0.7] - 2026-01-11

### Fixed

- **CI/CD Pipeline**: Added missing `build`, `style-check`, and `test:unit` scripts to package.json for CI compatibility
- **Cross-Platform Tests**: Path normalization in location parsing tests for Windows/Linux compatibility
  - Backslashes are now normalized to forward slashes before path comparison
  - Fixes failing test on Linux when parsing Windows paths from test fixtures
- **Code Formatting**: Auto-formatted source files with Prettier to pass style checks

## [1.0.6] - 2026-01-04

### Fixed

- **File Deletion**: Tests are now properly removed from Test Explorer when their source files are deleted
- **Test Case Deletion**: Individual test cases are correctly removed when deleted from a file (via file change detection)
- Root cause: `removeTestItemsForFile` was searching for non-existent `file::` ID items instead of matching by URI

## [1.0.5] - 2026-01-02

### Added

- **Configurable Timeout**: New setting `winccoaTests.testExecutionTimeout` (default: 60000ms) replaces hardcoded 5-second timeout
- Allows tests to run longer without premature timeout failures

### Fixed

- **Error Handling**: Test runner now logs errors when test execution fails (exit code != 0)
- Clearer error messages directing users to Script Actions output channel for execution errors

## [1.0.4] - 2026-01-02

### Fixed

- **Automatic Mode**: Fixed test discovery in automatic mode - tests outside workspace (from WinCC OA projects) are now properly displayed in Test Explorer
- Previously, tests found by discovery were hidden because they weren't in workspace folders

## [1.0.3] - 2026-01-01

### Changed

- **Extension Dependency**: Updated from `RichardJanisch.winccoa-control` to `RichardJanisch.winccoa-project-admin` (renamed in v1.0.4)

## [1.0.2] - 2025-12-30

### Fixed

- **Extension Dependency**: Corrected Script Actions dependency from `RichardJanisch.winccoa-scriptactions` to `RichardJanisch.winccoa-script-actions` (correct package name with hyphen)

## [1.0.1] - 2025-12-30

### Fixed

- **Code References**: Updated extension ID references from `winccoa-tools-pack.winccoa-core` to `RichardJanisch.winccoa-control` in TypeScript code

## [1.0.0] - 2025-12-30

### First Stable Release

**Core Features:**

- Automatic test discovery for WinCC OA 3.19 and 3.20 test formats
- Native VS Code Test Explorer integration
- Test execution via WinCC OA Script Actions extension
- Test cancellation support (stop button)
- Incremental file watcher updates for better performance
- Fast execution with `-n` flag (no event connection)
- Auto-detection via WinCC OA Control extension

**Current Limitations:**

- Individual test case execution not yet supported (runs entire file)
- Test debugging not yet implemented
- Occasional false positives in test discovery with complex files

### Changed

- Updated documentation with unified structure and real-world examples
- Added disclaimer about first stable release status

---

## [0.2.4] - 2025-12-29

### Added

- **Test Cancellation**: Stop running tests via VS Code Test Explorer stop button
- Direct process spawning with kill support for immediate test termination
- Core extension API integration for automatic path detection mode

### Changed

- Reduced test completion timeout from 10s to 5s for faster feedback
- Improved cancellation responsiveness with polling loop check

## [0.2.3] - 2025-12-29

### Changed

- **Performance**: Tests now run with `-n` flag (no event connection) for faster startup
- Updated to use Script Actions 0.4.0+ default commands (executeScript, executeScriptWithArgs)
- Reduced test execution overhead by skipping unnecessary event manager connection

## [0.2.2] - 2025-12-25

### Changed

- **Performance Optimization**: File watcher now only re-parses changed files instead of all files
- Incremental file updates: Created files are parsed and added individually
- Changed files are re-parsed and updated in-place without full test tree rebuild
- Deleted files are removed from test tree without affecting other files
- Added `TestDiscovery.parseTestFile()` method for single file parsing

### Fixed

- Reduced unnecessary full workspace scans on file changes
- Eliminated redundant test discovery on every file modification
- Empty folders are now automatically cleaned up when last test file is removed

## [0.2.1] - 2025-12-25

### Fixed

- Fixed test execution arguments - now passes only testCaseId instead of `single start testCaseId`
- Corrected integration with Script Actions `executeScriptWithArgs` command

### Known Issues

- **WinCC OA Limitation**: When executing single test cases, WinCC OA currently does not generate a full test report. The infrastructure in this extension is prepared for single test execution, but full reporting functionality depends on future WinCC OA improvements.

## [0.2.0] - 2025-12-24

### Added

- Test discovery modes configuration infrastructure
  - `workspace` mode: Searches configured workspace folders with deep recursion
  - `static` mode: Uses static log path as fallback
  - `automatic` mode: Prepared for future WinCC OA Core extension integration (falls back to workspace mode)
- `testDiscoveryMode` configuration setting to choose discovery strategy
- `workspaceFolders` configuration to filter which workspace folders to search
- Deep recursive folder search with `**/scripts/**/*.ctl` pattern
  - Discovers test files at any nesting level (e.g., repos/company/src/code/Project/scripts/)
  - Excludes node_modules automatically
- VS Code debug configuration files (.vscode/launch.json and tasks.json)

### Changed

- Test discovery pattern from `scripts/**/*.ctl` to `**/scripts/**/*.ctl`
  - Finds scripts folders at unlimited depth in directory tree
- File watcher pattern to match deep discovery pattern for consistency
- Test tree hierarchy to show project folder as root instead of workspace
  - Project folder is extracted as one level above scripts/ folder
  - Complete folder structure below project is preserved (scripts/tests/unit/)
  - Cleaner display without repository path clutter

### Fixed

- Test discovery now works with deeply nested WinCC OA projects
- File watcher now monitors all discovered test files regardless of depth
- Tree view shows meaningful project-relative paths

## [0.1.0] - 2025-12-21

### Added

- Initial pre-release of WinCC OA Test Explorer
- VS Code Test Explorer integration for WinCC OA unit tests
- Automatic test discovery for both WinCC OA 3.19 and 3.20 formats
  - 3.19: `getAllTestCaseIds()` with switch/case structure
  - 3.20: `public int test*()` methods
- JSON-based result parsing with accurate line number extraction from StackTrace
- Individual test messages per assertion for better error visibility
- Workspace folder hierarchy with proper test organization
- Click-to-navigate functionality for all test states (passed, failed, aborted)
- Auto-refresh on file changes with multi-workspace support
- Recursive folder execution - run all tests in a folder with one click
- Test execution queue to prevent JSON file race conditions
- Dependency check for WinCC OA Script Actions extension
  - Shows warning when trying to run tests without the required extension
  - Opens VS Code Extensions view for easy installation
- Sample test files in both formats (3.19 and 3.20) with comprehensive coverage
- Structured logging system with ExtensionOutputChannel
- Configurable log levels: ERROR, WARN, INFO, DEBUG, TRACE
- Visual log level icons in output channel
- Detailed test execution logging and diagnostics

### Changed

- Migrated from log file parsing to JSON result parsing for better accuracy
- Changed location parsing to use StackTrace field instead of Location field
- Improved test hierarchy to show workspace folders as top-level items
- Enhanced test navigation with case statement line detection

### Fixed

- Test result locations now point to actual test script lines instead of library lines
- Multiple assertions in single test case now show as separate clickable errors
- Folder execution now recursively collects all .ctl files
- Concurrent test execution properly serialized to prevent file access conflicts
