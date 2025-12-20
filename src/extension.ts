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
        })
    );

    ExtensionOutputChannel.success('Extension', 'WinCC OA Test Explorer activated and ready');
}

export function deactivate() {
    if (testController) {
        testController.dispose();
        testController = undefined;
    }
}
