import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionOutputChannel } from './extensionOutput';
import { TestDiscovery } from './testDiscovery';
import { ParsedTestFile } from './testParser';
import { TestRunner } from './testRunner';
import { JsonResultParser } from './jsonResultParser';
import { PathResolver } from './pathResolver';

/**
 * Main Test Controller for WinCC OA Tests
 * Integrates with VS Code Test Explorer API
 */
export class WinCCOATestController {
    private static readonly LOG_SOURCE = 'TestController';
    private testController: vscode.TestController;
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(
        private context: vscode.ExtensionContext
    ) {
        // Create Test Controller
        this.testController = vscode.tests.createTestController(
            'winccoaTestController',
            'WinCC OA Tests'
        );

        this.context.subscriptions.push(this.testController);

        // Set up test run handler
        this.testController.createRunProfile(
            'Run',
            vscode.TestRunProfileKind.Run,
            (request, token) => this.runTests(request, token),
            true
        );

        // Initial test discovery
        this.discoverTests();

        // Watch for file changes
        this.setupFileWatcher();
    }

    /**
     * Discover tests in workspace
     */
    private async discoverTests(): Promise<void> {
        ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Discovering WinCC OA test files...');

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            ExtensionOutputChannel.warn(WinCCOATestController.LOG_SOURCE, 'No workspace folder found');
            this.showNoWorkspaceMessage();
            return;
        }

        // Discover all test files
        const testFiles = await TestDiscovery.discoverTests();

        // Clear existing tests
        this.testController.items.replace([]);

