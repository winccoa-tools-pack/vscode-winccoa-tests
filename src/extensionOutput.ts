import * as vscode from 'vscode';

export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    TRACE = 4,
}

const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.TRACE]: 'TRACE',
};

const LOG_LEVEL_ICONS: Record<LogLevel, string> = {
    [LogLevel.ERROR]: '❌',
    [LogLevel.WARN]: '⚠️',
    [LogLevel.INFO]: 'ℹ️',
    [LogLevel.DEBUG]: '🔍',
    [LogLevel.TRACE]: '🔬',
};

export class ExtensionOutputChannel {
    public static instance: vscode.OutputChannel;
    private static currentLogLevel: LogLevel = LogLevel.INFO;

    public static initialize(): vscode.OutputChannel {
        if (!ExtensionOutputChannel.instance) {
            ExtensionOutputChannel.instance = vscode.window.createOutputChannel('WinCC OA Tests');
        }

        // Read log level from configuration
        ExtensionOutputChannel.updateLogLevel();

        return ExtensionOutputChannel.instance;
    }

    public static updateLogLevel(): void {
        const config = vscode.workspace.getConfiguration('winccoaTests');
        const levelString = config.get<string>('logLevel', 'INFO');
        ExtensionOutputChannel.currentLogLevel =
            LogLevel[levelString as keyof typeof LogLevel] || LogLevel.INFO;

        ExtensionOutputChannel.log(LogLevel.INFO, 'Logger', `Log level set to: ${levelString}`);
    }

    private static log(level: LogLevel, source: string, message: string, error?: Error): void {
        if (!ExtensionOutputChannel.instance || level > ExtensionOutputChannel.currentLogLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = LOG_LEVEL_NAMES[level].padEnd(5);
        const icon = LOG_LEVEL_ICONS[level];
        const formattedSource = source.padEnd(20);

        let logMessage = `[${timestamp}] ${icon} ${levelName} [${formattedSource}] ${message}`;

        // Add stack trace for errors if available
        if (error && level === LogLevel.ERROR) {
            logMessage += `\n    Stack: ${error.stack || error.message}`;
        }

        ExtensionOutputChannel.instance.appendLine(logMessage);

        // Auto-show output on errors
        if (level === LogLevel.ERROR) {
            ExtensionOutputChannel.instance.show(true);
        }
    }

    // Public API methods
    public static error(source: string, message: string, error?: Error): void {
        ExtensionOutputChannel.log(LogLevel.ERROR, source, message, error);
    }

    public static warn(source: string, message: string): void {
        ExtensionOutputChannel.log(LogLevel.WARN, source, message);
    }

    public static info(source: string, message: string): void {
        ExtensionOutputChannel.log(LogLevel.INFO, source, message);
    }

    public static debug(source: string, message: string): void {
        ExtensionOutputChannel.log(LogLevel.DEBUG, source, message);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static trace(source: string, message: string, data?: any): void {
        let msg = message;
        if (data !== undefined) {
            msg += `\n    Data: ${JSON.stringify(data, null, 2)}`;
        }
        ExtensionOutputChannel.log(LogLevel.TRACE, source, msg);
    }

    // Convenience methods
    public static success(source: string, message: string): void {
        ExtensionOutputChannel.log(LogLevel.INFO, source, `✅ ${message}`);
    }

    public static show(): void {
        if (ExtensionOutputChannel.instance) {
            ExtensionOutputChannel.instance.show();
        }
    }
}
