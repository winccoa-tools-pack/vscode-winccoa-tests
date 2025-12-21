# WinCC OA Test Sample Files

This directory contains example test files for the WinCC OA Test Extension.

## Files

### tst_ParserStates.ctl
**Format**: WinCC OA 3.19 (getAllTestCaseIds + switch/case)

Comprehensive test file covering all parser states and assertion types:
- `tc_01_pass_only` - All assertions pass
- `tc_02_single_fail` - Single failure scenario
- `tc_03_pass_then_fail` - Mixed pass/fail sequence
- `tc_04_multi_fail_same_tc` - Multiple failures in one test
- `tc_05_assertPass_assertFail_mix` - Mixed pass()/fail() calls
- `tc_06_compare_mix_pass_fail` - Comparison assertions
- `tc_07_string_mix_pass_fail` - String assertions
- `tc_08_fileExists_pass_fail` - File existence checks
- `tc_09_messages_info_pass_fail` - Info messages and failures
- `tc_10_abort_explicit_unknownFunction_note` - Aborted test state
- `tc_11_pass_after_pass` - Multiple passing assertions

### tst_TimingTests.ctl
**Format**: WinCC OA 3.20 (public test methods)

Test file for validating test execution queue and timing:
- `testVeryFast` - Instant execution
- `testShort` - 1 second delay
- `testMedium` - 3 seconds delay
- `testLong` - 5 seconds delay
- `testMultipleDelays` - 3x 500ms = 1.5 seconds
- `testDelayedFailure` - Delayed failure scenario
- `testInstantPass` - Instant pass

## Usage

These files demonstrate:
1. Both test format versions (3.19 and 3.20)
2. All assertion types and states (pass, fail, abort)
3. Proper Arrange-Act-Assert structure
4. Test execution queue behavior with different durations

Copy these files to your WinCC OA project's `scripts/tests/` directory to test the extension functionality.