        if (testFiles.length === 0) {
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'No test files found - showing placeholder');
            this.showNoTestsFoundMessage();
            return;
        }

        // Build hierarchical structure
        this.buildTestHierarchy(testFiles, workspaceFolders[0].uri.fsPath);
    }

    /**
     * Show message when no workspace is found
     */
    private showNoWorkspaceMessage(): void {
        const placeholderItem = this.testController.createTestItem(
            'no-workspace',
            '⚠️ No workspace folder open',
            undefined
        );
        placeholderItem.canResolveChildren = false;
        this.testController.items.replace([placeholderItem]);
    }

    /**
     * Show message when no tests are found
     */
    private showNoTestsFoundMessage(): void {
        const placeholderItem = this.testController.createTestItem(
            'no-tests',
            'ℹ️ No WinCC OA test files found (looking for "class X : OaTest" in */scripts/**/*.ctl)',
            undefined
        );
        placeholderItem.canResolveChildren = false;
        this.testController.items.replace([placeholderItem]);
    }

    /**
     * Build hierarchical test structure based on folder structure
     */
    private buildTestHierarchy(testFiles: ParsedTestFile[], workspaceRoot: string): void {
        // Group test files by directory
        const folderMap = new Map<string, ParsedTestFile[]>();

        for (const testFile of testFiles) {
            const relativePath = path.relative(workspaceRoot, testFile.fileUri.fsPath);
            const dirPath = path.dirname(relativePath);

            if (!folderMap.has(dirPath)) {
                folderMap.set(dirPath, []);
            }
            folderMap.get(dirPath)!.push(testFile);
        }

        // Create folder hierarchy
        const sortedDirs = Array.from(folderMap.keys()).sort();
        
        for (const dirPath of sortedDirs) {
            const files = folderMap.get(dirPath)!;
            
            // Get or create folder item
            const folderItem = this.getOrCreateFolderItem(dirPath, workspaceRoot);
            
            // Add test files to folder
            for (const testFile of files) {
                this.createTestItemsFromParsedFile(testFile, folderItem);
            }
        }

        ExtensionOutputChannel.success(
            WinCCOATestController.LOG_SOURCE,
            `Built test hierarchy with ${folderMap.size} folder(s)`
        );
    }

    /**
     * Get or create folder item for directory path
     */
    private getOrCreateFolderItem(dirPath: string, workspaceRoot: string): vscode.TestItem {
        const parts = dirPath.split(path.sep).filter(p => p.length > 0);
        let currentParent: vscode.TestItem | undefined = undefined;
        let currentPath = '';

        // Build folder hierarchy from root
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath = currentPath ? path.join(currentPath, part) : part;
            const folderId = `folder::${currentPath}`;

            let folderItem: vscode.TestItem | undefined;

            // Check if folder item already exists
            if (currentParent) {
                folderItem = currentParent.children.get(folderId);
            } else {
                folderItem = this.testController.items.get(folderId);
            }

            // Create folder item if it doesn't exist
            if (!folderItem) {
                folderItem = this.testController.createTestItem(
                    folderId,
                    part,
                    vscode.Uri.file(path.join(workspaceRoot, currentPath))
                );
                folderItem.canResolveChildren = false;

                if (currentParent) {
                    currentParent.children.add(folderItem);
                } else {
                    this.testController.items.add(folderItem);
                }
            }

            currentParent = folderItem;
        }

        return currentParent!;
    }

    /**
     * Create test items from parsed file
     */
    private createTestItemsFromParsedFile(parsedFile: ParsedTestFile, parentFolder: vscode.TestItem): void {
        const fileName = path.basename(parsedFile.fileUri.fsPath);
        
        ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `Creating test items for: ${fileName}`);

        // Create test item for each test class
        for (const testClass of parsedFile.testClasses) {
            const classId = `${parsedFile.fileUri.toString()}::${testClass.className}`;

            const classItem = this.testController.createTestItem(
                classId,
                `${testClass.className}`,
                parsedFile.fileUri
            );

            classItem.canResolveChildren = false;
            classItem.range = new vscode.Range(testClass.line - 1, 0, testClass.line - 1, 0);
            classItem.description = fileName;

            // Add test cases as children
            for (const testCase of testClass.testCases) {
                const testCaseId = `${classId}::${testCase.id}`;
                
                const testCaseItem = this.testController.createTestItem(
                    testCaseId,
                    testCase.id,
                    parsedFile.fileUri
                );

                if (testCase.line) {
                    testCaseItem.range = new vscode.Range(testCase.line - 1, 0, testCase.line - 1, 0);
                }

                classItem.children.add(testCaseItem);
            }

            parentFolder.children.add(classItem);
            
            ExtensionOutputChannel.debug(
                WinCCOATestController.LOG_SOURCE,
                `Added ${testClass.testCases.length} test case(s) for class: ${testClass.className}`
            );
        }
    }

    /**
     * Run tests
     */
    private async runTests(
        request: vscode.TestRunRequest,
        token: vscode.CancellationToken
    ): Promise<void> {
        const run = this.testController.createTestRun(request);
        const queue: vscode.TestItem[] = [];

        // Gather tests to run
        if (request.include) {
            request.include.forEach(test => queue.push(test));
        } else {
            this.testController.items.forEach(test => queue.push(test));
        }

        ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, `Running ${queue.length} test(s)...`);

        // Run each test
        for (const test of queue) {
            if (token.isCancellationRequested) {
                run.skipped(test);
                continue;
            }

            run.started(test);
            ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `Running: ${test.label}`);

            // For PoC: Simulate test execution
            await this.executeTest(test, run);
        }

        run.end();
    }

    /**
     * Execute a single test (real implementation)
     */
    private async executeTest(
        test: vscode.TestItem,
        run: vscode.TestRun
    ): Promise<void> {
        try {
            ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `Executing test: ${test.label}`);

            // Get the file URI from test item
            if (!test.uri) {
                ExtensionOutputChannel.error(WinCCOATestController.LOG_SOURCE, `Test has no URI: ${test.label}`);
                const message = new vscode.TestMessage('Test file URI not found');
                run.failed(test, message);
                return;
            }

            // Collect all test case IDs for this test run
            const testCaseIds: string[] = [];
            
            // Check if this is a test class or individual test case
            if (test.children.size > 0) {
                // Test class - get all child test cases
                test.children.forEach(child => {
                    testCaseIds.push(child.label);
                });
            } else {
                // Individual test case
                testCaseIds.push(test.label);
            }

            ExtensionOutputChannel.info(
                WinCCOATestController.LOG_SOURCE,
                `Executing ${testCaseIds.length} test case(s): ${testCaseIds.join(', ')}`
            );

            // Get project root directory (one level up from log directory)
            const logDir = await PathResolver.getLogPath();
            if (!logDir) {
                ExtensionOutputChannel.error(WinCCOATestController.LOG_SOURCE, 'Could not determine log directory path');
                const message = new vscode.TestMessage('Could not find log directory');
                run.failed(test, message);
                return;
            }

            const projectRoot = path.dirname(logDir);
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, `Project root: ${projectRoot}`);

            // Step 1: Delete old result files if they exist
            if (JsonResultParser.resultFilesExist(projectRoot)) {
                ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Deleting old result files...');
                JsonResultParser.deleteResultFiles(projectRoot);
            }

            // Step 2: Create empty result files
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Creating result files...');
            JsonResultParser.createResultFiles(projectRoot);

            // Step 3: Execute the test file via Script Actions
            const executionStarted = await TestRunner.executeTestFile(test.uri);

            if (!executionStarted) {
                JsonResultParser.deleteResultFiles(projectRoot);
                const message = new vscode.TestMessage('Failed to start test execution. Is WinCC OA Script Actions extension installed?');
                run.failed(test, message);
                return;
            }

            // Step 4: Wait a bit for test execution to complete and write results
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Waiting for test execution to complete...');
            await this.waitForTestCompletion(projectRoot, 10000);

            // Step 5: Parse JSON results
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Parsing test results...');
            const testResults = await JsonResultParser.parseResults(projectRoot, testCaseIds);

            // Step 6: Delete result files
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Cleaning up result files...');
            JsonResultParser.deleteResultFiles(projectRoot);

            // Process results for each test case
            if (test.children.size > 0) {
                // Test class - mark each child individually
                test.children.forEach(child => {
                    const result = testResults.get(child.label);
                    
                    if (result) {
                        this.processTestResult(child, result, run);
                    } else {
                        // No result found - mark as failed
                        const message = new vscode.TestMessage('No test result found in JSON output');
                        run.failed(child, message);
                        ExtensionOutputChannel.warn(WinCCOATestController.LOG_SOURCE, `? ${child.label} - no result found`);
                    }
                });
            } else {
                // Individual test case
                const result = testResults.get(test.label);
                
                if (result) {
                    this.processTestResult(test, result, run);
                } else {
                    // No result found - mark as failed
                    const message = new vscode.TestMessage('No test result found in JSON output');
                    run.failed(test, message);
                    ExtensionOutputChannel.warn(WinCCOATestController.LOG_SOURCE, `? ${test.label} - no result found`);
                }
            }

        } catch (error) {
            const message = new vscode.TestMessage(`Error: ${error}`);
            run.failed(test, message);
            ExtensionOutputChannel.error(WinCCOATestController.LOG_SOURCE, `Test execution error: ${test.label}`, error as Error);
        }
    }

    /**
     * Wait for test completion by polling the result files
     */
    private async waitForTestCompletion(projectRoot: string, timeoutMs: number): Promise<void> {
        const startTime = Date.now();
        const pollInterval = 500; // Check every 500ms

        while (Date.now() - startTime < timeoutMs) {
            // Check if fullResult.json has content (not just {})
            try {
                const fs = await import('fs');
                const fullResultPath = require('path').join(projectRoot, 'fullResult.json');
                
                if (fs.existsSync(fullResultPath)) {
                    const content = fs.readFileSync(fullResultPath, 'utf-8');
                    const parsed = JSON.parse(content);
                    
                    // Check if we have actual test results (TestCases array exists and has data)
                    if (parsed.TestCases && parsed.TestCases.length > 0) {
                        ExtensionOutputChannel.debug(
                            WinCCOATestController.LOG_SOURCE,
                            `Test results ready after ${Date.now() - startTime}ms`
                        );
                        return;
                    }
                }
            } catch (error) {
                // Ignore parsing errors, file might be incomplete
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        ExtensionOutputChannel.warn(
            WinCCOATestController.LOG_SOURCE,
            `Timeout waiting for test results after ${timeoutMs}ms`
        );
    }

    /**
     * Process test result from JSON parser
     */
    private processTestResult(
        testItem: vscode.TestItem,
        result: { testId: string; status: string; message: string; duration: number; assertions: any[] },
        run: vscode.TestRun
    ): void {
        const durationMs = Math.round(result.duration * 1000);

        if (result.status === 'passed') {
            run.passed(testItem, durationMs);
            ExtensionOutputChannel.success(
                WinCCOATestController.LOG_SOURCE,
                `✓ ${testItem.label} passed (${durationMs}ms)`
            );
        } else if (result.status === 'failed') {
            // Create individual messages for each failed/aborted assertion
            const messages = this.createJsonTestMessages(result);
            
            // Add all messages to the test result
            for (const message of messages) {
                run.failed(testItem, message, durationMs);
            }
            
            ExtensionOutputChannel.error(
                WinCCOATestController.LOG_SOURCE,
                `✗ ${testItem.label} failed: ${result.message}`
            );
        } else if (result.status === 'aborted') {
            // Create individual messages for each failed/aborted assertion
            const messages = this.createJsonTestMessages(result);
            
            // Add all messages to the test result
            for (const message of messages) {
                run.errored(testItem, message, durationMs);
            }
            
            ExtensionOutputChannel.error(
                WinCCOATestController.LOG_SOURCE,
                `⚠ ${testItem.label} aborted: ${result.message}`
            );
        }
    }

    /**
     * Create individual test messages for each failed/aborted assertion
     */
    private createJsonTestMessages(result: {
        message: string;
        assertions: Array<{
            status: string;
            message: string;
            stackTrace?: vscode.TestMessage[];
            location?: vscode.Location;
        }>;
    }): vscode.TestMessage[] {
        const messages: vscode.TestMessage[] = [];

        // Create a message for each failed or aborted assertion
        for (const assertion of result.assertions) {
            if (assertion.status === 'failed' || assertion.status === 'aborted') {
                const message = new vscode.TestMessage(assertion.message);
                
                if (assertion.location) {
                    message.location = assertion.location;
                    
                    ExtensionOutputChannel.debug(
                        WinCCOATestController.LOG_SOURCE,
                        `Created ${assertion.status} message at ${assertion.location.uri.fsPath}:${assertion.location.range.start.line + 1}: ${assertion.message.substring(0, 50)}...`
                    );
                }
                
                messages.push(message);
            }
        }

        // If no failed/aborted assertions found, create one message with overall result
        if (messages.length === 0) {
            const message = new vscode.TestMessage(result.message);
            
            // Try to find any assertion with a location
            for (const assertion of result.assertions) {
                if (assertion.location) {
                    message.location = assertion.location;
                    break;
                }
            }
            
            messages.push(message);
        }

        return messages;
    }

    /**
     * Setup file watcher for test files
     */
    private setupFileWatcher(): void {
        // Watch for .ctl files in scripts folders
        const pattern = 'scripts/**/*.ctl';

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidCreate(() => this.discoverTests());
        this.fileWatcher.onDidChange(() => this.discoverTests());
        this.fileWatcher.onDidDelete(() => this.discoverTests());

        this.context.subscriptions.push(this.fileWatcher);
        
        ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `File watcher active for pattern: ${pattern}`);
    }

    /**
     * Refresh tests manually
     */
    public refreshTests(): void {
        this.discoverTests();
    }

    /**
     * Run all tests
     */
    public runAllTests(): void {
        const request = new vscode.TestRunRequest();
        this.testController.createTestRun(request);
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.testController.dispose();
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }
}
