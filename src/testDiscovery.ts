import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionOutputChannel } from './extensionOutput';
import { TestParser, ParsedTestFile } from './testParser';

export type TestDiscoveryMode = 'automatic' | 'workspace';

/**
 * Discovers test files in workspace
 */
export class TestDiscovery {
    private static readonly LOG_SOURCE = 'TestDiscovery';

    /**
     * Get current test discovery mode from configuration
     */
    public static getDiscoveryMode(): TestDiscoveryMode {
        const config = vscode.workspace.getConfiguration('winccoaTests');
        return config.get<TestDiscoveryMode>('testDiscoveryMode', 'automatic');
    }

    /**
     * Get configured workspace folders to search (empty = all)
     */
    public static getConfiguredWorkspaceFolders(): string[] {
        const config = vscode.workspace.getConfiguration('winccoaTests');
        return config.get<string[]>('workspaceFolders', []);
    }

    /**
     * Discover all test files based on configured mode
     */
    public static async discoverTests(): Promise<ParsedTestFile[]> {
        const mode = this.getDiscoveryMode();
        
        ExtensionOutputChannel.info(this.LOG_SOURCE, `Using discovery mode: ${mode}`);

        switch (mode) {
            case 'automatic':
                return await this.discoverAutomatic();
            case 'workspace':
                return await this.discoverWorkspace();
            default:
                ExtensionOutputChannel.warn(this.LOG_SOURCE, `Unknown discovery mode: ${mode}, falling back to workspace`);
                return await this.discoverWorkspace();
        }
    }

    /**
     * Automatic mode: Use tests from currently selected project (WinCC OA Core)
     */
    private static async discoverAutomatic(): Promise<ParsedTestFile[]> {
        ExtensionOutputChannel.info(this.LOG_SOURCE, 'Automatic mode - using current project from WinCC OA Core extension');
        
        // Try to get Core extension
        const coreExtension = vscode.extensions.getExtension('RichardJanisch.winccoa-project-admin');
        
        if (!coreExtension) {
            ExtensionOutputChannel.warn(
                this.LOG_SOURCE,
                'WinCC OA Core extension not found - falling back to workspace mode'
            );
            return await this.discoverWorkspace();
        }

        // Activate Core extension if needed
        if (!coreExtension.isActive) {
            ExtensionOutputChannel.debug(this.LOG_SOURCE, 'Activating WinCC OA Core extension...');
            try {
                await coreExtension.activate();
            } catch (error) {
                const err = error as Error;
                ExtensionOutputChannel.error(
                    this.LOG_SOURCE,
                    `Failed to activate Core extension: ${err.message}`,
                    err
                );
                return await this.discoverWorkspace();
            }
        }

        const coreApi = coreExtension.exports;
        
        if (!coreApi || !coreApi.getCurrentProject) {
            ExtensionOutputChannel.warn(
                this.LOG_SOURCE,
                'Core extension API not available - falling back to workspace mode'
            );
            return await this.discoverWorkspace();
        }

        const currentProject = coreApi.getCurrentProject();
        
        if (!currentProject || !currentProject.projectDir) {
            ExtensionOutputChannel.info(
                this.LOG_SOURCE,
                'No project currently selected in Core extension - falling back to workspace mode'
            );
            return await this.discoverWorkspace();
        }

        ExtensionOutputChannel.success(
            this.LOG_SOURCE,
            `Using project from Core extension: ${currentProject.name || 'Unknown'}`
        );
        ExtensionOutputChannel.debug(this.LOG_SOURCE, `  Project directory: ${currentProject.projectDir}`);

        // Get project path and check for subprojects in config
        const projectPath = currentProject.projectDir;
        const configPath = currentProject.configPath;
        
        const projectsToSearch: string[] = [projectPath];
        
        // Parse subprojects from config if available
        if (configPath) {
            try {
                const subProjects = await this.parseSubProjectsFromConfig(configPath, projectPath);
                if (subProjects.length > 0) {
                    ExtensionOutputChannel.info(
                        this.LOG_SOURCE,
                        `Found ${subProjects.length} subproject(s) in config`
                    );
                    projectsToSearch.push(...subProjects);
                }
            } catch (error) {
                const err = error as Error;
                ExtensionOutputChannel.warn(
                    this.LOG_SOURCE,
                    `Failed to parse subprojects from config: ${err.message}`
                );
            }
        }

        ExtensionOutputChannel.info(
            this.LOG_SOURCE,
            `Searching for tests in ${projectsToSearch.length} project(s)`
        );

        const testFiles: ParsedTestFile[] = [];

        // Search in main project and all subprojects
        for (const projectDir of projectsToSearch) {
            const scriptsPath = path.join(projectDir, 'scripts');

            // Check if scripts folder exists
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(scriptsPath));
            } catch {
                ExtensionOutputChannel.trace(
                    this.LOG_SOURCE,
                    `No scripts folder in: ${projectDir}`
                );
                continue;
            }

