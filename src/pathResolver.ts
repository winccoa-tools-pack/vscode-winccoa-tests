import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ExtensionOutputChannel } from './extensionOutput';

export type LogPathSource = 'static' | 'workspace';

/**
 * Resolves the log directory path based on configuration
 */
export class PathResolver {
    private static readonly LOG_SOURCE = 'PathResolver';

    /**
     * Get the log path based on current configuration
     */
    public static getLogPath(): string | undefined {
        const config = vscode.workspace.getConfiguration('winccoaTests');
        const source = config.get<LogPathSource>('logPathSource', 'workspace');

        ExtensionOutputChannel.debug(this.LOG_SOURCE, `Resolving log path with source: ${source}`);

        switch (source) {
            case 'static':
                return this.getStaticPath();
            case 'workspace':
                return this.getWorkspacePath();
            default:
                ExtensionOutputChannel.warn(this.LOG_SOURCE, `Unknown log path source: ${source}, falling back to workspace`);
                return this.getWorkspacePath();
        }
    }

    /**
     * Get static path from configuration
     */
    private static getStaticPath(): string | undefined {
        const config = vscode.workspace.getConfiguration('winccoaTests');
        const staticPath = config.get<string>('staticLogPath', '');

        if (!staticPath || staticPath.trim() === '') {
            ExtensionOutputChannel.error(this.LOG_SOURCE, 'Static log path is not configured');
            vscode.window.showWarningMessage(
                'WinCC OA Tests: Static log path is not configured. Please set "winccoaTests.staticLogPath" in settings.'
            );
            return undefined;
        }

        // Validate that path exists
        if (!fs.existsSync(staticPath)) {
            ExtensionOutputChannel.error(this.LOG_SOURCE, `Static log path does not exist: ${staticPath}`);
            vscode.window.showWarningMessage(
                `WinCC OA Tests: Static log path does not exist: ${staticPath}`
            );
            return undefined;
        }

        ExtensionOutputChannel.info(this.LOG_SOURCE, `Using static log path: ${staticPath}`);
        return staticPath;
    }

    /**
     * Get log path derived from workspace
     */
    private static getWorkspacePath(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            ExtensionOutputChannel.error(this.LOG_SOURCE, 'No workspace folder open');
            vscode.window.showWarningMessage(
                'WinCC OA Tests: No workspace folder is open. Please open a workspace or configure a static log path.'
            );
            return undefined;
        }

        // Search through all workspace folders for a 'log' directory
        for (const folder of workspaceFolders) {
            const workspaceRoot = folder.uri.fsPath;
            const logPath = path.join(workspaceRoot, 'log');

            // Check if log directory exists in this workspace folder
            if (fs.existsSync(logPath)) {
                ExtensionOutputChannel.info(this.LOG_SOURCE, `Using workspace-derived log path: ${logPath}`);
                return logPath;
            }
        }

        // No log directory found in any workspace folder
        ExtensionOutputChannel.warn(this.LOG_SOURCE, `Log directory does not exist in any workspace folder: ${workspaceFolders.map(f => f.uri.fsPath).join(', ')}`);
        vscode.window.showWarningMessage(
            `WinCC OA Tests: Log directory not found in any workspace folder. Please ensure one of your workspace folders contains a 'log' folder or configure a static log path.`
        );
        return undefined;
    }

    /**
     * Validate that a path exists and is a directory
     */
    public static validatePath(logPath: string): boolean {
        ExtensionOutputChannel.trace(this.LOG_SOURCE, `Validating path: ${logPath}`);
        try {
            const stats = fs.statSync(logPath);
            if (!stats.isDirectory()) {
                ExtensionOutputChannel.warn(this.LOG_SOURCE, `Path is not a directory: ${logPath}`);
                return false;
            }
            ExtensionOutputChannel.trace(this.LOG_SOURCE, `Path validated successfully: ${logPath}`);
            return true;
        } catch (error) {
            ExtensionOutputChannel.error(this.LOG_SOURCE, `Path validation failed: ${logPath}`, error as Error);
            return false;
        }
    }
}
