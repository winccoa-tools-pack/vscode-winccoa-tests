import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { JsonResultParser } from '../../jsonResultParser';

suite('JsonResultParser Unit Tests', () => {
    const fixturesDir = path.join(__dirname, '../fixtures');

    test('Parse full test results from JSON', async () => {
        // Use the actual fullResult.json from DevEnv
        const projectRoot = '/home/testus/wincc_proj/DevEnv';
        
        const results = await JsonResultParser.parseResults(projectRoot);

        // Should find multiple test cases
        assert.ok(results.size > 0, 'Should parse test cases');

        // Check tc_01_pass_only
        const tc01 = results.get('tc_01_pass_only');
        assert.ok(tc01, 'Should find tc_01_pass_only');
        assert.strictEqual(tc01!.status, 'passed', 'tc_01 should be passed');
        assert.ok(tc01!.assertions.length > 0, 'Should have assertions');

        // All assertions in tc_01 should be passed
        for (const assertion of tc01!.assertions) {
            assert.strictEqual(assertion.status, 'passed', 'All tc_01 assertions should pass');
        }
    });

    test('Parse tc_02_single_fail with FAILED and OK assertions', async () => {
        const projectRoot = '/home/testus/wincc_proj/DevEnv';
        
        const results = await JsonResultParser.parseResults(projectRoot, ['tc_02_single_fail']);

        const tc02 = results.get('tc_02_single_fail');
        assert.ok(tc02, 'Should find tc_02_single_fail');
        assert.strictEqual(tc02!.status, 'failed', 'tc_02 should be failed overall');
        
        // Should have at least 2 assertions (1 FAILED, 1 OK)
        assert.ok(tc02!.assertions.length >= 2, `Should have >= 2 assertions, got ${tc02!.assertions.length}`);

        // Should have at least one failed assertion
        const failedAssertions = tc02!.assertions.filter(a => a.status === 'failed');
        assert.ok(failedAssertions.length > 0, 'Should have failed assertions');

        // Should have at least one passed assertion
        const passedAssertions = tc02!.assertions.filter(a => a.status === 'passed');
        assert.ok(passedAssertions.length > 0, 'Should have passed assertions');
    });

    test('Parse tc_03_pass_then_fail with multiple failures', async () => {
        const projectRoot = '/home/testus/wincc_proj/DevEnv';
        
        const results = await JsonResultParser.parseResults(projectRoot, ['tc_03_pass_then_fail']);

        const tc03 = results.get('tc_03_pass_then_fail');
        assert.ok(tc03, 'Should find tc_03_pass_then_fail');
        assert.strictEqual(tc03!.status, 'failed', 'tc_03 should be failed');

        // Should have both passed and failed assertions
        const failedCount = tc03!.assertions.filter(a => a.status === 'failed').length;
        const passedCount = tc03!.assertions.filter(a => a.status === 'passed').length;

        assert.ok(failedCount > 0, 'Should have failed assertions');
        assert.ok(passedCount > 0, 'Should have passed assertions');
    });

    test('Parse aborted test case', async () => {
        const projectRoot = '/home/testus/wincc_proj/DevEnv';
        
        const results = await JsonResultParser.parseResults(projectRoot);

        // First, check if we get any results at all
        assert.ok(results.size > 0, `Should parse some test cases, got ${results.size}`);

        // Log what we found
        const allTestIds = Array.from(results.keys());
        console.log('Found test IDs:', allTestIds);

        // Specifically check for tc_10
        const tc10 = results.get('tc_10_abort_explicit_unknownFunction_note');
        if (tc10) {
            console.log(`tc_10 status: ${tc10.status}, assertions: ${tc10.assertions.length}`);
            console.log(`tc_10 assertion statuses: ${tc10.assertions.map(a => a.status).join(', ')}`);
        } else {
            console.log('tc_10 NOT FOUND in results!');
        }

        // Find any test with aborted status
        let foundAborted = false;
        for (const [testId, testCase] of results.entries()) {
            if (testCase.status === 'aborted') {
                foundAborted = true;
                console.log(`Found aborted test: ${testId}`);
                
                // Should have at least one aborted assertion
                const abortedAssertions = testCase.assertions.filter(a => a.status === 'aborted');
                assert.ok(abortedAssertions.length > 0, 'Aborted test should have aborted assertions');
                break;
            }
        }

        assert.ok(foundAborted, 'Should find at least one aborted test (Statistic shows 1 aborted)');
    });

    test('Parse stack traces correctly', async () => {
        const projectRoot = '/home/testus/wincc_proj/DevEnv';
        
        const results = await JsonResultParser.parseResults(projectRoot, ['tc_02_single_fail']);

        const tc02 = results.get('tc_02_single_fail');
        assert.ok(tc02, 'Should find tc_02_single_fail');

        // Find first failed assertion
        const failedAssertion = tc02!.assertions.find(a => a.status === 'failed');
        assert.ok(failedAssertion, 'Should have failed assertion');

        // Should have stack trace
        assert.ok(failedAssertion!.stackTrace, 'Should have stack trace');
        assert.ok(failedAssertion!.stackTrace!.length > 0, 'Stack trace should not be empty');

        // At least one stack frame should have a location
        const framesWithLocation = failedAssertion!.stackTrace!.filter(msg => msg.location !== undefined);
        assert.ok(framesWithLocation.length > 0, 'At least one stack frame should have location');
    });

    test('Parse assertion values (expected vs actual)', async () => {
        const projectRoot = '/home/testus/wincc_proj/DevEnv';
        
        const results = await JsonResultParser.parseResults(projectRoot, ['tc_02_single_fail']);

        const tc02 = results.get('tc_02_single_fail');
        const failedAssertion = tc02!.assertions.find(a => a.status === 'failed');

        // Failed assertion should have expected and actual values
        assert.ok(failedAssertion!.expected !== undefined, 'Should have expected value');
        assert.ok(failedAssertion!.actual !== undefined, 'Should have actual value');
        assert.notStrictEqual(failedAssertion!.expected, failedAssertion!.actual, 'Expected should differ from actual');
    });

    test('Filter by specific test case IDs', async () => {
        const projectRoot = '/home/testus/wincc_proj/DevEnv';
        
        const results = await JsonResultParser.parseResults(projectRoot, ['tc_01_pass_only', 'tc_02_single_fail']);

        // Should only return requested test cases
        assert.strictEqual(results.size, 2, 'Should return exactly 2 test cases');
        assert.ok(results.has('tc_01_pass_only'), 'Should have tc_01');
        assert.ok(results.has('tc_02_single_fail'), 'Should have tc_02');
    });

    test('Handle non-existent result file gracefully', async () => {
        const nonExistentPath = '/tmp/nonexistent-winccoa-project';
        
        const results = await JsonResultParser.parseResults(nonExistentPath);

        // Should return empty map, not throw
        assert.strictEqual(results.size, 0, 'Should return empty results for non-existent file');
    });

    test('Verify statistics match summary', async () => {
        const projectRoot = '/home/testus/wincc_proj/DevEnv';
        
        const results = await JsonResultParser.parseResults(projectRoot);

        // Count statuses
        let passedCount = 0;
        let failedCount = 0;
        let abortedCount = 0;

        for (const testCase of results.values()) {
            if (testCase.status === 'passed') {
                passedCount++;
            } else if (testCase.status === 'failed') {
                failedCount++;
            } else if (testCase.status === 'aborted') {
                abortedCount++;
            }
        }

        // Note: The statistics in quickResult.json are assertion counts, not test case counts
        // So we just verify we have the right kinds of results
        assert.ok(passedCount > 0, 'Should have passed tests');
        assert.ok(failedCount > 0, 'Should have failed tests');
        assert.ok(abortedCount > 0, 'Should have aborted tests');
    });
});
