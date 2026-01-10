import { describe, it } from 'node:test';
import { strict as assert } from 'assert';
import {
    registerRunnableTestProject,
    unregisterTestProject,
    withRunnableTestProject,
} from '../test-project-helpers';

describe('Test Project Helpers Example', () => {
    // Example 1: Manual registration and cleanup
    it('should register and unregister test project manually', async () => {
        let project;
        try {
            project = await registerRunnableTestProject();

            assert.ok(project, 'Project should be created');
            assert.ok(project.getId(), 'Project should have an ID');
            assert.ok(project.isRegistered(), 'Project should be registered');
        } finally {
            if (project) {
                await unregisterTestProject(project);
            }
        }
    });

    // Example 2: Using the helper wrapper (automatic cleanup)
    it('should use project with automatic cleanup', async () => {
        await withRunnableTestProject(async (project) => {
            assert.ok(project.getId(), 'Project should have an ID');
            console.log(`Using test project with ID: ${project.getId()}`);
            assert.ok(project.isRegistered(), 'Project should be registered');

            // Your test logic here
            // Project will be automatically unregistered after this block
        });
    });
});