            ExtensionOutputChannel.debug(
                this.LOG_SOURCE,
                `Searching in: ${scriptsPath}`
            );

            // Use glob to find all .ctl files in scripts folder (recursive)
            const pattern = new vscode.RelativePattern(scriptsPath, '**/*.ctl');
            const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

            ExtensionOutputChannel.trace(
                this.LOG_SOURCE,
                `  Found ${files.length} .ctl file(s)`
            );

            for (const fileUri of files) {
                try {
                    // Quick check if file contains OaTest
                    const containsOaTest = await TestParser.containsOaTest(fileUri);
                    
                    if (!containsOaTest) {
                        ExtensionOutputChannel.trace(this.LOG_SOURCE, `    Skipping (no OaTest): ${path.basename(fileUri.fsPath)}`);
                        continue;
                    }

                    // Parse the file
                    const parsedFile = await TestParser.parseFile(fileUri);
                    
                    if (parsedFile && parsedFile.testClasses.length > 0) {
                        testFiles.push(parsedFile);
                        ExtensionOutputChannel.trace(
                            this.LOG_SOURCE,
                            `    ✓ ${path.relative(scriptsPath, fileUri.fsPath)}: ${parsedFile.testClasses.length} test class(es)`
                        );
                    }
                } catch (error) {
                    const err = error as Error;
                    ExtensionOutputChannel.error(
                        this.LOG_SOURCE,
                        `Error parsing ${fileUri.fsPath}: ${err.message}`,
                        err
                    );
                }
            }
        }

        ExtensionOutputChannel.success(
            this.LOG_SOURCE,
            `Automatic mode complete: Found ${testFiles.length} test file(s) with ${testFiles.reduce((sum, f) => sum + f.testClasses.length, 0)} test class(es)`
        );

        return testFiles;
    }

    /**
     * Parse subprojects from config file
     * Based on ProjectPathResolver from winccoa-ctrllang extension
     */
    private static async parseSubProjectsFromConfig(configPath: string, mainProjectPath: string): Promise<string[]> {
        const subProjects: string[] = [];

        try {
            const configContent = await vscode.workspace.fs.readFile(vscode.Uri.file(configPath));
            const configText = Buffer.from(configContent).toString('utf-8');
            const lines = configText.split('\n');

            for (const line of lines) {
                const trimmedLine = line.trim();
                
                // Look for "proj_path" entries (can be absolute or relative)
                // Example: proj_path = "../SubProject1"
                // Example: proj_path = "/absolute/path/SubProject2"
                const projPathMatch = trimmedLine.match(/^proj_path\s*=\s*"([^"]+)"/);
                
                if (projPathMatch) {
                    let subProjectPath = projPathMatch[1];
                    
                    // Resolve relative paths relative to main project directory
                    if (!path.isAbsolute(subProjectPath)) {
                        subProjectPath = path.resolve(mainProjectPath, subProjectPath);
                    }
                    
                    // Normalize and add to list
                    subProjects.push(path.normalize(subProjectPath));
                    ExtensionOutputChannel.trace(
                        this.LOG_SOURCE,
                        `    Found subproject: ${subProjectPath}`
                    );
                }
            }
        } catch (error) {
            const err = error as Error;
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Error reading config file ${configPath}: ${err.message}`,
                err
            );
        }

        return subProjects;
    }

    /**
     * Workspace mode: Search in configured workspace folders
     */
    private static async discoverWorkspace(): Promise<ParsedTestFile[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            ExtensionOutputChannel.warn(this.LOG_SOURCE, 'No workspace folders found');
            return [];
        }

        const configuredFolders = this.getConfiguredWorkspaceFolders();
        let foldersToSearch = workspaceFolders;

        // Filter to configured folders if specified
        if (configuredFolders.length > 0) {
            foldersToSearch = workspaceFolders.filter(f => configuredFolders.includes(f.name));
            ExtensionOutputChannel.info(
                this.LOG_SOURCE, 
                `Searching in configured folders: ${foldersToSearch.map(f => f.name).join(', ')}`
            );
        } else {
            ExtensionOutputChannel.info(
                this.LOG_SOURCE,
                `Searching in all workspace folders: ${foldersToSearch.map(f => f.name).join(', ')}`
            );
        }

        const allTestFiles: ParsedTestFile[] = [];

        // Search in each workspace folder
        for (const folder of foldersToSearch) {
            const testFiles = await this.discoverInFolder(folder);
            allTestFiles.push(...testFiles);
        }

        ExtensionOutputChannel.success(
            this.LOG_SOURCE, 
            `Discovery complete: Found ${allTestFiles.length} test file(s) with ${allTestFiles.reduce((sum, f) => sum + f.testClasses.length, 0)} test class(es)`
        );

        return allTestFiles;
    }

    /**
     * Discover tests in a single workspace folder
     * Improved to find scripts folders at any depth, not just directly under workspace root
     */
    private static async discoverInFolder(folder: vscode.WorkspaceFolder): Promise<ParsedTestFile[]> {
        const testFiles: ParsedTestFile[] = [];
        const folderPath = folder.uri.fsPath;

        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Searching in workspace folder: ${folderPath}`);

        try {
            // Improved strategy: Search for scripts/ folders at any depth
            // Pattern: **/scripts/**/*.ctl finds scripts folders anywhere in the tree
            const scriptsPattern = new vscode.RelativePattern(folder, '**/scripts/**/*.ctl');
            
            ExtensionOutputChannel.trace(this.LOG_SOURCE, `Using pattern: **/scripts/**/*.ctl`);

            const ctlFiles = await vscode.workspace.findFiles(
                scriptsPattern,
                '**/node_modules/**' // Exclude node_modules
            );

            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Found ${ctlFiles.length} .ctl file(s) in scripts folders`);

            // Parse each file
            for (const fileUri of ctlFiles) {
                // Quick check if file contains OaTest
                const containsOaTest = await TestParser.containsOaTest(fileUri);
                
                if (!containsOaTest) {
                    ExtensionOutputChannel.trace(this.LOG_SOURCE, `Skipping (no OaTest): ${fileUri.fsPath}`);
                    continue;
                }

                // Parse the file
                const parsedFile = await TestParser.parseFile(fileUri);
                
                if (parsedFile && parsedFile.testClasses.length > 0) {
                    testFiles.push(parsedFile);
                    ExtensionOutputChannel.debug(
                        this.LOG_SOURCE,
                        `Added test file: ${path.basename(fileUri.fsPath)} (${parsedFile.testClasses.length} class(es))`
                    );
                }
            }
        } catch (error) {
            ExtensionOutputChannel.error(this.LOG_SOURCE, `Error discovering tests in folder: ${folderPath}`, error as Error);
        }

        return testFiles;
    }

    /**
     * Parse a single test file
     * Useful for incremental updates when a file changes
     */
    public static async parseTestFile(fileUri: vscode.Uri): Promise<ParsedTestFile | undefined> {
        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Parsing single test file: ${fileUri.fsPath}`);

        // Check if file is in a scripts folder
        if (!fileUri.fsPath.includes('/scripts/') && !fileUri.fsPath.includes('\\scripts\\')) {
            ExtensionOutputChannel.trace(this.LOG_SOURCE, `File not in scripts folder, skipping: ${fileUri.fsPath}`);
            return undefined;
        }

        // Parse the file (will return undefined if no OaTest classes found)
        return await TestParser.parseFile(fileUri);
    }

    /**
     * Discover tests matching a specific file URI
     * Useful for incremental updates when a file changes
     * @deprecated Use parseTestFile instead
     */
    public static async discoverInFile(fileUri: vscode.Uri): Promise<ParsedTestFile | undefined> {
        return this.parseTestFile(fileUri);
    }
}
