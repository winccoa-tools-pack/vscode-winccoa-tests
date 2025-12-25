# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
