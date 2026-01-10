import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionOutputChannel } from './extensionOutput.js';

/**
 * JSON result structure from WinCC OA test framework
 */
export interface WinCCOATestResult {
    Environment: {
        TestVersion: string;
        Version: string;
        Hostname: string;
        SystemEnvironment: Record<string, string>;
    };
    Time: {
        Start: string;
        End: string;
    };
    TestManager: {
        ProgName: string;
        Num: string;
        Type: string;
        Id: string;
    };
    Statistic: {
        Aborted: number;
        Failed: number;
        Passed: number;
        KnownBugs?: number;
    };
    TestCases: TestCaseEntry[];
}

/**
 * Individual test case entry (each assertion is a separate entry)
 */
export interface TestCaseEntry {
    TcId: string;
    Result: 'Pass' | 'Fail' | 'KnownBug' | 'Aborted' | 'Undefined';
    Note?: string;
    StartTimeStamp?: string;
    EndTimeStamp?: string;
    Duration?: number;
    Method?: string;
    Location?: string;
    StackTrace?: string[];
    ErrMsg?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CurrentValue?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReferenceValue?: any;
}

/**
 * Parsed test case result for VS Code Test API
 */
export interface ParsedTestCase {
    testId: string;
    status: 'passed' | 'failed' | 'aborted';
    message: string;
    duration: number;
    assertions: ParsedAssertion[];
}

/**
 * Individual assertion within a test case
 */
export interface ParsedAssertion {
    status: 'passed' | 'failed' | 'aborted';
    message: string;
    stackTrace?: vscode.TestMessage[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expected?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actual?: any;
    location?: vscode.Location;
}

/**
 * Parser for WinCC OA JSON test results
 */
export class JsonResultParser {
    private static readonly LOG_SOURCE = 'JsonResultParser';
    private static readonly FULL_RESULT_FILE = 'fullResult.json';
    private static readonly QUICK_RESULT_FILE = 'quickResult.json';

