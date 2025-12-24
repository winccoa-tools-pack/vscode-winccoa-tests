import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionOutputChannel } from './extensionOutput';
import { TestParser, ParsedTestFile } from './testParser';

export type TestDiscoveryMode = 'automatic' | 'workspace' | 'static';

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
            case 'static':
                return await this.discoverStatic();
            default:
                ExtensionOutputChannel.warn(this.LOG_SOURCE, `Unknown discovery mode: ${mode}, falling back to workspace`);
                return await this.discoverWorkspace();
        }
    }

    /**
     * Automatic mode: Use tests from currently selected project (WinCC OA Core)
     */
    private static async discoverAutomatic(): Promise<ParsedTestFile[]> {
        ExtensionOutputChannel.info(this.LOG_SOURCE, 'Automatic mode - not yet implemented, falling back to workspace');
        // TODO: Implement in next step - get current project from Core extension
        return await this.discoverWorkspace();
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
     * Static mode: Use static log path (fallback)
     */
    private static async discoverStatic(): Promise<ParsedTestFile[]> {
        ExtensionOutputChannel.info(this.LOG_SOURCE, 'Static mode - using static log path configuration');
        // Keep existing static behavior as fallback
        return [];
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
     * Discover tests matching a specific file URI
     * Useful for incremental updates when a file changes
     */
    public static async discoverInFile(fileUri: vscode.Uri): Promise<ParsedTestFile | undefined> {
        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Discovering tests in single file: ${fileUri.fsPath}`);

        // Check if file is in a scripts folder
        if (!fileUri.fsPath.includes('/scripts/') && !fileUri.fsPath.includes('\\scripts\\')) {
            ExtensionOutputChannel.trace(this.LOG_SOURCE, `File not in scripts folder, skipping: ${fileUri.fsPath}`);
            return undefined;
        }

        // Check if contains OaTest
        const containsOaTest = await TestParser.containsOaTest(fileUri);
        if (!containsOaTest) {
            ExtensionOutputChannel.trace(this.LOG_SOURCE, `File does not contain OaTest: ${fileUri.fsPath}`);
            return undefined;
        }

        // Parse the file
        return await TestParser.parseFile(fileUri);
    }
}
