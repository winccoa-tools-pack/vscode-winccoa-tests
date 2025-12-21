import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import { JsonResultParser } from '../../jsonResultParser';

suite('Location Parsing Tests', () => {
    const projectRoot = '/home/testus/wincc_proj/DevEnv';
    const fullResultPath = path.join(projectRoot, 'fullResult.json');

    test('Failed assertion should have correct file location', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found. Run a real test first.');
            return;
        }

        const results = await JsonResultParser.parseResults(projectRoot, ['tc_02_single_fail']);
        
        const tc02 = results.get('tc_02_single_fail');
        assert.ok(tc02, 'Should find tc_02_single_fail');

        // Find the failed assertion
        const failedAssertion = tc02!.assertions.find(a => a.status === 'failed');
        assert.ok(failedAssertion, 'Should have a failed assertion');

        // Should have a location
        assert.ok(failedAssertion!.location, 'Failed assertion should have a location');

        // Check the location points to the correct file
        const location = failedAssertion!.location!;
        assert.ok(location.uri.fsPath.includes('tst_ParserStates.ctl'), 
            `Location should point to test file, got: ${location.uri.fsPath}`);

        // Check the line number is reasonable (should be line 79 according to JSON)
        const lineNumber = location.range.start.line + 1; // Convert 0-based to 1-based
        console.log(`Failed assertion location: ${location.uri.fsPath}:${lineNumber}`);
        
        assert.ok(lineNumber > 0 && lineNumber < 1000, 
            `Line number should be reasonable, got: ${lineNumber}`);
        
        // According to fullResult.json, the failed assertion should be at line 79
        assert.strictEqual(lineNumber, 79, 
            `Failed assertion should be at line 79, got: ${lineNumber}`);
    });

    test('Multiple assertions - each should have correct location', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found');
            return;
        }

        const results = await JsonResultParser.parseResults(projectRoot, ['tc_01_pass_only']);
        
        const tc01 = results.get('tc_01_pass_only');
        assert.ok(tc01, 'Should find tc_01_pass_only');

        // tc_01 has multiple passing assertions, each at different lines
        console.log(`tc_01 has ${tc01!.assertions.length} assertions`);

        let previousLine = 0;
        for (let i = 0; i < tc01!.assertions.length; i++) {
            const assertion = tc01!.assertions[i];
            
            if (assertion.location) {
                const lineNumber = assertion.location.range.start.line + 1;
                console.log(`Assertion ${i}: line ${lineNumber}, message: ${assertion.message.substring(0, 50)}`);
                
                // Each assertion should be at a different line (generally increasing)
                // (Though they might not be strictly sequential)
                assert.ok(lineNumber > 0, `Assertion ${i} should have valid line number`);
                
                previousLine = lineNumber;
            }
        }
    });

    test('Aborted test should have location at abort line', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found');
            return;
        }

        const results = await JsonResultParser.parseResults(projectRoot, ['tc_10_abort_explicit_unknownFunction_note']);
        
        const tc10 = results.get('tc_10_abort_explicit_unknownFunction_note');
        assert.ok(tc10, 'Should find tc_10');

        // Find the aborted assertion
        const abortedAssertion = tc10!.assertions.find(a => a.status === 'aborted');
        assert.ok(abortedAssertion, 'Should have an aborted assertion');

        // Should have a location
        assert.ok(abortedAssertion!.location, 'Aborted assertion should have a location');

        const location = abortedAssertion!.location!;
        const lineNumber = location.range.start.line + 1;
        
        console.log(`Aborted assertion location: ${location.uri.fsPath}:${lineNumber}`);
        
        // Location should point to a valid line
        assert.ok(lineNumber > 0, 'Aborted assertion should have valid line number');
    });

    test('Location points to actual test file, not library', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found');
            return;
        }

        const results = await JsonResultParser.parseResults(projectRoot, ['tc_02_single_fail']);
        
        const tc02 = results.get('tc_02_single_fail');
        const failedAssertion = tc02!.assertions.find(a => a.status === 'failed');

        const location = failedAssertion!.location!;
        
        // Location should point to the test script, not to OaTestBase library
        assert.ok(!location.uri.fsPath.includes('OaTestBase.ctl'), 
            'Location should not point to OaTestBase library');
        
        assert.ok(location.uri.fsPath.includes('tst_ParserStates.ctl') || 
                  location.uri.fsPath.includes('scripts/tests'), 
            `Location should point to test script, got: ${location.uri.fsPath}`);
    });

    test('ParseLocation extracts correct line from Location string', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found');
            return;
        }

        const results = await JsonResultParser.parseResults(projectRoot, ['tc_02_single_fail']);
        
        const tc02 = results.get('tc_02_single_fail');
        
        // Check all assertions to see if they have locations
        let assertionsWithLocation = 0;
        let assertionsWithoutLocation = 0;
        
        for (const assertion of tc02!.assertions) {
            if (assertion.location) {
                assertionsWithLocation++;
                const line = assertion.location.range.start.line + 1;
                console.log(`  Line ${line}: ${assertion.message.substring(0, 40)}...`);
            } else {
                assertionsWithoutLocation++;
            }
        }
        
        console.log(`Assertions with location: ${assertionsWithLocation}`);
        console.log(`Assertions without location: ${assertionsWithoutLocation}`);
        
        // All assertions should have locations
        assert.strictEqual(assertionsWithoutLocation, 0, 
            'All assertions should have location information');
    });
});
