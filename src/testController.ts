import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Main Test Controller for WinCC OA Tests
 * Integrates with VS Code Test Explorer API
 */
export class WinCCOATestController {
    private testController: vscode.TestController;
    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(
        private context: vscode.ExtensionContext,
        private outputChannel: vscode.OutputChannel
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
        this.outputChannel.appendLine('Discovering WinCC OA test files...');

        const config = vscode.workspace.getConfiguration('winccoaTests');
        const pattern = config.get<string>('testFilesPattern', '**/*_test.ctl');

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this.outputChannel.appendLine('No workspace folder found');
            return;
        }

        // Find all test files
        const files = await vscode.workspace.findFiles(pattern);
        this.outputChannel.appendLine(`Found ${files.length} test file(s)`);

        // Clear existing tests
        this.testController.items.replace([]);

        // Create test items for each file
        for (const fileUri of files) {
            await this.createTestItemFromFile(fileUri);
        }
    }

    /**
     * Create test item from file
     */
    private async createTestItemFromFile(fileUri: vscode.Uri): Promise<void> {
        const fileName = path.basename(fileUri.fsPath);
        const testId = fileUri.toString();

        this.outputChannel.appendLine(`Creating test item for: ${fileName}`);

        // Create a test item for the file
        const testItem = this.testController.createTestItem(
            testId,
            fileName,
            fileUri
        );

        testItem.canResolveChildren = true;

        // For PoC: Add a dummy test function
        const dummyTest = this.testController.createTestItem(
            `${testId}::testExample`,
            'testExample()',
            fileUri
        );
        dummyTest.range = new vscode.Range(0, 0, 0, 0);

        testItem.children.replace([dummyTest]);
        this.testController.items.add(testItem);
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

        this.outputChannel.appendLine(`Running ${queue.length} test(s)...`);

        // Run each test
        for (const test of queue) {
            if (token.isCancellationRequested) {
                run.skipped(test);
                continue;
            }

            run.started(test);
            this.outputChannel.appendLine(`Running: ${test.label}`);

            // For PoC: Simulate test execution
            await this.executeTest(test, run);
        }

        run.end();
    }

    /**
     * Execute a single test (PoC implementation)
     */
    private async executeTest(
        test: vscode.TestItem,
        run: vscode.TestRun
    ): Promise<void> {
        try {
            // Simulate test execution
            await new Promise(resolve => setTimeout(resolve, 500));

            // For PoC: Randomly pass or fail
            const passed = Math.random() > 0.3;

            if (passed) {
                run.passed(test, 500);
                this.outputChannel.appendLine(`✓ ${test.label} passed`);
            } else {
                const message = new vscode.TestMessage('Test failed: Example assertion error');
                message.location = new vscode.Location(test.uri!, new vscode.Range(0, 0, 0, 0));
                run.failed(test, message, 500);
                this.outputChannel.appendLine(`✗ ${test.label} failed`);
            }
        } catch (error) {
            const message = new vscode.TestMessage(`Error: ${error}`);
            run.failed(test, message);
            this.outputChannel.appendLine(`✗ ${test.label} error: ${error}`);
        }
    }

    /**
     * Setup file watcher for test files
     */
    private setupFileWatcher(): void {
        const config = vscode.workspace.getConfiguration('winccoaTests');
        const pattern = config.get<string>('testFilesPattern', '**/*_test.ctl');

        this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.fileWatcher.onDidCreate(() => this.discoverTests());
        this.fileWatcher.onDidChange(() => this.discoverTests());
        this.fileWatcher.onDidDelete(() => this.discoverTests());

        this.context.subscriptions.push(this.fileWatcher);
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
