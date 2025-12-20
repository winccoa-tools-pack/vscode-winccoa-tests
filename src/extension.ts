import * as vscode from 'vscode';
import { WinCCOATestController } from './testController';

let testController: WinCCOATestController | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('WinCC OA Test Explorer is now active');

    // Create output channel for logging
    const outputChannel = vscode.window.createOutputChannel('WinCC OA Tests');
    outputChannel.appendLine('WinCC OA Test Explorer activated');

    // Initialize Test Controller
    testController = new WinCCOATestController(context, outputChannel);
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa-tests.refreshTests', () => {
            outputChannel.appendLine('Refreshing tests...');
            testController?.refreshTests();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('winccoa-tests.runAllTests', () => {
            outputChannel.appendLine('Running all tests...');
            testController?.runAllTests();
        })
    );

    outputChannel.appendLine('WinCC OA Test Explorer ready');
}

export function deactivate() {
    if (testController) {
        testController.dispose();
        testController = undefined;
    }
}
