import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionOutputChannel } from './extensionOutput';
import { TestParser, ParsedTestFile } from './testParser';

/**
 * Discovers test files in workspace
 */
export class TestDiscovery {
    private static readonly LOG_SOURCE = 'TestDiscovery';

    /**
     * Discover all test files in workspace
     * Searches for scripts/ folders and .ctl files containing OaTest classes
     */
    public static async discoverTests(): Promise<ParsedTestFile[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            ExtensionOutputChannel.warn(this.LOG_SOURCE, 'No workspace folders found');
            return [];
        }

        ExtensionOutputChannel.info(this.LOG_SOURCE, `Discovering tests in ${workspaceFolders.length} workspace folder(s)`);

        const allTestFiles: ParsedTestFile[] = [];

        // Search in each workspace folder
        for (const folder of workspaceFolders) {
            const testFiles = await this.discoverInFolder(folder);
            allTestFiles.push(...testFiles);
        }

        ExtensionOutputChannel.success(this.LOG_SOURCE, `Discovery complete: Found ${allTestFiles.length} test file(s) with ${allTestFiles.reduce((sum, f) => sum + f.testClasses.length, 0)} test class(es)`);

        return allTestFiles;
    }

    /**
     * Discover tests in a single workspace folder
     */
    private static async discoverInFolder(folder: vscode.WorkspaceFolder): Promise<ParsedTestFile[]> {
        const testFiles: ParsedTestFile[] = [];
        const folderPath = folder.uri.fsPath;

        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Searching in workspace folder: ${folderPath}`);

        try {
            // Strategy: Search for scripts/ folders one level deep
            // Pattern: workspace/*/scripts/*.ctl
            const scriptsPattern = new vscode.RelativePattern(folder, '*/scripts/**/*.ctl');
            
            ExtensionOutputChannel.trace(this.LOG_SOURCE, `Using pattern: */scripts/**/*.ctl`);

            const ctlFiles = await vscode.workspace.findFiles(scriptsPattern);

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
