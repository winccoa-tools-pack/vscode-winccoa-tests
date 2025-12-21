import * as assert from 'assert';
import * as path from 'path';
import { TestRunParser } from '../../testRunParser';

suite('TestRunParser Unit Tests', () => {
    const fixturesPath = path.join(__dirname, '..', 'fixtures');

    test('Parse pass-only test', async () => {
        const logPath = path.join(fixturesPath, 'pass-only.log');
        const result = await TestRunParser.parseTestRun(logPath, ['tc_01_pass_only']);

        assert.strictEqual(result.testCases.size, 1, 'Should find 1 test case');
        
        const testCase = result.testCases.get('tc_01_pass_only');
        assert.ok(testCase, 'Test case should exist');
        assert.strictEqual(testCase.status, 'passed', 'Test should be PASSED');
        assert.strictEqual(testCase.assertions.length, 2, 'Should have 2 assertions');
        assert.ok(testCase.assertions.every(a => a.type === 'passed'), 'All assertions should be passed');
        
        // Check summary
        assert.strictEqual(result.summary.passed, 1);
        assert.strictEqual(result.summary.failed, 0);
        assert.strictEqual(result.summary.aborted, 0);
    });

    test('Parse single-fail test (has FAILED and OK)', async () => {
        const logPath = path.join(fixturesPath, 'single-fail.log');
        const result = await TestRunParser.parseTestRun(logPath, ['tc_02_single_fail']);

        assert.strictEqual(result.testCases.size, 1, 'Should find 1 test case');
        
        const testCase = result.testCases.get('tc_02_single_fail');
        assert.ok(testCase, 'Test case should exist');
        assert.strictEqual(testCase.status, 'failed', 'Test should be FAILED (because one assert failed)');
        assert.strictEqual(testCase.assertions.length, 2, 'Should have 2 assertions (1 FAILED + 1 OK)');
        
        // Check assertions
        const failedAssertion = testCase.assertions.find(a => a.type === 'failed');
        const passedAssertion = testCase.assertions.find(a => a.type === 'passed');
        
        assert.ok(failedAssertion, 'Should have a failed assertion');
        assert.ok(passedAssertion, 'Should have a passed assertion');
        
        assert.strictEqual(failedAssertion?.note, 'FAIL: 1 != 0 (single fail testcase)');
        assert.strictEqual(passedAssertion?.note, 'PASS after fail (should still be logged)');
        
        // Check summary
        assert.strictEqual(result.summary.passed, 0);
        assert.strictEqual(result.summary.failed, 1);
        assert.strictEqual(result.summary.aborted, 0);
    });

    test('Parse multi-fail test (multiple FAILED in same test)', async () => {
        const logPath = path.join(fixturesPath, 'multi-fail.log');
        const result = await TestRunParser.parseTestRun(logPath, ['tc_04_multi_fail_same_tc']);

        assert.strictEqual(result.testCases.size, 1, 'Should find 1 test case');
        
        const testCase = result.testCases.get('tc_04_multi_fail_same_tc');
        assert.ok(testCase, 'Test case should exist');
        assert.strictEqual(testCase.status, 'failed', 'Test should be FAILED');
        assert.strictEqual(testCase.assertions.length, 3, 'Should have 3 assertions (2 FAILED + 1 OK)');
        
        // Count assertion types
        const failedCount = testCase.assertions.filter(a => a.type === 'failed').length;
        const passedCount = testCase.assertions.filter(a => a.type === 'passed').length;
        
        assert.strictEqual(failedCount, 2, 'Should have 2 failed assertions');
        assert.strictEqual(passedCount, 1, 'Should have 1 passed assertion');
        
        // Check notes
        const notes = testCase.assertions.map(a => a.note);
        assert.ok(notes.includes('FAIL #1: 5 != 7'));
        assert.ok(notes.includes('FAIL #2: 5 is not greater than 7'));
        assert.ok(notes.includes('PASS in the middle of multi-fail'));
    });

    test('Parse aborted test', async () => {
        const logPath = path.join(fixturesPath, 'aborted.log');
        const result = await TestRunParser.parseTestRun(logPath, ['tc_10_abort_explicit_unknownFunction_note']);

        assert.strictEqual(result.testCases.size, 1, 'Should find 1 test case');
        
        const testCase = result.testCases.get('tc_10_abort_explicit_unknownFunction_note');
        assert.ok(testCase, 'Test case should exist');
        assert.strictEqual(testCase.status, 'aborted', 'Test should be ABORTED');
        assert.strictEqual(testCase.assertions.length, 3, 'Should have 3 assertions (1 OK + 1 FAILED + 1 ABORTED)');
        
        // Check assertion types
        const abortedAssertion = testCase.assertions.find(a => a.type === 'aborted');
        assert.ok(abortedAssertion, 'Should have an aborted assertion');
        assert.strictEqual(abortedAssertion?.errorMessage, 'ABORTED testcase (simulated unknownFunction)');
        assert.strictEqual(abortedAssertion?.note, 'unknownFunction');
        
        // Check summary
        assert.strictEqual(result.summary.passed, 0);
        assert.strictEqual(result.summary.failed, 0);
        assert.strictEqual(result.summary.aborted, 1);
    });

    test('Parse multiple different tests in one log', async () => {
        // Create a log with multiple tests
        const logPath = path.join(fixturesPath, 'multiple-tests.log');
        const result = await TestRunParser.parseTestRun(
            logPath, 
            ['tc_01_pass_only', 'tc_02_single_fail']
        );

        // Should find both tests
        assert.strictEqual(result.testCases.size, 2, 'Should find 2 test cases');
        
        const test1 = result.testCases.get('tc_01_pass_only');
        const test2 = result.testCases.get('tc_02_single_fail');
        
        assert.ok(test1, 'First test should exist');
        assert.ok(test2, 'Second test should exist');
        
        assert.strictEqual(test1.status, 'passed', 'First test should pass');
        assert.strictEqual(test2.status, 'failed', 'Second test should fail');
        
        // Check summary
        assert.strictEqual(result.summary.passed, 1);
        assert.strictEqual(result.summary.failed, 1);
        assert.strictEqual(result.summary.aborted, 0);
    });

    test('Parse stack traces correctly', async () => {
        const logPath = path.join(fixturesPath, 'single-fail.log');
        const result = await TestRunParser.parseTestRun(logPath, ['tc_02_single_fail']);

        const testCase = result.testCases.get('tc_02_single_fail');
        assert.ok(testCase);
        
        const failedAssertion = testCase.assertions.find(a => a.type === 'failed');
        assert.ok(failedAssertion);
        
        // Check stack trace
        assert.ok(failedAssertion.stackTrace.length > 0, 'Should have stack trace');
        assert.strictEqual(failedAssertion.stackTrace[0].line, 79, 'First stack trace line should be 79');
        assert.ok(failedAssertion.stackTrace[0].filePath.includes('logger.ctl'));
        
        // Check script/library/line fields
        assert.ok(failedAssertion.scriptPath?.includes('logger.ctl'));
        assert.ok(failedAssertion.libraryPath?.includes('OaTestBase.ctl'));
        assert.strictEqual(failedAssertion.line, 503);
    });
});
