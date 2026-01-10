import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { JsonResultParser } from '../../jsonResultParser.js';

suite('Location Parsing Tests', () => {
    const repoFixturesRoot = path.resolve(__dirname, '..', '..', '..', 'src', 'test', 'fixtures');
    const resultsDirEnv = process.env.WINCCOA_TEST_RESULTS_DIR;
    const resultsPathEnv = process.env.WINCCOA_TEST_RESULTS_PATH;

    let projectRoot = resultsDirEnv || repoFixturesRoot;
    let fullResultPath = path.join(projectRoot, 'fullResult.json');
    let tempProjectRoot: string | undefined;

    suiteSetup(() => {
        function isDirectory(p: string): boolean {
            try {
                return fs.statSync(p).isDirectory();
            } catch {
                return false;
            }
        }

        function isFile(p: string): boolean {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        }

        function pickLatestJsonFile(dir: string): string | undefined {
            try {
                const files = fs
                    .readdirSync(dir)
                    .filter((f) => f.toLowerCase().endsWith('.json'))
                    .sort();
                return files.length > 0 ? path.join(dir, files[files.length - 1]) : undefined;
            } catch {
                return undefined;
            }
        }

        function useFileAsFullResult(sourceFilePath: string): void {
            tempProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'winccoa-results-'));
            projectRoot = tempProjectRoot;
            fullResultPath = path.join(projectRoot, 'fullResult.json');
            fs.copyFileSync(sourceFilePath, fullResultPath);
        }

        if (resultsPathEnv && isDirectory(resultsPathEnv)) {
            projectRoot = resultsPathEnv;
            fullResultPath = path.join(projectRoot, 'fullResult.json');
            return;
        }

        if (resultsPathEnv && isFile(resultsPathEnv)) {
            useFileAsFullResult(resultsPathEnv);
            return;
        }

        if (resultsDirEnv && isDirectory(resultsDirEnv)) {
            const candidateFull = path.join(resultsDirEnv, 'fullResult.json');
            if (fs.existsSync(candidateFull)) {
                projectRoot = resultsDirEnv;
                fullResultPath = candidateFull;
                return;
            }

            const latest = pickLatestJsonFile(resultsDirEnv);
            if (latest) {
                useFileAsFullResult(latest);
                return;
            }
        }
    });

    suiteTeardown(() => {
        if (tempProjectRoot) {
            try {
                fs.rmSync(tempProjectRoot, { recursive: true, force: true });
            } catch {
                // ignore
            }
            tempProjectRoot = undefined;
        }
    });

    function extractAtLocation(frame: string): { filePath: string; line: number } | undefined {
        const atMatch = frame.match(/\s+at\s+(.+?):(\d+)/);
        if (!atMatch) {
            return undefined;
        }
        const filePath = atMatch[1].trim();
        const line = Number.parseInt(atMatch[2], 10);
        if (!filePath || Number.isNaN(line)) {
            return undefined;
        }
        return { filePath, line };
    }

    async function loadResults(): Promise<Map<string, any>> {
        if (!fs.existsSync(fullResultPath)) {
            return new Map();
        }
        return JsonResultParser.parseResults(projectRoot);
    }

    test('Failed assertion should have correct file location', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log(
                `⚠️  Skipping: fullResult.json not found at ${fullResultPath}. Set WINCCOA_TEST_RESULTS_DIR (folder) or WINCCOA_TEST_RESULTS_PATH (json file).`,
            );
            return;
        }

        const results = await loadResults();
        assert.ok(results.size > 0, 'Should parse at least one test case');

        let assertionWithLocation: any | undefined;
        for (const testCase of results.values()) {
            const found = testCase.assertions?.find((a: any) => a.location);
            if (found) {
                assertionWithLocation = found;
                break;
            }
        }

        assert.ok(assertionWithLocation, 'Should find at least one assertion with a location');

        const location = assertionWithLocation.location;
        assert.ok(location?.uri?.fsPath, 'Location should have uri.fsPath');

        const lineNumber = location.range.start.line + 1; // Convert 0-based to 1-based
        assert.ok(lineNumber > 0, `Line number should be > 0, got: ${lineNumber}`);
    });

    test('Multiple assertions - each should have correct location', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found');
            return;
        }

        const results = await loadResults();
        assert.ok(results.size > 0, 'Should parse at least one test case');

        let candidate: any | undefined;
        for (const testCase of results.values()) {
            if (Array.isArray(testCase.assertions) && testCase.assertions.length >= 2) {
                candidate = testCase;
                break;
            }
        }

        assert.ok(candidate, 'Should find a test case with multiple assertions');

        for (let i = 0; i < candidate.assertions.length; i++) {
            const assertion = candidate.assertions[i];
            if (assertion.status === 'aborted') {
                continue;
            }
            assert.ok(
                assertion.location,
                `Assertion ${i} should have location (status=${assertion.status})`,
            );
            const lineNumber = assertion.location.range.start.line + 1;
            assert.ok(lineNumber > 0, `Assertion ${i} should have valid line number`);
        }
    });

    test('Aborted assertions do not have location (by design)', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found');
            return;
        }

        const results = await loadResults();
        assert.ok(results.size > 0, 'Should parse at least one test case');

        let abortedAssertion: any | undefined;
        for (const testCase of results.values()) {
            const found = testCase.assertions?.find((a: any) => a.status === 'aborted');
            if (found) {
                abortedAssertion = found;
                break;
            }
        }

        if (!abortedAssertion) {
            console.log('⚠️  Skipping: no aborted assertions found in fixture');
            return;
        }

        assert.ok(!abortedAssertion.location, 'Aborted assertions should not have a location');
    });

    test('Location points to actual test file, not library', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found');
            return;
        }

        const results = await loadResults();
        assert.ok(results.size > 0, 'Should parse at least one test case');

        let assertionWithLocation: any | undefined;
        for (const testCase of results.values()) {
            const found = testCase.assertions?.find((a: any) => a.location);
            if (found) {
                assertionWithLocation = found;
                break;
            }
        }

        assert.ok(assertionWithLocation, 'Should find at least one assertion with a location');

        const fsPath: string = assertionWithLocation.location.uri.fsPath;
        assert.ok(
            !fsPath.includes('OaTestBase.ctl'),
            'Location should not point to OaTestBase library',
        );
    });

    test('ParseLocation extracts correct line from Location string', async () => {
        if (!fs.existsSync(fullResultPath)) {
            console.log('⚠️  Skipping: fullResult.json not found');
            return;
        }

        const results = await loadResults();
        assert.ok(results.size > 0, 'Should parse at least one test case');

        let assertionWithLocationAndStack: any | undefined;
        for (const testCase of results.values()) {
            const found = testCase.assertions?.find(
                (a: any) => a.location && Array.isArray(a.stackTrace) && a.stackTrace.length > 0,
            );
            if (found) {
                assertionWithLocationAndStack = found;
                break;
            }
        }

        assert.ok(
            assertionWithLocationAndStack,
            'Should find an assertion with both location and stackTrace',
        );

        const location = assertionWithLocationAndStack.location;
        const locPath = location.uri.fsPath;
        const locLine = location.range.start.line + 1;

        const stackFrames: string[] = assertionWithLocationAndStack.stackTrace.map(
            (m: any) => m.message,
        );
        const matches = stackFrames
            .map((frame) => extractAtLocation(frame))
            .filter((v): v is { filePath: string; line: number } => !!v)
            .filter(
                (v) => path.basename(v.filePath) === path.basename(locPath) && v.line === locLine,
            );

        assert.ok(
            matches.length > 0,
            `Location should match at least one stack frame (loc=${locPath}:${locLine})`,
        );
    });
});
