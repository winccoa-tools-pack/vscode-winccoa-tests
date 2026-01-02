import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionOutputChannel } from './extensionOutput';
import { TestDiscovery } from './testDiscovery';
import { ParsedTestFile } from './testParser';
import { TestRunner } from './testRunner';
import { JsonResultParser } from './jsonResultParser';

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

    // Current cancellation token for stopping running tests
    private currentCancelToken: vscode.CancellationToken | null = null;

    // Map to store parsed test files info (for individual test support check)
    private parsedTestFiles: Map<string, ParsedTestFile> = new Map();

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
        const mode = TestDiscovery.getDiscoveryMode();

        for (const testFile of testFiles) {
            // Find which workspace folder this file belongs to
            const workspaceFolder = workspaceFolders.find(folder => 
                testFile.fileUri.fsPath.startsWith(folder.uri.fsPath)
            );

            let projectFolder: string;
            
            if (!workspaceFolder) {
                // In automatic mode, allow tests outside workspace (from WinCC OA project)
                if (mode === 'automatic') {
                    // Extract project folder by searching for scripts/ in path
                    const scriptsIndex = testFile.fileUri.fsPath.indexOf('scripts');
                    if (scriptsIndex !== -1) {
                        // Project folder is one level above scripts
                        projectFolder = path.dirname(testFile.fileUri.fsPath.substring(0, scriptsIndex));
                        ExtensionOutputChannel.debug(
                            WinCCOATestController.LOG_SOURCE,
                            `Test outside workspace (automatic mode): ${path.basename(projectFolder)}`
                        );
                    } else {
                        ExtensionOutputChannel.warn(
                            WinCCOATestController.LOG_SOURCE,
                            `Could not determine project folder for: ${testFile.fileUri.fsPath}`
                        );
                        continue;
                    }
                } else {
                    // Workspace mode: Skip tests outside workspace
                    ExtensionOutputChannel.warn(
                        WinCCOATestController.LOG_SOURCE,
                        `Could not find workspace folder for: ${testFile.fileUri.fsPath}`
                    );
                    continue;
                }
            } else {
                // Extract project folder (one level above scripts)
                projectFolder = this.extractProjectFolder(testFile.fileUri.fsPath, workspaceFolder.uri.fsPath);
            }
            
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

        // Store parsed file info for later use
        this.parsedTestFiles.set(parsedFile.fileUri.toString(), parsedFile);

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
     * Get the main project root directory where JSON results will be written.
     * Tests can be in subprojects, but WinCC OA always writes results to the main project.
     * 
     * Strategy:
     * 1. In automatic mode: Get main project from Core extension
     * 2. In workspace mode: Search upwards for config/config file
     */
    private async getMainProjectRoot(testFileUri?: vscode.Uri): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('winccoaTests');
        const discoveryMode = config.get<string>('testDiscoveryMode', 'automatic');

        if (discoveryMode === 'automatic') {
            // Get main project from Core extension
            const coreExtension = vscode.extensions.getExtension('RichardJanisch.winccoa-project-admin');
            
            if (coreExtension) {
                if (!coreExtension.isActive) {
                    await coreExtension.activate();
                }
                
                const coreApi = coreExtension.exports;
                if (coreApi && coreApi.getCurrentProject) {
                    const currentProject = coreApi.getCurrentProject();
                    if (currentProject && currentProject.projectDir) {
                        ExtensionOutputChannel.debug(
                            WinCCOATestController.LOG_SOURCE,
                            `Using main project from Core extension: ${currentProject.projectDir}`
                        );
                        return currentProject.projectDir;
                    }
                }
            }
            
            ExtensionOutputChannel.warn(
                WinCCOATestController.LOG_SOURCE,
                'Automatic mode: Core extension not available, falling back to config search'
            );
        }

        // Workspace mode or fallback: Search for config/config file
        if (testFileUri) {
            const mainProject = await this.findMainProjectFromTestFile(testFileUri);
            if (mainProject) {
                return mainProject;
            }
        }

        // Last resort: Search all workspace folders for config/config
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const configPath = path.join(folder.uri.fsPath, 'config', 'config');
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(configPath));
                    ExtensionOutputChannel.debug(
                        WinCCOATestController.LOG_SOURCE,
                        `Found main project with config: ${folder.uri.fsPath}`
                    );
                    return folder.uri.fsPath;
                } catch {
                    // Not found, continue
                }
            }
        }

        ExtensionOutputChannel.error(
            WinCCOATestController.LOG_SOURCE,
            'Could not find main project (no config/config file found)'
        );
        return undefined;
    }

    /**
     * Find main project by searching upwards from test file for config/config
     */
    private async findMainProjectFromTestFile(testFileUri: vscode.Uri): Promise<string | undefined> {
        let currentDir = path.dirname(testFileUri.fsPath);
        const maxLevels = 10; // Prevent infinite loop
        
        for (let i = 0; i < maxLevels; i++) {
            const configPath = path.join(currentDir, 'config', 'config');
            
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(configPath));
                ExtensionOutputChannel.debug(
                    WinCCOATestController.LOG_SOURCE,
                    `Found config/config at: ${currentDir}`
                );
                return currentDir;
            } catch {
                // Not found, go up one level
                const parentDir = path.dirname(currentDir);
                if (parentDir === currentDir) {
                    // Reached filesystem root
                    break;
                }
                currentDir = parentDir;
            }
        }
        
        return undefined;
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
                this.currentCancelToken = token;
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, 'Acquired test execution lock');

                // Run each test
                for (const test of queue) {
                    if (token.isCancellationRequested) {
                        run.skipped(test);
                        continue;
                    }

                    run.started(test);
                    ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `Running: ${test.label}`);

                    await this.executeTest(test, run, token);
                }
            } finally {
                this.isTestRunning = false;
                this.currentCancelToken = null;
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
        run: vscode.TestRun,
        token: vscode.CancellationToken
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
            let isIndividualTest = false;
            
            // Check if this is a test class or individual test case
            if (test.children.size > 0) {
                // Test class - executing all tests in the class
                test.children.forEach(child => {
                    testCaseIds.push(child.label);
                });
                isIndividualTest = false;
            } else {
                // Individual test case
                testCaseIds.push(test.label);
                isIndividualTest = true;
            }

            // Check if file supports individual test execution
            const parsedFile = this.parsedTestFiles.get(test.uri.toString());
            const supportsIndividualTests = parsedFile?.supportsIndividualTests ?? false;

            ExtensionOutputChannel.info(
                WinCCOATestController.LOG_SOURCE,
                `Executing ${isIndividualTest ? 'individual test' : 'test class'}: ${testCaseIds.join(', ')} (supports individual: ${supportsIndividualTests})`
            );

            // Get the main project root where JSON results will be written
            // Tests can be in subprojects, but WinCC OA always writes results to main project
            const mainProjectRoot = await this.getMainProjectRoot(test.uri);
            if (!mainProjectRoot) {
                ExtensionOutputChannel.error(WinCCOATestController.LOG_SOURCE, 'Could not determine main project root');
                const message = new vscode.TestMessage('Could not find main project (no config/config file found)');
                run.failed(test, message);
                return;
            }
            
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, `Main project root: ${mainProjectRoot}`);

            // Step 1: Delete old result files if they exist
            if (JsonResultParser.resultFilesExist(mainProjectRoot)) {
                ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Deleting old result files...');
                JsonResultParser.deleteResultFiles(mainProjectRoot);
            }

            // Step 2: Create empty result files
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Creating result files...');
            JsonResultParser.createResultFiles(mainProjectRoot);

            // Step 3: Execute the test file via Script Actions
            // If individual test AND file supports it, use executeScriptWithArgs
            // Otherwise use normal executeScript (runs whole file)
            let executionStarted: boolean;
            
            if (isIndividualTest && supportsIndividualTests) {
                // Execute single test with arguments
                ExtensionOutputChannel.info(
                    WinCCOATestController.LOG_SOURCE,
                    `Executing individual test with args: ${testCaseIds[0]}`
                );
                executionStarted = await TestRunner.executeScriptWithArgs(test.uri, testCaseIds[0], token);
            } else {
                // Execute entire file (class with all tests)
                if (isIndividualTest && !supportsIndividualTests) {
                    ExtensionOutputChannel.warn(
                        WinCCOATestController.LOG_SOURCE,
                        'Individual test selected but file does not support it - running entire file instead'
                    );
                }
                executionStarted = await TestRunner.executeTestFile(test.uri, token);
            }

            if (!executionStarted) {
                JsonResultParser.deleteResultFiles(mainProjectRoot);
                const message = new vscode.TestMessage('Failed to start test execution. Is WinCC OA Script Actions extension installed?');
                run.failed(test, message);
                return;
            }

            // Step 4: Wait a bit for test execution to complete and write results
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Waiting for test execution to complete...');
            const resultsAvailable = await this.waitForTestCompletion(mainProjectRoot, 5000, token);
            
            if (!resultsAvailable) {
                // Timeout or no results - test execution likely failed
                ExtensionOutputChannel.error(
                    WinCCOATestController.LOG_SOURCE, 
                    'Test execution timeout or failed - no results written to JSON files. Check WinCC OA Script Actions output for errors.'
                );
                
                JsonResultParser.deleteResultFiles(mainProjectRoot);
                
                const message = new vscode.TestMessage(
                    'Test execution failed or timed out. No results were written. ' +
                    'Check the WinCC OA Script Actions output channel for execution errors (syntax errors, missing functions, etc.).'
                );
                
                if (test.children.size > 0) {
                    test.children.forEach(child => {
                        run.errored(child, message);
                    });
                } else {
                    run.errored(test, message);
                }
                
                return;
            }

            // Step 5: Parse JSON results
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Parsing test results...');
            const testResults = await JsonResultParser.parseResults(mainProjectRoot, testCaseIds);

            // Step 6: Delete result files
            ExtensionOutputChannel.info(WinCCOATestController.LOG_SOURCE, 'Cleaning up result files...');
            JsonResultParser.deleteResultFiles(mainProjectRoot);

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
     * @returns true if results were written, false if timeout or cancelled
     */
    private async waitForTestCompletion(projectRoot: string, timeoutMs: number, token?: vscode.CancellationToken): Promise<boolean> {
        const startTime = Date.now();
        const pollInterval = 500; // Check every 500ms

        while (Date.now() - startTime < timeoutMs) {
            // Check for cancellation first
            if (token?.isCancellationRequested) {
                ExtensionOutputChannel.info(
                    WinCCOATestController.LOG_SOURCE,
                    'Test execution cancelled by user'
                );
                return false;
            }

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
                        return true;
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
            `Timeout waiting for test results after ${timeoutMs}ms - test execution likely failed`
        );
        return false;
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
            const messages = this.createJsonTestMessages(testItem, result);
            
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
            const messages = this.createJsonTestMessages(testItem, result);
            
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
    private createJsonTestMessages(
        testItem: vscode.TestItem,
        result: {
            message: string;
            status: string;
            assertions: Array<{
                status: string;
                message: string;
                stackTrace?: vscode.TestMessage[];
                location?: vscode.Location;
            }>;
        }
    ): vscode.TestMessage[] {
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
                } else if (assertion.status === 'aborted' && testItem.uri && testItem.range) {
                    // For aborted tests without location, use test definition location
                    message.location = new vscode.Location(testItem.uri, testItem.range.start);
                    
                    ExtensionOutputChannel.debug(
                        WinCCOATestController.LOG_SOURCE,
                        `Aborted message: using test definition at ${testItem.uri.fsPath}:${testItem.range.start.line + 1}`
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
            
            // If still no location and it's aborted, use test definition
            if (!message.location && result.status === 'aborted' && testItem.uri && testItem.range) {
                message.location = new vscode.Location(testItem.uri, testItem.range.start);
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

            watcher.onDidCreate((uri) => {
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `File created: ${uri.fsPath}`);
                this.handleFileCreated(uri);
            });
            
            watcher.onDidChange((uri) => {
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `File changed: ${uri.fsPath}`);
                this.handleFileChanged(uri);
            });
            
            watcher.onDidDelete((uri) => {
                ExtensionOutputChannel.debug(WinCCOATestController.LOG_SOURCE, `File deleted: ${uri.fsPath}`);
                this.handleFileDeleted(uri);
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
     * Handle file creation - parse only the new file
     */
    private async handleFileCreated(uri: vscode.Uri): Promise<void> {
        const parsedFile = await TestDiscovery.parseTestFile(uri);
        
        if (!parsedFile) {
            ExtensionOutputChannel.debug(
                WinCCOATestController.LOG_SOURCE,
                `Created file is not a test file: ${uri.fsPath}`
            );
            return;
        }

        // Store parsed file info
        this.parsedTestFiles.set(uri.fsPath, parsedFile);

        // Add to test hierarchy
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            return;
        }

        const projectFolder = this.extractProjectFolder(uri.fsPath, workspaceFolder.uri.fsPath);
        const projectName = path.basename(projectFolder);
        const projectId = `project::${projectFolder}`;

        // Get or create project item
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

        // Get folder path and create folder items
        const dirPath = this.getPathRelativeToProject(uri.fsPath, projectFolder);
        const folderItem = this.getOrCreateFolderItemInProject(dirPath, projectFolder, projectName, projectItem);

        // Add test file items
        this.createTestItemsFromParsedFile(parsedFile, folderItem);

        ExtensionOutputChannel.success(
            WinCCOATestController.LOG_SOURCE,
            `Added new test file: ${path.basename(uri.fsPath)}`
        );
    }

    /**
     * Handle file change - re-parse only the changed file
     */
    private async handleFileChanged(uri: vscode.Uri): Promise<void> {
        const parsedFile = await TestDiscovery.parseTestFile(uri);
        
        if (!parsedFile) {
            // File is no longer a test file - remove it
            this.handleFileDeleted(uri);
            return;
        }

        // Update stored parsed file info
        this.parsedTestFiles.set(uri.fsPath, parsedFile);

        // Remove old test items and re-add
        this.removeTestItemsForFile(uri);
        
        // Re-add to test hierarchy
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            return;
        }

        const projectFolder = this.extractProjectFolder(uri.fsPath, workspaceFolder.uri.fsPath);
        const projectName = path.basename(projectFolder);
        const projectId = `project::${projectFolder}`;

        const projectItem = this.testController.items.get(projectId);
        if (!projectItem) {
            // Project doesn't exist yet - do full rediscovery
            ExtensionOutputChannel.warn(
                WinCCOATestController.LOG_SOURCE,
                `Project item not found for changed file, triggering full refresh`
            );
            this.discoverTests();
            return;
        }

        const dirPath = this.getPathRelativeToProject(uri.fsPath, projectFolder);
        const folderItem = this.getOrCreateFolderItemInProject(dirPath, projectFolder, projectName, projectItem);

        // Add updated test file items
        this.createTestItemsFromParsedFile(parsedFile, folderItem);

        ExtensionOutputChannel.success(
            WinCCOATestController.LOG_SOURCE,
            `Updated test file: ${path.basename(uri.fsPath)}`
        );
    }

    /**
     * Handle file deletion - remove test items for deleted file
     */
    private handleFileDeleted(uri: vscode.Uri): void {
        // Remove from parsed files map
        this.parsedTestFiles.delete(uri.fsPath);

        // Remove test items
        this.removeTestItemsForFile(uri);

        ExtensionOutputChannel.success(
            WinCCOATestController.LOG_SOURCE,
            `Removed test file: ${path.basename(uri.fsPath)}`
        );
    }

    /**
     * Remove all test items associated with a specific file
     */
    private removeTestItemsForFile(uri: vscode.Uri): void {
        const fileId = `file::${uri.fsPath}`;
        
        // Find and remove the file item from the tree
        this.testController.items.forEach(projectItem => {
            this.removeFileItemRecursive(projectItem, fileId);
        });
    }

    /**
     * Recursively search and remove file item from test hierarchy
     */
    private removeFileItemRecursive(parent: vscode.TestItem, fileId: string): boolean {
        let found = false;
        
        parent.children.forEach(child => {
            if (child.id === fileId) {
                parent.children.delete(child.id);
                found = true;
            } else if (child.children.size > 0) {
                const removedFromChild = this.removeFileItemRecursive(child, fileId);
                
                // If child folder is now empty, remove it too
                if (removedFromChild && child.children.size === 0 && child.id.startsWith('folder::')) {
                    parent.children.delete(child.id);
                    found = true;
                }
            }
        });
        
        return found;
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