    /**
     * Parse test results from JSON files
     * @param projectRoot Path to the WinCC OA project root directory
     * @param testCaseIds Optional filter for specific test case IDs
     * @returns Map of test case ID to parsed results
     */
    public static async parseResults(
        projectRoot: string,
        testCaseIds?: string[],
    ): Promise<Map<string, ParsedTestCase>> {
        const results = new Map<string, ParsedTestCase>();

        try {
            const fullResultPath = path.join(projectRoot, this.FULL_RESULT_FILE);

            if (!fs.existsSync(fullResultPath)) {
                ExtensionOutputChannel.warn(
                    this.LOG_SOURCE,
                    `Full result file not found: ${fullResultPath}`,
                );
                return results;
            }

            // Read and parse JSON
            const content = fs.readFileSync(fullResultPath, 'utf-8');
            const testResult: WinCCOATestResult = JSON.parse(content);

            if (!testResult || !Array.isArray(testResult.TestCases)) {
                ExtensionOutputChannel.warn(
                    this.LOG_SOURCE,
                    `Invalid result file format (missing TestCases array): ${fullResultPath}`,
                );
                return results;
            }

            ExtensionOutputChannel.debug(
                this.LOG_SOURCE,
                `Parsing ${testResult.TestCases.length} test entries from ${fullResultPath}`,
            );

            // Group test cases by TcId
            const groupedByCaseId = this.groupByTestCaseId(testResult.TestCases);

            // Filter if testCaseIds provided
            const idsToProcess = testCaseIds || Array.from(groupedByCaseId.keys());

            // Parse each test case
            for (const testId of idsToProcess) {
                const entries = groupedByCaseId.get(testId);
                if (!entries || entries.length === 0) {
                    continue;
                }

                const parsedCase = this.parseTestCase(testId, entries);
                results.set(testId, parsedCase);

                ExtensionOutputChannel.debug(
                    this.LOG_SOURCE,
                    `Parsed ${testId}: status=${parsedCase.status}, assertions=${parsedCase.assertions.length}`,
                );
            }

            const knownBugs = testResult.Statistic?.KnownBugs;
            ExtensionOutputChannel.success(
                this.LOG_SOURCE,
                `Parsed ${results.size} test case(s): ${testResult.Statistic.Passed} passed, ${testResult.Statistic.Failed} failed, ${testResult.Statistic.Aborted} aborted${typeof knownBugs === 'number' ? `, ${knownBugs} known bugs` : ''}`,
            );
        } catch (error) {
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Failed to parse test results from ${projectRoot}`,
                error as Error,
            );

            // In unit tests the OutputChannel is often not initialized; surface the root cause.
            if (!ExtensionOutputChannel.instance) {
                console.error(
                    `[${this.LOG_SOURCE}] Failed to parse test results from ${projectRoot}:`,
                    error,
                );
                console.error(
                    `[${this.LOG_SOURCE}] Failed to parse test results from ${projectRoot}:`,
                    error,
                );
            }
        }

        return results;
    }

    /**
     * Group test case entries by TcId
     */
    private static groupByTestCaseId(entries: TestCaseEntry[]): Map<string, TestCaseEntry[]> {
        const grouped = new Map<string, TestCaseEntry[]>();

        for (const entry of entries) {
            const existing = grouped.get(entry.TcId) || [];
            existing.push(entry);
            grouped.set(entry.TcId, existing);
        }

        return grouped;
    }

    /**
     * Parse a single test case from its entries
     */
    private static parseTestCase(testId: string, entries: TestCaseEntry[]): ParsedTestCase {
        const assertions: ParsedAssertion[] = [];
        let overallStatus: 'passed' | 'failed' | 'aborted' = 'passed';
        let totalDuration = 0;
        const messages: string[] = [];

        for (const entry of entries) {
            // Skip "Undefined" entries (INFO messages without assertions)
            if (entry.Result === 'Undefined') {
                continue;
            }

            // Track overall status (aborted has highest priority, then failed)
            if (entry.Result === 'Aborted') {
                overallStatus = 'aborted';
            } else if ((entry.Result === 'Fail' || entry.Result === 'KnownBug') && overallStatus !== 'aborted') {
                overallStatus = 'failed';
            }

            // Parse assertion
            const assertion = this.parseAssertion(entry);
            assertions.push(assertion);

            // Accumulate duration
            totalDuration += entry.Duration ?? 0;

            // Collect message for summary
            if (entry.Result !== 'Pass') {
                messages.push(`${entry.Result}: ${entry.Note ?? ''}`.trim());
            }
        }

        // Build overall message
        const message =
            messages.length > 0
                ? messages.join('\n')
                : `All ${assertions.length} assertion(s) passed`;

        return {
            testId,
            status: overallStatus,
            message,
            duration: totalDuration,
            assertions,
        };
    }

    /**
     * Parse a single assertion entry
     */
    private static parseAssertion(entry: TestCaseEntry): ParsedAssertion {
        const status = this.mapResultToStatus(entry.Result);
        const message = this.buildAssertionMessage(entry);
        const stackTrace = this.parseStackTrace(entry.StackTrace ?? []);

        // For Abort: don't use stack trace location (it points to startAll())
        // Location will be set from test definition in testController
        const location = entry.Result === 'Aborted' ? undefined : this.parseLocation(entry);

        return {
            status,
            message,
            stackTrace,
            expected: entry.ReferenceValue,
            actual: entry.CurrentValue,
            location,
        };
    }

    /**
     * Map JSON Result to our status type
     */
    private static mapResultToStatus(result: string): 'passed' | 'failed' | 'aborted' {
        switch (result) {
            case 'Pass':
                return 'passed';
            case 'Fail':
            case 'KnownBug':
                return 'failed';
            case 'Aborted':
                return 'aborted';
            default:
                return 'passed'; // Undefined treated as passed for now
        }
    }

    /**
     * Build assertion message from entry
     */
    private static buildAssertionMessage(entry: TestCaseEntry): string {
        const parts: string[] = [];

        // Add note
        if (entry.Note) {
            parts.push(entry.Note);
        }

        // Add values for failed assertions
        if (entry.Result === 'Fail' || entry.Result === 'KnownBug') {
            if (entry.CurrentValue !== undefined && entry.ReferenceValue !== undefined) {
                parts.push(`Expected: ${JSON.stringify(entry.ReferenceValue)}`);
                parts.push(`Actual: ${JSON.stringify(entry.CurrentValue)}`);
            }
        }

        // Add method
        if (entry.Method && entry.Method !== 'oaUnitInfo') {
            parts.push(`Method: ${entry.Method}`);
        }

        return parts.join('\n');
    }

    /**
     * Parse stack trace into VS Code TestMessage array
     */
    private static parseStackTrace(stackTrace: string[]): vscode.TestMessage[] {
        const messages: vscode.TestMessage[] = [];

        for (const frame of stackTrace) {
            const loc = this.parseStackFrame(frame);
            messages.push(this.createTestMessage(frame, loc));
        }

        return messages;
    }

    // Create a VS Code TestMessage when available; otherwise a lightweight fallback.
    private static createTestMessage(
        text: string,
        location?: vscode.Location,
    ): vscode.TestMessage {
        const TestMessageCtor = (vscode as unknown as { TestMessage?: unknown }).TestMessage;
        if (typeof TestMessageCtor === 'function') {
            const msg = new (TestMessageCtor as new (message: string) => vscode.TestMessage)(text);
            if (location) {
                msg.location = location;
            }
            return msg;
        }

        return { message: text, location } as unknown as vscode.TestMessage;
    }

    // Create a VS Code Location when available; otherwise a lightweight fallback.
    private static createLocation(filePath: string, lineNum1Based: number): vscode.Location {
        const vscodeShape = vscode as unknown as {
            Uri?: { file?: (path: string) => vscode.Uri };
            Position?: new (line: number, character: number) => vscode.Position;
            Location?: new (uri: vscode.Uri, position: vscode.Position) => vscode.Location;
        };

        const hasVscodeLocationApi =
            typeof vscodeShape.Uri?.file === 'function' &&
            typeof vscodeShape.Position === 'function' &&
            typeof vscodeShape.Location === 'function';

        if (hasVscodeLocationApi) {
            const uri = vscode.Uri.file(filePath);
            const position = new vscode.Position(lineNum1Based - 1, 0); // VS Code uses 0-based
            return new vscode.Location(uri, position);
        }

        return {
            uri: { fsPath: filePath, path: filePath, scheme: 'file' },
            range: {
                start: { line: lineNum1Based - 1, character: 0 },
                end: { line: lineNum1Based - 1, character: 0 },
            },
        } as unknown as vscode.Location;
    }

    /**
     * Parse stack frame string into location
     * Format: "int TstParserStates::startTestCase(const string &tcId) at /path/to/file.ctl:79"
     */
    private static parseStackFrame(frame: string): vscode.Location | undefined {
        const atMatch = frame.match(/\s+at\s+(.+?):(\d+)/);
        if (!atMatch) {
            return undefined;
        }

        const filePath = atMatch[1];
        const lineNum = parseInt(atMatch[2], 10);

        if (!filePath || isNaN(lineNum)) {
            return undefined;
        }

        return this.createLocation(filePath, lineNum);
    }

    /**
     * Parse location from test case entry into VS Code Location
     * Uses StackTrace to get the actual line in the test script, not the library
     */
    private static parseLocation(entry: TestCaseEntry): vscode.Location | undefined {
        const stackTrace = entry.StackTrace ?? [];

        // 1) Preferred: use StackTrace frame that matches Location's Script path
        if (stackTrace.length > 0 && typeof entry.Location === 'string' && entry.Location.length > 0) {
            const scriptMatch = entry.Location.match(/Script:\s*(.+?)(?:\n|$)/);
            if (scriptMatch) {
                const scriptPath = scriptMatch[1].trim();
                for (const trace of stackTrace) {
                    const atMatch = trace.match(/at\s+(.+?):(\d+)/);
                    if (!atMatch) {
                        continue;
                    }
                    const tracePath = atMatch[1].trim();
                    const lineNum = parseInt(atMatch[2], 10);
                    if (!tracePath || Number.isNaN(lineNum)) {
                        continue;
                    }
                    if (tracePath === scriptPath || tracePath.endsWith(path.basename(scriptPath))) {
                        ExtensionOutputChannel.debug(
                            this.LOG_SOURCE,
                            `Parsed location from StackTrace (script match): ${tracePath}:${lineNum}`,
                        );
                        return this.createLocation(tracePath, lineNum);
                    }
                }
            }
        }

        // 2) Fallback: choose a reasonable StackTrace frame even if Location is missing
        // Some real test outputs do not provide a Location field at all.
        if (stackTrace.length > 0) {
            const candidates = stackTrace
                .map((trace) => {
                    const atMatch = trace.match(/at\s+(.+?):(\d+)/);
                    if (!atMatch) {
                        return undefined;
                    }
                    const tracePath = atMatch[1].trim();
                    const lineNum = parseInt(atMatch[2], 10);
                    if (!tracePath || Number.isNaN(lineNum)) {
                        return undefined;
                    }
                    return { tracePath, lineNum };
                })
                .filter((v): v is { tracePath: string; lineNum: number } => !!v);

            const nonLibrary = candidates.find(
                (c) =>
                    !c.tracePath.toLowerCase().includes('oatestbase.ctl') &&
                    c.tracePath.toLowerCase().endsWith('.ctl'),
            );

            const best = nonLibrary ?? candidates[0];
            if (best) {
                ExtensionOutputChannel.debug(
                    this.LOG_SOURCE,
                    `Parsed location from StackTrace (fallback): ${best.tracePath}:${best.lineNum}`,
                );
                return this.createLocation(best.tracePath, best.lineNum);
            }
        }

        // Fallback to Location field (library line number - not ideal but better than nothing)
        if (typeof entry.Location !== 'string' || entry.Location.length === 0) {
            return undefined;
        }

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Parsing location from Location field: ${JSON.stringify(entry.Location)}`,
        );

        const scriptMatch = entry.Location.match(/Script:\s*(.+?)(?:\n|$)/);
        const lineMatch = entry.Location.match(/Line:\s*(\d+)/);

        if (!scriptMatch || !lineMatch) {
            ExtensionOutputChannel.warn(
                this.LOG_SOURCE,
                `Failed to parse location: scriptMatch=${!!scriptMatch}, lineMatch=${!!lineMatch}`,
            );
            return undefined;
        }

        const filePath = scriptMatch[1].trim();
        const lineNum = parseInt(lineMatch[1], 10);

        if (!filePath || isNaN(lineNum)) {
            ExtensionOutputChannel.warn(
                this.LOG_SOURCE,
                `Invalid location data: filePath="${filePath}", lineNum=${lineNum}`,
            );
            return undefined;
        }

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Parsed location from Location field (fallback): ${filePath}:${lineNum}`,
        );

        return this.createLocation(filePath, lineNum);
    }

    /**
     * Create result files in project root before test run
     */
    public static createResultFiles(projectRoot: string): void {
        try {
            const fullResultPath = path.join(projectRoot, this.FULL_RESULT_FILE);
            const quickResultPath = path.join(projectRoot, this.QUICK_RESULT_FILE);

            // Create empty JSON files
            fs.writeFileSync(fullResultPath, '{}', 'utf-8');
            fs.writeFileSync(quickResultPath, '{}', 'utf-8');

            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Created result files in ${projectRoot}`);
        } catch (error) {
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Failed to create result files in ${projectRoot}`,
                error as Error,
            );
        }
    }

    /**
     * Delete result files after parsing
     */
    public static deleteResultFiles(projectRoot: string): void {
        try {
            const fullResultPath = path.join(projectRoot, this.FULL_RESULT_FILE);
            const quickResultPath = path.join(projectRoot, this.QUICK_RESULT_FILE);

            if (fs.existsSync(fullResultPath)) {
                fs.unlinkSync(fullResultPath);
            }

            if (fs.existsSync(quickResultPath)) {
                fs.unlinkSync(quickResultPath);
            }

            ExtensionOutputChannel.debug(
                this.LOG_SOURCE,
                `Deleted result files from ${projectRoot}`,
            );
        } catch (error) {
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Failed to delete result files from ${projectRoot}`,
                error as Error,
            );
        }
    }

    /**
     * Check if result files exist
     */
    public static resultFilesExist(projectRoot: string): boolean {
        const fullResultPath = path.join(projectRoot, this.FULL_RESULT_FILE);
        return fs.existsSync(fullResultPath);
    }
}
