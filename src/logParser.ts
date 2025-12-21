import * as fs from 'fs';
import * as readline from 'readline';
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
 * Test result from log file
 */
export interface TestResult {
    testCaseId: string;
    status: 'passed' | 'failed' | 'error';
    message?: string;
    timestamp?: string;
    stackTrace?: StackTraceLocation;
    fullStackTrace?: StackTraceLocation[];
    note?: string;
}

/**
 * Parser for WinCC OA log files to extract test results
 */
export class LogParser {
    private static readonly LOG_SOURCE = 'LogParser';

    // Regex patterns for test results
    private static readonly TEST_PASSED_PATTERN = /\(OK\) Testcase '([^']+)' passed/;
    private static readonly TEST_FAILED_PATTERN = /\(FAILED\) Testcase '([^']+)' failed/;
    private static readonly TIMESTAMP_PATTERN = /^WCCOActrl.*?(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}\.\d{3})/;
    // Pattern to match stack trace: "\t<function> at <filepath>:<line>"
    private static readonly STACKTRACE_PATTERN = /^\t(.+?)\s+at\s+(.+?):(\d+)/;
    
    // Store last file position to avoid re-parsing entire file
    private static lastFilePosition: number = 0;

    /**
     * Parse log file for test results
     * @param logPath Path to the log file
     * @param testCaseIds List of test case IDs to look for
     * @param fromPosition Optional file position to start reading from (default: 0)
     * @returns Map of test case ID to test result
     */
    public static async parseLogFile(
        logPath: string,
        testCaseIds: string[],
        fromPosition: number = 0
    ): Promise<Map<string, TestResult>> {
        const results = new Map<string, TestResult>();

        try {
            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Parsing log file from position ${fromPosition}: ${logPath}`);

            // Get file stats to determine file size
            const stats = fs.statSync(logPath);
            const fileSize = stats.size;

            // If fromPosition is beyond file size, reset to beginning
            if (fromPosition >= fileSize) {
                ExtensionOutputChannel.debug(this.LOG_SOURCE, `File position ${fromPosition} >= file size ${fileSize}, resetting to 0`);
                fromPosition = 0;
            }

            // Read file line by line starting from specified position
            const fileStream = fs.createReadStream(logPath, { start: fromPosition });
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let currentTimestamp: string | undefined;
            let currentTestCaseId: string | undefined;
            let collectingStackTrace = false;
            let collectingNote = false;
            let currentNote = '';

            for await (const line of rl) {
                // Extract timestamp
                const timestampMatch = this.TIMESTAMP_PATTERN.exec(line);
                if (timestampMatch) {
                    currentTimestamp = timestampMatch[1];
                }

                // Check for passed test
                const passedMatch = this.TEST_PASSED_PATTERN.exec(line);
                if (passedMatch) {
                    const testCaseId = passedMatch[1];
                    if (testCaseIds.includes(testCaseId)) {
                        // Always update result - keep the latest occurrence
                        results.set(testCaseId, {
                            testCaseId,
                            status: 'passed',
                            timestamp: currentTimestamp
                        });
                        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Found PASSED: ${testCaseId}`);
                    }
                    // Stop collecting stack trace if this test passed
                    if (collectingStackTrace && currentTestCaseId === testCaseId) {
                        collectingStackTrace = false;
                        collectingNote = false;
                        currentTestCaseId = undefined;
                        currentNote = '';
                    }
                    continue;
                }

                // Check for failed test
                const failedMatch = this.TEST_FAILED_PATTERN.exec(line);
                if (failedMatch) {
                    const testCaseId = failedMatch[1];
                    if (testCaseIds.includes(testCaseId)) {
                        // Extract failure message (rest of the line after "failed")
                        const messageMatch = /failed,\s*(.+)/.exec(line);
                        const message = messageMatch ? messageMatch[1].trim() : 'Test failed';

                        // Always update result - keep the latest occurrence
                        results.set(testCaseId, {
                            testCaseId,
                            status: 'failed',
                            message,
                            timestamp: currentTimestamp,
                            fullStackTrace: []
                        });
                        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Found FAILED: ${testCaseId} - ${message}`);
                        
                        // Start collecting stack trace for this failed test
                        currentTestCaseId = testCaseId;
                        collectingStackTrace = true;
                        collectingNote = false;
                        currentNote = '';
                    }
                    continue;
                }

                // Check for Note line
                if (collectingStackTrace && currentTestCaseId && line.trim().startsWith('Note:')) {
                    collectingNote = true;
                    // Extract note text after "Note:"
                    const noteMatch = /Note:\s*(.+)/.exec(line);
                    if (noteMatch) {
                        currentNote = noteMatch[1].trim();
                    }
                    continue;
                }

                // Skip StackTrace header line
                if (collectingStackTrace && currentTestCaseId && line.includes('StackTrace:')) {
                    collectingNote = false;
                    continue;
                }

                // Check for stack trace (only if we're collecting for a failed test)
                if (collectingStackTrace && currentTestCaseId && !collectingNote) {
                    const stackTraceMatch = this.STACKTRACE_PATTERN.exec(line);
                    if (stackTraceMatch) {
                        const functionName = stackTraceMatch[1].trim();
                        const filePath = stackTraceMatch[2];
                        const lineNumber = parseInt(stackTraceMatch[3], 10);

                        ExtensionOutputChannel.debug(
                            this.LOG_SOURCE,
                            `Found stack trace: ${functionName} at ${filePath}:${lineNumber}`
                        );

                        const result = results.get(currentTestCaseId);
                        if (result) {
                            // Initialize fullStackTrace if not exists
                            if (!result.fullStackTrace) {
                                result.fullStackTrace = [];
                            }

                            // Add to full stack trace
                            result.fullStackTrace.push({
                                functionName,
                                filePath,
                                line: lineNumber
                            });

                            // Set the first one as the primary stack trace (failure location)
                            if (!result.stackTrace) {
                                result.stackTrace = {
                                    functionName,
                                    filePath,
                                    line: lineNumber
                                };
                                ExtensionOutputChannel.success(
                                    this.LOG_SOURCE,
                                    `Added stack trace for ${currentTestCaseId}: ${filePath}:${lineNumber}`
                                );
                            }

                            // Add note if we have one
                            if (currentNote && !result.note) {
                                result.note = currentNote;
                            }
                        }
                    } else if (line.trim() !== '' && !line.startsWith('\t') && !line.startsWith('  ')) {
                        // End of stack trace section (non-indented line)
                        collectingStackTrace = false;
                        collectingNote = false;
                        currentTestCaseId = undefined;
                        currentNote = '';
                    }
                }
            }

            // Update last file position for next read
            this.lastFilePosition = fileSize;

            ExtensionOutputChannel.info(
                this.LOG_SOURCE,
                `Parsed ${results.size} test result(s) from log file (read from ${fromPosition} to ${fileSize})`
            );

        } catch (error) {
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Failed to parse log file: ${logPath}`,
                error as Error
            );
        }

        return results;
    }

    /**
     * Wait for test results to appear in log file
     * Polls the log file for a specified duration
     * 
     * @param logPath Path to the log file
     * @param testCaseIds List of test case IDs to look for
     * @param timeoutMs Maximum time to wait in milliseconds
     * @param pollIntervalMs Interval between polls in milliseconds
     * @returns Map of test case ID to test result
     */
    public static async waitForTestResults(
        logPath: string,
        testCaseIds: string[],
        timeoutMs: number = 10000,
        pollIntervalMs: number = 500
    ): Promise<Map<string, TestResult>> {
        const startTime = Date.now();
        const expectedCount = testCaseIds.length;

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Waiting for ${expectedCount} test result(s) in log file (timeout: ${timeoutMs}ms)`
        );

        // Get initial file size to start reading from
        let initialSize = 0;
        try {
            const stats = fs.statSync(logPath);
            initialSize = stats.size;
            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Initial log file size: ${initialSize} bytes`);
        } catch (error) {
            ExtensionOutputChannel.warn(this.LOG_SOURCE, `Could not get initial file size: ${error}`);
        }

        // Store the starting position
        const startPosition = initialSize;

        while (Date.now() - startTime < timeoutMs) {
            // Only parse from our starting position onwards
            const results = await this.parseLogFile(logPath, testCaseIds, startPosition);

            // Check if we found all expected results
            if (results.size === expectedCount) {
                ExtensionOutputChannel.success(
                    this.LOG_SOURCE,
                    `All ${expectedCount} test result(s) found`
                );
                return results;
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        }

        // Timeout - return whatever we found
        const results = await this.parseLogFile(logPath, testCaseIds, startPosition);
        ExtensionOutputChannel.warn(
            this.LOG_SOURCE,
            `Timeout waiting for test results. Found ${results.size}/${expectedCount} result(s)`
        );

        return results;
    }

    /**
     * Reset the last file position (useful for testing or when starting fresh)
     */
    public static resetFilePosition(): void {
        this.lastFilePosition = 0;
        ExtensionOutputChannel.debug(this.LOG_SOURCE, 'Reset file position to 0');
    }
}
