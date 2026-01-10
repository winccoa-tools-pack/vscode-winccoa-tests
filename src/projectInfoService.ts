import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionOutputChannel } from './extensionOutput.js';

/**
 * Project information including paths to config, log, etc.
 * This will be populated by external npm lib in the future.
 */
export interface ProjectInfo {
    projectPath: string;
    configPath: string;
    logPath: string;
    binPath: string;
    sourceType: 'workspace' | 'automatic' | 'static';
}

/**
 * Service to retrieve WinCC OA project information.
 *
 * Current implementation: Basic workspace detection
 * Future: Will be replaced/extended with external npm library
 *         for comprehensive project detection
 */
export class ProjectInfoService {
    private static readonly LOG_SOURCE = 'ProjectInfoService';

    /**
     * Get project information based on configuration
     *
     * @param workspaceFolder Workspace folder to analyze
     * @returns ProjectInfo or undefined if not found
     */
    public static async getProjectInfo(
        workspaceFolder: vscode.WorkspaceFolder,
    ): Promise<ProjectInfo | undefined> {
        const config = vscode.workspace.getConfiguration('winccoaTests');
        const sourceType = config.get<string>('projectSourceType', 'workspace');

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Getting project info with sourceType: ${sourceType}`,
        );

        switch (sourceType) {
            case 'workspace':
                return this.getProjectInfoFromWorkspace(workspaceFolder);

            case 'automatic':
                ExtensionOutputChannel.warn(
                    this.LOG_SOURCE,
                    'Automatic project detection not yet implemented (Coming Soon)',
                );
                return undefined;

            case 'static':
                ExtensionOutputChannel.warn(
                    this.LOG_SOURCE,
                    'Static project path not yet implemented (Coming Soon)',
                );
                return undefined;

            default:
                ExtensionOutputChannel.error(
                    this.LOG_SOURCE,
                    `Unknown projectSourceType: ${sourceType}`,
                );
                return undefined;
        }
    }

    /**
     * Derive project info from workspace root
     * Assumes standard WinCC OA project structure
     */
    private static async getProjectInfoFromWorkspace(
        workspaceFolder: vscode.WorkspaceFolder,
    ): Promise<ProjectInfo | undefined> {
        const projectPath = workspaceFolder.uri.fsPath;

        ExtensionOutputChannel.trace(this.LOG_SOURCE, `Analyzing workspace path: ${projectPath}`);

        // Standard WinCC OA paths (will be enhanced by npm lib)
        const configPath = path.join(projectPath, 'config');
        const logPath = path.join(projectPath, 'log');

        // Get bin path from settings
        const config = vscode.workspace.getConfiguration('winccoaTests');
        const binPath = config.get<string>('winccoaBinPath', '');

        const projectInfo: ProjectInfo = {
            projectPath,
            configPath,
            logPath,
            binPath,
            sourceType: 'workspace',
        };

        ExtensionOutputChannel.debug(
            this.LOG_SOURCE,
            `Project info resolved: ${JSON.stringify(projectInfo, null, 2)}`,
        );

        return projectInfo;
    }

    /**
     * Validate project info
     * TODO: Add actual validation (check if paths exist, etc.)
     */
    public static async validateProjectInfo(info: ProjectInfo): Promise<boolean> {
        ExtensionOutputChannel.trace(
            this.LOG_SOURCE,
            'Validating project info (basic validation - enhanced version coming with npm lib)',
        );

        // Basic validation
        if (!info.projectPath) {
            ExtensionOutputChannel.error(this.LOG_SOURCE, 'Project path is empty');
            return false;
        }

        // TODO: Check if paths exist
        // TODO: Check if config files are present
        // TODO: Validate WinCC OA installation

        return true;
    }

    /**
     * Placeholder for future npm lib integration
     * This method will be replaced by external library call
     */
    public static async detectProjectAutomatically(): Promise<ProjectInfo | undefined> {
        ExtensionOutputChannel.info(
            this.LOG_SOURCE,
            'Automatic project detection will be implemented via external npm library',
        );

        // TODO: Call external npm lib here
        // Example: return await winccoaProjectDetector.detect();

        return undefined;
    }
}
