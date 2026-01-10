import path from 'path';
import fs from 'fs';

import { ProjEnvProject } from '@winccoa-tools-pack/npm-winccoa-core/types/project/ProjEnvProject';
import {
    getWinCCOAInstallationPathByVersion,
    getAvailableWinCCOAVersions,
} from '@winccoa-tools-pack/npm-winccoa-core';

// Use CommonJS __filename and __dirname directly

/**
 * Gets the absolute path to the test fixtures directory
 */
export function getFixturesPath(): string {
    return path.resolve(__dirname, '..', '..', 'test', 'fixtures');
}

/**
 * Gets the absolute path to a test project fixture
 * @param projectName Name of the test project (e.g., 'runnable', 'sub-proj')
 */
export function getTestProjectPath(projectName: string): string {
    return path.join(getFixturesPath(), 'projects', projectName);
}

/**
 * Creates and registers a runnable WinCC OA test project
 * @returns ProjEnvProject instance for the registered test project
 * @throws Error if registration fails
 *
 * @example
 * ```typescript
 * const project = await registerRunnableTestProject();
 * try {
 *   // Use project in tests
 *   await project.start();
 * } finally {
 *   await project.unregisterProj();
 * }
 * ```
 */
export async function registerRunnableTestProject(): Promise<ProjEnvProject> {
    const subProjectPath = getTestProjectPath('sub-proj');
    const subProject: ProjEnvProject = new ProjEnvProject();

    // Set project directory (this sets both install dir and project ID)
    subProject.setRunnable(false);
    subProject.setDir(subProjectPath);
    subProject.setName('test-sub-project');
    const availableVersions = getAvailableWinCCOAVersions();
    const testVersion = availableVersions.length > 0 ? availableVersions[0] : '';
    subProject.setVersion(testVersion);
    await subProject.registerProj();

    const projectPath = getTestProjectPath('runnable');
    const project = new ProjEnvProject();

    // Set project directory (this sets both install dir and project ID)
    project.setRunnable(true);
    project.setDir(projectPath);
    project.setName('test-runnable-project');

    project.setVersion(testVersion);

    // Update config file with actual WinCC OA path and version
    const configPath = path.join(projectPath, 'config', 'config');
    if (fs.existsSync(configPath)) {
        try {
            // Get the first available WinCC OA version for testing

            const testPath = getWinCCOAInstallationPathByVersion(testVersion);

            if (testPath) {
                // Read the config file
                let configContent = fs.readFileSync(configPath, 'utf-8');

                // Replace placeholders with actual values
                configContent = configContent.replace(/<WinCC_OA_PATH>/g, testPath);
                configContent = configContent.replace(/<WinCC_OA_VERSION>/g, testVersion);

                // Write back the updated config
                fs.writeFileSync(configPath, configContent, 'utf-8');
            }
        } catch (error) {
            console.warn('Warning: Could not update test project config file:', error);
        }
    }

    // Try to register the project with WinCC OA if pmon is available
    // If pmon is not initialized, we still return the project object for testing
    try {
        const result = await project.registerProj();
        if (result !== 0) {
            console.warn(
                `Warning: Could not register test project (pmon may not be available): error code ${result}`,
            );
        }
    } catch (error) {
        console.warn(`Warning: Project registration failed (pmon may not be available):`, error);
    }

    return project;
}

/**
 * Unregisters and cleans up a test project
 * @param project The project to unregister
 * @returns Promise that resolves when cleanup is complete
 */
export async function unregisterTestProject(project: ProjEnvProject): Promise<void> {
    if (!project || !project.getId()) {
        return;
    }

    try {
        // Stop the project if it's running
        if (project.isRunning()) {
            await project.stop();
        }

        const subProject = new ProjEnvProject();
        subProject.setId('sub-proj');
        subProject.setRunnable(false);
        subProject.setVersion(project.getVersion() || '');
        await subProject.unregisterProj();

        // Unregister the project
        await project.unregisterProj();
    } catch (error) {
        console.warn(`Warning: Failed to clean up test project ${project.getId()}:`, error);
    }
}

/**
 * Helper to run a test with a registered project that gets automatically cleaned up
 * @param testFn Test function that receives the registered project
 *
 * @example
 * ```typescript
 * it('should test project functionality', async () => {
 *   await withRunnableTestProject(async (project) => {
 *     await project.start();
 *     assert.ok(project.isRunning());
 *   });
 * });
 * ```
 */
export async function withRunnableTestProject(
    testFn: (project: ProjEnvProject) => Promise<void>,
): Promise<void> {
    let project: ProjEnvProject | undefined;

    try {
        project = await registerRunnableTestProject();
        await testFn(project);
    } finally {
        if (project) {
            await unregisterTestProject(project);
        }
    }
}
