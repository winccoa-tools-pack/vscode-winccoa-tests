# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
