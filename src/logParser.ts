import * as fs from 'fs';
import * as readline from 'readline';
import { ExtensionOutputChannel } from './extensionOutput';

/**
 * Test result from log file
 */
export interface TestResult {
    testCaseId: string;
    status: 'passed' | 'failed' | 'error';
    message?: string;
    timestamp?: string;
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

    /**
     * Parse log file for test results
     * @param logPath Path to the log file
     * @param testCaseIds List of test case IDs to look for
     * @returns Map of test case ID to test result
     */
    public static async parseLogFile(
        logPath: string,
        testCaseIds: string[]
    ): Promise<Map<string, TestResult>> {
        const results = new Map<string, TestResult>();

        try {
            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Parsing log file: ${logPath}`);

            // Read file line by line (efficient for large log files)
            const fileStream = fs.createReadStream(logPath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let currentTimestamp: string | undefined;

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
                        results.set(testCaseId, {
                            testCaseId,
                            status: 'passed',
                            timestamp: currentTimestamp
                        });
                        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Found PASSED: ${testCaseId}`);
                    }
                }

                // Check for failed test
                const failedMatch = this.TEST_FAILED_PATTERN.exec(line);
                if (failedMatch) {
                    const testCaseId = failedMatch[1];
                    if (testCaseIds.includes(testCaseId)) {
                        // Extract failure message (rest of the line after "failed")
                        const messageMatch = /failed,\s*(.+)/.exec(line);
                        const message = messageMatch ? messageMatch[1].trim() : 'Test failed';

                        results.set(testCaseId, {
                            testCaseId,
                            status: 'failed',
                            message,
                            timestamp: currentTimestamp
                        });
                        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Found FAILED: ${testCaseId} - ${message}`);
                    }
                }
            }

            ExtensionOutputChannel.info(
                this.LOG_SOURCE,
                `Parsed ${results.size} test result(s) from log file`
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

        while (Date.now() - startTime < timeoutMs) {
            const results = await this.parseLogFile(logPath, testCaseIds);

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
        const results = await this.parseLogFile(logPath, testCaseIds);
        ExtensionOutputChannel.warn(
            this.LOG_SOURCE,
            `Timeout waiting for test results. Found ${results.size}/${expectedCount} result(s)`
        );

        return results;
    }
}
