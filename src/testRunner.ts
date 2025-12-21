import * as vscode from 'vscode';
import { ExtensionOutputChannel } from './extensionOutput';

/**
 * Test runner that executes tests using WinCC OA Script Actions extension
 */
export class TestRunner {
    private static readonly LOG_SOURCE = 'TestRunner';

    /**
     * Check if Script Actions extension is available
     */
    public static isScriptActionsAvailable(): boolean {
        const extension = vscode.extensions.getExtension('richardjanisch.winccoa-script-actions');
        return extension !== undefined && extension.isActive;
    }

    /**
     * Execute a test file using Script Actions
     * 
     * @param fileUri URI of the test file to execute
     * @returns true if execution started successfully
     */
    public static async executeTestFile(fileUri: vscode.Uri): Promise<boolean> {
        try {
            // Check if Script Actions is available
            if (!this.isScriptActionsAvailable()) {
                ExtensionOutputChannel.warn(
                    this.LOG_SOURCE,
                    'WinCC OA Script Actions extension is not available. Please install it to run tests.'
                );
                
                vscode.window.showWarningMessage(
                    'WinCC OA Script Actions extension is required to run tests.',
                    'Install Extension',
                    'Dismiss'
                ).then(selection => {
                    if (selection === 'Install Extension') {
                        vscode.commands.executeCommand('workbench.extensions.search', '@id:RichardJanisch.winccoa-script-actions');
                    }
                });
                
                return false;
            }

            ExtensionOutputChannel.info(this.LOG_SOURCE, `Executing test file: ${fileUri.fsPath}`);

            // Execute via Script Actions command
            await vscode.commands.executeCommand('winccoa.executeScript', fileUri);
            
            ExtensionOutputChannel.success(
                this.LOG_SOURCE,
                `Test execution started successfully`
            );
            return true;

        } catch (error) {
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Failed to execute test file: ${fileUri.fsPath}`,
                error as Error
            );
            return false;
        }
    }

    /**
     * Get list of available Script Actions commands (for debugging)
     */
    public static async getAvailableScriptActionsCommands(): Promise<string[]> {
        const allCommands = await vscode.commands.getCommands(true);
        return allCommands.filter(cmd => 
            cmd.includes('script-actions') || 
            cmd.includes('scriptActions') ||
            cmd.includes('winccoa')
        );
    }
}
