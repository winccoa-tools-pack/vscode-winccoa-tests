import * as vscode from 'vscode';
import { WinCCOATestController } from './testController';
import { ExtensionOutputChannel } from './extensionOutput';

let testController: WinCCOATestController | undefined;

export function activate(context: vscode.ExtensionContext) {
    // Initialize extension output channel
    ExtensionOutputChannel.initialize();
    ExtensionOutputChannel.info('Extension', 'WinCC OA Test Explorer activating...');

    // Initialize Test Controller
    testController = new WinCCOATestController(context);
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa-tests.refreshTests', () => {
            ExtensionOutputChannel.info('Extension', 'Refreshing tests...');
            testController?.refreshTests();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa-tests.runAllTests', () => {
            ExtensionOutputChannel.info('Extension', 'Running all tests...');
            testController?.runAllTests();
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('winccoaTests.logLevel')) {
                ExtensionOutputChannel.updateLogLevel();
            }
            if (e.affectsConfiguration('winccoaTests.testDiscoveryMode')) {
                ExtensionOutputChannel.info('Extension', 'Test discovery mode changed - refreshing tests...');
                testController?.refreshTests();
            }
        })
    );

    // Setup Core extension integration for automatic mode
    setupCoreExtensionIntegration(context);

    ExtensionOutputChannel.success('Extension', 'WinCC OA Test Explorer activated and ready');
}

export function deactivate() {
    if (testController) {
        testController.dispose();
        testController = undefined;
    }
}

async function setupCoreExtensionIntegration(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('winccoaTests');
    const discoveryMode = config.get<string>('testDiscoveryMode', 'automatic');

    if (discoveryMode !== 'automatic') {
        ExtensionOutputChannel.debug('CoreIntegration', 'Not in automatic mode - Core extension integration disabled');
        return;
    }

    const coreExtension = vscode.extensions.getExtension('winccoa-tools-pack.winccoa-core');
    
    if (!coreExtension) {
        ExtensionOutputChannel.warn('CoreIntegration', 'WinCC OA Core extension not found - automatic mode will fall back to workspace mode');
        return;
    }

    if (!coreExtension.isActive) {
        ExtensionOutputChannel.debug('CoreIntegration', 'Activating Core extension...');
        try {
            await coreExtension.activate();
        } catch (error) {
            const err = error as Error;
            ExtensionOutputChannel.error('CoreIntegration', `Failed to activate Core extension: ${err.message}`, err);
            return;
        }
    }

    const coreApi = coreExtension.exports;
    
    if (!coreApi || !coreApi.onDidChangeProject) {
        ExtensionOutputChannel.warn('CoreIntegration', 'Core extension API not available');
        return;
    }

    // Subscribe to project changes
    context.subscriptions.push(
        coreApi.onDidChangeProject((project: any) => {
            if (project) {
                ExtensionOutputChannel.info('CoreIntegration', `Project changed: ${project.name || 'Unknown'} - refreshing tests...`);
                testController?.refreshTests();
            } else {
                ExtensionOutputChannel.info('CoreIntegration', 'No project selected - clearing tests');
                testController?.refreshTests();
            }
        })
    );

    const currentProject = coreApi.getCurrentProject();
    if (currentProject) {
        ExtensionOutputChannel.info('CoreIntegration', `Connected to Core extension - current project: ${currentProject.name || 'Unknown'}`);
    } else {
        ExtensionOutputChannel.debug('CoreIntegration', 'Connected to Core extension - no project currently selected');
    }
}
