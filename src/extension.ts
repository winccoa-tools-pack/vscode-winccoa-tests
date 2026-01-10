// src/extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // Register a simple command
    const disposable = vscode.commands.registerCommand('winccoa.helloWorld', () => {
        vscode.window.showInformationMessage('Hello from WinCC OA VS Code Extension!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Clean up if needed
}
