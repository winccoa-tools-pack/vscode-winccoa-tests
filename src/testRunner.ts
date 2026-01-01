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
    private static runningProcess: import('child_process').ChildProcess | null = null;

    public static async executeTestFile(fileUri: vscode.Uri, cancelToken?: vscode.CancellationToken): Promise<boolean> {
        const { spawn } = await import('child_process');
        try {
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

            // Get config - either from static settings or Core extension
            const scriptActionsConfig = vscode.workspace.getConfiguration('winccoa.scriptActions');
            const pathSource = scriptActionsConfig.get<string>('pathSource', 'static');
            
            let installPath = '';
            let projectName = '';
            
            if (pathSource === 'automatic') {
                // Get from Core extension API
                const coreExtension = vscode.extensions.getExtension('RichardJanisch.winccoa-project-admin');
                if (coreExtension?.isActive) {
                    const coreApi = coreExtension.exports;
                    const currentProject = coreApi.getCurrentProject?.();
                    if (currentProject) {
                        installPath = currentProject.oaInstallPath || '';
                        projectName = currentProject.name || '';
                        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Using Core API: installPath=${installPath}, projectName=${projectName}`);
                    }
                }
            } else {
                // Static mode - from settings
                installPath = scriptActionsConfig.get<string>('installPath', '');
                projectName = scriptActionsConfig.get<string>('projectName', '');
            }
            
            if (!installPath || !projectName) {
                ExtensionOutputChannel.error(this.LOG_SOURCE, `Missing config: installPath=${installPath}, projectName=${projectName}`);
                return false;
            }
            
            const binPath = installPath.replace(/[\/]+$/, '') + '/bin';
            const executable = process.platform === 'win32' ? 'WCCOActrl.exe' : 'WCCOActrl';
            const fullExecutablePath = binPath + '/' + executable;
            const scriptPath = fileUri.fsPath;
            const args = [scriptPath, '-proj', projectName, '-n'];

            // Spawn process
            const child = spawn(fullExecutablePath, args, { stdio: 'ignore' });
            TestRunner.runningProcess = child;

            // Listen for cancellation
            if (cancelToken) {
                cancelToken.onCancellationRequested(() => {
                    if (TestRunner.runningProcess) {
                        TestRunner.runningProcess.kill();
                        ExtensionOutputChannel.info(this.LOG_SOURCE, 'Test process killed due to cancellation');
                        TestRunner.runningProcess = null;
                    }
                });
            }

            child.on('exit', (code) => {
                TestRunner.runningProcess = null;
                ExtensionOutputChannel.info(this.LOG_SOURCE, `Test process exited with code ${code}`);
            });

            ExtensionOutputChannel.success(
                this.LOG_SOURCE,
                `Test execution started successfully (cancelable)`
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
     * Execute a test file with arguments using Script Actions
     * 
     * @param fileUri URI of the test file to execute
     * @param testCaseId ID of the test case to execute
     * @returns true if execution started successfully
     */
    public static async executeScriptWithArgs(fileUri: vscode.Uri, testCaseId: string, cancelToken?: vscode.CancellationToken): Promise<boolean> {
        const { spawn } = await import('child_process');
        try {
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

            ExtensionOutputChannel.info(this.LOG_SOURCE, `Executing test with args: ${fileUri.fsPath} ${testCaseId}`);

            // Get config - either from static settings or Core extension
            const scriptActionsConfig = vscode.workspace.getConfiguration('winccoa.scriptActions');
            const pathSource = scriptActionsConfig.get<string>('pathSource', 'static');
            
            let installPath = '';
            let projectName = '';
            
            if (pathSource === 'automatic') {
                // Get from Core extension API
                const coreExtension = vscode.extensions.getExtension('RichardJanisch.winccoa-project-admin');
                if (coreExtension?.isActive) {
                    const coreApi = coreExtension.exports;
                    const currentProject = coreApi.getCurrentProject?.();
                    if (currentProject) {
                        installPath = currentProject.oaInstallPath || '';
                        projectName = currentProject.name || '';
                        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Using Core API: installPath=${installPath}, projectName=${projectName}`);
                    }
                }
            } else {
                // Static mode - from settings
                installPath = scriptActionsConfig.get<string>('installPath', '');
                projectName = scriptActionsConfig.get<string>('projectName', '');
            }
            
            if (!installPath || !projectName) {
                ExtensionOutputChannel.error(this.LOG_SOURCE, `Missing config: installPath=${installPath}, projectName=${projectName}`);
                return false;
            }
            
            const binPath = installPath.replace(/[\/]+$/, '') + '/bin';
            const executable = process.platform === 'win32' ? 'WCCOActrl.exe' : 'WCCOActrl';
            const fullExecutablePath = binPath + '/' + executable;
            const scriptPath = fileUri.fsPath;
            const args = [scriptPath, '-proj', projectName, '-n', testCaseId];

            // Spawn process
            const child = spawn(fullExecutablePath, args, { stdio: 'ignore' });
            TestRunner.runningProcess = child;

            // Listen for cancellation
            if (cancelToken) {
                cancelToken.onCancellationRequested(() => {
                    if (TestRunner.runningProcess) {
                        TestRunner.runningProcess.kill();
                        ExtensionOutputChannel.info(this.LOG_SOURCE, 'Test process killed due to cancellation');
                        TestRunner.runningProcess = null;
                    }
                });
            }

            child.on('exit', (code) => {
                TestRunner.runningProcess = null;
                ExtensionOutputChannel.info(this.LOG_SOURCE, `Test process exited with code ${code}`);
            });

            ExtensionOutputChannel.success(
                this.LOG_SOURCE,
                `Test execution with args started successfully (cancelable)`
            );
            return true;

        } catch (error) {
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Failed to execute test with args: ${fileUri.fsPath}`,
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
