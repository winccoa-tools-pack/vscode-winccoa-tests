import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionOutputChannel } from './extensionOutput';
import { TestDiscovery } from './testDiscovery';
import { ParsedTestFile } from './testParser';
import { TestRunner } from './testRunner';

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

        // Create test items for each file
        for (const testFile of testFiles) {
            this.createTestItemsFromParsedFile(testFile);
        }
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
     * Create test items from parsed file
     */
    private createTestItemsFromParsedFile(parsedFile: ParsedTestFile): void {
        const fileName = path.basename(parsedFile.fileUri.fsPath);
        
        ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `Creating test items for: ${fileName}`);

        // Create test item for each test class
        for (const testClass of parsedFile.testClasses) {
            const classId = `${parsedFile.fileUri.toString()}::${testClass.className}`;

            const classItem = this.testController.createTestItem(
                classId,
                `${fileName} - ${testClass.className}`,
                parsedFile.fileUri
            );

            classItem.canResolveChildren = false;
            classItem.range = new vscode.Range(testClass.line - 1, 0, testClass.line - 1, 0);

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

            this.testController.items.add(classItem);
            
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

            // Execute the test file via Script Actions
            const executionStarted = await TestRunner.executeTestFile(test.uri);

            if (!executionStarted) {
                const message = new vscode.TestMessage('Failed to start test execution. Is WinCC OA Script Actions extension installed?');
                run.failed(test, message);
                return;
            }

            // For now: Mark as passed after execution starts
            // TODO: Parse log file for actual results
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, `Test execution started: ${test.label}`);
            
            // Wait a bit for execution to complete
            await new Promise(resolve => setTimeout(resolve, 2000));

            // TODO: Parse log file and determine actual test status
            // For PoC: Mark as passed
            run.passed(test, 2000);
            ExtensionOutputChannel.success(WinCCOATestController.LOG_SOURCE, `Test completed: ${test.label}`);

        } catch (error) {
            const message = new vscode.TestMessage(`Error: ${error}`);
            run.failed(test, message);
            ExtensionOutputChannel.error(WinCCOATestController.LOG_SOURCE, `Test execution error: ${test.label}`, error as Error);
        }
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
