import * as fs from 'fs';
import { ExtensionOutputChannel } from './extensionOutput';

/**
 * Stack trace location
 */
export interface StackTraceLocation {
    filePath: string;
    line: number;
    functionName: string;
}

/**
 * Single assertion result within a test case
 */
export interface AssertionResult {
    type: 'passed' | 'failed' | 'aborted';
    message: string;
    note?: string;
    errorMessage?: string;
    stackTrace: StackTraceLocation[];
    scriptPath?: string;
    libraryPath?: string;
    line?: number;
    timestamp?: string;
}

/**
 * Complete result for a single test case
 */
export interface TestCaseResult {
    testCaseId: string;
    status: 'passed' | 'failed' | 'aborted';
    startTimestamp?: string;
    endTimestamp?: string;
    assertions: AssertionResult[];
}

/**
 * Complete test run result
 */
export interface TestRunResult {
    testCases: Map<string, TestCaseResult>;
    summary: {
        passed: number;
        failed: number;
        aborted: number;
    };
}

/**
 * Advanced parser for WinCC OA log files
 * Parses from bottom-up to identify test run boundaries
 */
export class TestRunParser {
    private static readonly LOG_SOURCE = 'TestRunParser';

    // Regex patterns
    private static readonly TIMESTAMP_PATTERN = /^WCCOActrl\s+\(\d+\),\s+(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}\.\d{3})/;
    private static readonly TEST_START_PATTERN = /\(INFO\) Testcase '([^']+)' write message:/;
    private static readonly TEST_START_NOTE = /Note:\s*Start the test case/;
    private static readonly TEST_PASSED_PATTERN = /\(OK\) Testcase '([^']+)' passed/;
    private static readonly TEST_FAILED_PATTERN = /\(FAILED\) Testcase '([^']+)' failed/;
    private static readonly TEST_ABORTED_PATTERN = /\(ABORTED\) Testcase '([^']+)' aborted/;
    private static readonly NOTE_PATTERN = /^\s+Note:\s*(.+)/;
    private static readonly ERRMSG_PATTERN = /^\s+ErrMsg:\s*(.+)/;
    private static readonly STACKTRACE_PATTERN = /^\t(.+?)\s+at\s+(.+?):(\d+)/;
    private static readonly SCRIPT_PATTERN = /^\s+Script:\s*(.+)/;
    private static readonly LIBRARY_PATTERN = /^\s+Library:\s*(.+)/;
    private static readonly LINE_PATTERN = /^\s+Line:\s*(\d+)/;

    /**
     * Parse log file for test results by reading from the end
     * @param logPath Path to the log file
     * @param testCaseIds List of test case IDs to look for
     * @param startTime Optional: timestamp when test execution started (to filter old runs)
     * @returns Test run result with all test cases
     */
    public static async parseTestRun(
        logPath: string,
        testCaseIds: string[],
        startTime?: Date
    ): Promise<TestRunResult> {
        const testCases = new Map<string, TestCaseResult>();

        try {
            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Parsing test run for ${testCaseIds.length} test case(s)`);

            // Read entire file (we'll optimize this later if needed)
            const content = fs.readFileSync(logPath, 'utf-8');
            const lines = content.split('\n');

            // Parse backwards to find test blocks
            const testBlocks = this.extractTestBlocks(lines, testCaseIds, startTime);

            // Parse each test block
            for (const block of testBlocks) {
                const testCase = this.parseTestBlock(block);
                if (testCase) {
                    testCases.set(testCase.testCaseId, testCase);
                }
            }

            // Calculate summary
            const summary = {
                passed: 0,
                failed: 0,
                aborted: 0
            };

            for (const testCase of testCases.values()) {
                if (testCase.status === 'passed') {
                    summary.passed++;
                } else if (testCase.status === 'failed') {
                    summary.failed++;
                } else if (testCase.status === 'aborted') {
                    summary.aborted++;
                }
            }

            ExtensionOutputChannel.success(
                this.LOG_SOURCE,
                `Parsed ${testCases.size} test case(s): ${summary.passed} passed, ${summary.failed} failed, ${summary.aborted} aborted`
            );

            return { testCases, summary };

        } catch (error) {
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Failed to parse test run: ${logPath}`,
                error as Error
            );
            return { testCases, summary: { passed: 0, failed: 0, aborted: 0 } };
        }
    }

    /**
     * Extract test blocks from log lines
     * Returns array of line arrays, each representing one test case
     */
    private static extractTestBlocks(
        lines: string[],
        testCaseIds: string[],
        startTime?: Date
    ): string[][] {
        const blocks: string[][] = [];
        let currentBlock: string[] = [];
        let currentTestId: string | undefined;
        let inTestBlock = false;

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Extracting test blocks for IDs: ${testCaseIds.join(', ')}`
        );

        // Process from end to beginning
        // Strategy: Collect all lines into currentBlock, when we hit a test start marker, save it
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];

            // Check if this is a test start marker
            const startMatch = this.TEST_START_PATTERN.exec(line);
            if (startMatch) {
                const testId = startMatch[1];
                
                // Check next line for "Note: Start the test case"
                const hasStartNote = i + 1 < lines.length && this.TEST_START_NOTE.test(lines[i + 1]);
                
                ExtensionOutputChannel.debug(
                    this.LOG_SOURCE,
                    `Found test start marker for '${testId}' at line ${i}, hasStartNote: ${hasStartNote}`
                );

                if (hasStartNote) {
                    // If this test is in our list, save the block
                    if (testCaseIds.includes(testId)) {
                        // Build the final block in correct order:
                        // 1. Start marker line (INFO Testcase...)
                        // 2. Note line
                        // 3. Rest of the block (currently in reverse order)
                        const finalBlock = [
                            line,           // (INFO) Testcase 'xxx' write message:
                            lines[i + 1],   // Note: Start the test case
                            ...currentBlock.reverse()  // Rest of the block in correct order
                        ];
                        blocks.push(finalBlock);
                        ExtensionOutputChannel.debug(
                            this.LOG_SOURCE,
                            `Saved block for '${testId}' with ${finalBlock.length} lines`
                        );
                    }

                    // Reset for next block (going backward)
                    currentTestId = testId;
                    currentBlock = [];
                    inTestBlock = false;

                    continue;
                }
            }

            // Add all lines to current block (we're collecting everything)
            currentBlock.push(line);
        }

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Extracted ${blocks.length} test block(s) from ${lines.length} log lines`
        );

        return blocks;
    }

    /**
     * Parse a single test block to extract all assertions
     */
    private static parseTestBlock(lines: string[]): TestCaseResult | null {
        if (lines.length === 0) {
            return null;
        }

        // Extract test case ID from first line
        const startMatch = this.TEST_START_PATTERN.exec(lines[0]);
        if (!startMatch) {
            ExtensionOutputChannel.warn(this.LOG_SOURCE, `No start match in first line: ${lines[0]}`);
            return null;
        }

        const testCaseId = startMatch[1];
        const assertions: AssertionResult[] = [];
        let startTimestamp: string | undefined;
        let endTimestamp: string | undefined;

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Parsing test block for '${testCaseId}' with ${lines.length} lines`
        );

        // Extract start timestamp from first line
        const firstTimestampMatch = this.TIMESTAMP_PATTERN.exec(lines[0]);
        if (firstTimestampMatch) {
            startTimestamp = firstTimestampMatch[1];
        }

        // Parse all assertions in the block
        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            // Check for passed assertion
            const passedMatch = this.TEST_PASSED_PATTERN.exec(line);
            if (passedMatch && passedMatch[1] === testCaseId) {
                const assertion = this.parseAssertion(lines, i, 'passed');
                if (assertion) {
                    assertions.push(assertion);
                    endTimestamp = assertion.timestamp;
                }
                i++;
                continue;
            }

            // Check for failed assertion
            const failedMatch = this.TEST_FAILED_PATTERN.exec(line);
            if (failedMatch && failedMatch[1] === testCaseId) {
                const assertion = this.parseAssertion(lines, i, 'failed');
                if (assertion) {
                    assertions.push(assertion);
                    endTimestamp = assertion.timestamp;
                }
                i++;
                continue;
            }

            // Check for aborted assertion
            const abortedMatch = this.TEST_ABORTED_PATTERN.exec(line);
            if (abortedMatch && abortedMatch[1] === testCaseId) {
                const assertion = this.parseAssertion(lines, i, 'aborted');
                if (assertion) {
                    assertions.push(assertion);
                    endTimestamp = assertion.timestamp;
                }
                i++;
                continue;
            }

            i++;
        }

        // Determine final status
        let status: 'passed' | 'failed' | 'aborted' = 'passed';
        if (assertions.some(a => a.type === 'aborted')) {
            status = 'aborted';
        } else if (assertions.some(a => a.type === 'failed')) {
            status = 'failed';
        }

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Parsed test '${testCaseId}': ${assertions.length} assertion(s), status: ${status}`
        );

        return {
            testCaseId,
            status,
            startTimestamp,
            endTimestamp,
            assertions
        };
    }

    /**
     * Parse a single assertion (OK/FAILED/ABORTED) with all its details
     */
    private static parseAssertion(
        lines: string[],
        startIndex: number,
        type: 'passed' | 'failed' | 'aborted'
    ): AssertionResult | null {
        const line = lines[startIndex];

        // Extract timestamp
        const timestampMatch = this.TIMESTAMP_PATTERN.exec(line);
        const timestamp = timestampMatch ? timestampMatch[1] : undefined;

        // Extract message (everything after "passed," or "failed," or "aborted,")
        let message = '';
        const messageMatch = /(passed|failed|aborted),\s*(.+)/.exec(line);
        if (messageMatch) {
            message = messageMatch[2].trim();
        }

        // Parse following lines for details
        let note: string | undefined;
        let errorMessage: string | undefined;
        const stackTrace: StackTraceLocation[] = [];
        let scriptPath: string | undefined;
        let libraryPath: string | undefined;
        let lineNumber: number | undefined;

        let i = startIndex + 1;
        while (i < lines.length) {
            const currentLine = lines[i];

            // Check if we've reached the next assertion or test
            if (this.TEST_PASSED_PATTERN.test(currentLine) ||
                this.TEST_FAILED_PATTERN.test(currentLine) ||
                this.TEST_ABORTED_PATTERN.test(currentLine) ||
                this.TEST_START_PATTERN.test(currentLine)) {
                break;
            }

            // Parse Note
            const noteMatch = this.NOTE_PATTERN.exec(currentLine);
            if (noteMatch) {
                note = noteMatch[1].trim();
                i++;
                continue;
            }

            // Parse ErrMsg
            const errMsgMatch = this.ERRMSG_PATTERN.exec(currentLine);
            if (errMsgMatch) {
                errorMessage = errMsgMatch[1].trim();
                i++;
                continue;
            }

            // Parse StackTrace entry
            const stackMatch = this.STACKTRACE_PATTERN.exec(currentLine);
            if (stackMatch) {
                stackTrace.push({
                    functionName: stackMatch[1].trim(),
                    filePath: stackMatch[2],
                    line: parseInt(stackMatch[3], 10)
                });
                i++;
                continue;
            }

            // Parse Script path
            const scriptMatch = this.SCRIPT_PATTERN.exec(currentLine);
            if (scriptMatch) {
                scriptPath = scriptMatch[1].trim();
                i++;
                continue;
            }

            // Parse Library path
            const libraryMatch = this.LIBRARY_PATTERN.exec(currentLine);
            if (libraryMatch) {
                libraryPath = libraryMatch[1].trim();
                i++;
                continue;
            }

            // Parse Line number
            const lineMatch = this.LINE_PATTERN.exec(currentLine);
            if (lineMatch) {
                lineNumber = parseInt(lineMatch[1], 10);
                i++;
                continue;
            }

            // Empty line or unrecognized - continue
            if (currentLine.trim() === '' || currentLine.startsWith('\t') || currentLine.startsWith('  ')) {
                i++;
                continue;
            }

            // Non-indented line that's not empty - end of assertion details
            break;
        }

        return {
            type,
            message,
            note,
            errorMessage,
            stackTrace,
            scriptPath,
            libraryPath,
            line: lineNumber,
            timestamp
        };
    }
}
