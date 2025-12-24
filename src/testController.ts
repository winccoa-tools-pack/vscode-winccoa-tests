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
    private fileWatchers: vscode.FileSystemWatcher[] = [];
    
    // Test execution queue to prevent parallel runs interfering with shared JSON files
    private testQueue: Promise<void> = Promise.resolve();
    private isTestRunning: boolean = false;

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
        this.buildTestHierarchy(testFiles);
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
     * Shows project folder as root, preserves directory structure inside scripts/
     */
    private buildTestHierarchy(testFiles: ParsedTestFile[]): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        // Group test files by project folder (one level above scripts)
        const projectFolderMap = new Map<string, Map<string, ParsedTestFile[]>>();

        for (const testFile of testFiles) {
            // Find which workspace folder this file belongs to
            const workspaceFolder = workspaceFolders.find(folder => 
                testFile.fileUri.fsPath.startsWith(folder.uri.fsPath)
            );

            if (!workspaceFolder) {
                ExtensionOutputChannel.warn(
                    WinCCOATestController.LOG_SOURCE,
                    `Could not find workspace folder for: ${testFile.fileUri.fsPath}`
                );
                continue;
            }
            
            // Extract project folder (one level above scripts)
            const projectFolder = this.extractProjectFolder(testFile.fileUri.fsPath, workspaceFolder.uri.fsPath);
            
            // Get or create folder map for this project
            if (!projectFolderMap.has(projectFolder)) {
                projectFolderMap.set(projectFolder, new Map<string, ParsedTestFile[]>());
            }
            const folderMap = projectFolderMap.get(projectFolder)!;

            // Extract path relative to project folder (includes scripts/)
            const projectRelativePath = this.getPathRelativeToProject(testFile.fileUri.fsPath, projectFolder);
            
            if (!folderMap.has(projectRelativePath)) {
                folderMap.set(projectRelativePath, []);
            }
            folderMap.get(projectRelativePath)!.push(testFile);
        }

        // Create test hierarchy grouped by project folder
        let totalProjects = 0;
        for (const [projectFolder, folderMap] of projectFolderMap) {
            const projectName = path.basename(projectFolder);
            const projectId = `project::${projectFolder}`;
            
            let projectItem = this.testController.items.get(projectId);
            
            if (!projectItem) {
                projectItem = this.testController.createTestItem(
                    projectId,
                    projectName,
                    vscode.Uri.file(projectFolder)
                );
                projectItem.canResolveChildren = false;
                this.testController.items.add(projectItem);
            }

            // Build folder hierarchy inside scripts/
            const sortedDirs = Array.from(folderMap.keys()).sort();
            
            for (const dirPath of sortedDirs) {
                const files = folderMap.get(dirPath)!;
                
                // Get or create folder item (relative to scripts, under project item)
                const folderItem = this.getOrCreateFolderItemInProject(dirPath, projectFolder, projectName, projectItem);
                
                // Add test files to folder
                for (const testFile of files) {
                    this.createTestItemsFromParsedFile(testFile, folderItem);
                }
            }
            
            totalProjects++;
        }

        ExtensionOutputChannel.success(
            WinCCOATestController.LOG_SOURCE,
            `Built test hierarchy with ${totalProjects} project folder(s)`
        );
    }

    /**
     * Extract project folder path (one level above 'scripts')
     * Example: /workspace/MyProject/scripts/tests/file.ctl -> /workspace/MyProject
     */
    private extractProjectFolder(filePath: string, workspaceRoot: string): string {
        // Find scripts folder in path
        const scriptsIndex = filePath.indexOf(path.sep + 'scripts' + path.sep);
        
        if (scriptsIndex === -1) {
            // Fallback: use workspace root if scripts not found
            ExtensionOutputChannel.warn(
                WinCCOATestController.LOG_SOURCE,
                `Could not find 'scripts' folder in path: ${filePath}`
            );
            return workspaceRoot;
        }

        // Return path up to (but not including) scripts
        return filePath.substring(0, scriptsIndex);
    }

    /**
     * Get path relative to project folder (includes scripts/ and all subfolders)
     * Example: /workspace/MyProject/scripts/tests/unit/file.ctl -> scripts/tests/unit
     */
    private getPathRelativeToProject(filePath: string, projectFolder: string): string {
        const relativePath = path.relative(projectFolder, filePath);
        const dirPath = path.dirname(relativePath);
        
        // Return empty string if file is directly in project folder, otherwise return the directory path
        return dirPath === '.' ? '' : dirPath;
    }

    /**
     * Get or create folder item for directory path inside scripts/
     */
    private getOrCreateFolderItemInProject(
        dirPath: string, 
        projectFolder: string, 
        projectName: string,
        projectItem: vscode.TestItem
    ): vscode.TestItem {
        // If empty path (file directly in scripts/), return project item
        if (!dirPath || dirPath === '') {
            return projectItem;
        }

        const parts = dirPath.split(path.sep).filter(p => p.length > 0);
        let currentParent: vscode.TestItem = projectItem;
        let currentPath = '';

        // Build folder hierarchy from scripts/ root
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            currentPath = currentPath ? path.join(currentPath, part) : part;
            const folderId = `folder::${projectName}::${currentPath}`;

            let folderItem = currentParent.children.get(folderId);

            // Create folder item if it doesn't exist
            if (!folderItem) {
                const fullPath = path.join(projectFolder, 'scripts', currentPath);
                folderItem = this.testController.createTestItem(
                    folderId,
                    part,
                    vscode.Uri.file(fullPath)
                );
                folderItem.canResolveChildren = false;
                currentParent.children.add(folderItem);
            }

            currentParent = folderItem;
        }

        return currentParent;
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

        // Gather tests to run - recursively collect all test items
        if (request.include) {
            request.include.forEach(test => this.collectTestItems(test, queue));
        } else {
            this.testController.items.forEach(test => this.collectTestItems(test, queue));
        }

        ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, `Running ${queue.length} test(s)...`);

        // Queue the test execution to prevent parallel runs
        this.testQueue = this.testQueue.then(async () => {
            // Check if another test is already running
            if (this.isTestRunning) {
                ExtensionOutputChannel.warn(
                    WinCCOATestController.LOG_SOURCE,
                    'Another test is already running. Waiting for it to complete...'
                );
            }

            // Wait for any running test to complete
            while (this.isTestRunning) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            try {
                this.isTestRunning = true;
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, 'Acquired test execution lock');

                // Run each test
                for (const test of queue) {
                    if (token.isCancellationRequested) {
                        run.skipped(test);
                        continue;
                    }

                    run.started(test);
                    ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `Running: ${test.label}`);

                    await this.executeTest(test, run);
                }
            } finally {
                this.isTestRunning = false;
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, 'Released test execution lock');
                run.end();
            }
        });

        // Wait for the queued execution to complete
        await this.testQueue;
    }

    /**
     * Recursively collect all executable test items (test classes with .ctl files)
     */
    private collectTestItems(item: vscode.TestItem, queue: vscode.TestItem[]): void {
        // Check if this item has a .ctl URI (test class)
        if (item.uri && item.uri.fsPath.endsWith('.ctl')) {
            queue.push(item);
            ExtensionOutputChannel.trace(WinCCOATestController.LOG_SOURCE, `Collected test: ${item.label} (${item.uri.fsPath})`);
            return;
        }

        // Otherwise, it's a folder/workspace - recurse into children
        if (item.children.size > 0) {
            ExtensionOutputChannel.trace(WinCCOATestController.LOG_SOURCE, `Recursing into: ${item.label} (${item.children.size} children)`);
            item.children.forEach(child => this.collectTestItems(child, queue));
        }
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
            
            // Add a clickable message that points to the test case definition
            if (testItem.uri && testItem.range) {
                const location = new vscode.Location(testItem.uri, testItem.range.start);
                const message = new vscode.TestMessage('✓ Test passed - click to view test definition');
                message.location = location;
                run.appendOutput(`\r\n✓ ${testItem.label} passed\r\n`, location, testItem);
                
                ExtensionOutputChannel.debug(
                    WinCCOATestController.LOG_SOURCE,
                    `Set passed test location to ${testItem.uri.fsPath}:${testItem.range.start.line + 1}`
                );
            }
            
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
     * Uses pattern to watch scripts folders at any depth
     */
    private setupFileWatcher(): void {
        // Dispose existing watchers
        this.fileWatchers.forEach(watcher => watcher.dispose());
        this.fileWatchers = [];

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return;
        }

        // Create a watcher for each workspace folder
        for (const folder of workspaceFolders) {
            const pattern = new vscode.RelativePattern(folder, '**/scripts/**/*.ctl');
            const watcher = vscode.workspace.createFileSystemWatcher(pattern);

            watcher.onDidCreate(() => {
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, 'File created, refreshing tests');
                this.discoverTests();
            });
            
            watcher.onDidChange(() => {
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, 'File changed, refreshing tests');
                this.discoverTests();
            });
            
            watcher.onDidDelete(() => {
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, 'File deleted, refreshing tests');
                this.discoverTests();
            });

            this.fileWatchers.push(watcher);
            this.context.subscriptions.push(watcher);
            
            ExtensionOutputChannel.debug(
                WinCCOATestController.LOG_SOURCE, 
                `File watcher active for: ${folder.name}/**/scripts/**/*.ctl`
            );
        }
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
        this.fileWatchers.forEach(watcher => watcher.dispose());
        this.fileWatchers = [];
    }
}
