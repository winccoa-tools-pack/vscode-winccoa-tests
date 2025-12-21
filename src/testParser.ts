import * as vscode from 'vscode';
import { ExtensionOutputChannel } from './extensionOutput';

/**
 * Represents a parsed test case from CTRL code
 */
export interface ParsedTestCase {
    id: string;
    line?: number;
}

/**
 * Represents a parsed test class from CTRL code
 */
export interface ParsedTestClass {
    className: string;
    line: number;
    testCases: ParsedTestCase[];
}

/**
 * Result of parsing a CTRL test file
 */
export interface ParsedTestFile {
    fileUri: vscode.Uri;
    testClasses: ParsedTestClass[];
}

/**
 * Parser for WinCC OA CTRL test files
 * Searches for classes that inherit from OaTest
 */
export class TestParser {
    private static readonly LOG_SOURCE = 'TestParser';

    // Regex patterns
    private static readonly CLASS_PATTERN = /class\s+(\w+)\s*:\s*OaTest/g;
    private static readonly GET_ALL_TEST_CASE_IDS_PATTERN = /getAllTestCaseIds\s*\(\s*\)\s*\{([^}]+)\}/s;
    private static readonly MAKE_DYN_STRING_PATTERN = /makeDynString\s*\(([\s\S]*?)\)/;
    private static readonly STRING_LITERAL_PATTERN = /"([^"]+)"/g;

    /**
     * Parse a CTRL file for test classes and test cases
     */
    public static async parseFile(fileUri: vscode.Uri): Promise<ParsedTestFile | undefined> {
        try {
            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Parsing file: ${fileUri.fsPath}`);

            // Read file content
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();

            // Find all test classes
            const testClasses = this.findTestClasses(content);

            if (testClasses.length === 0) {
                ExtensionOutputChannel.trace(this.LOG_SOURCE, `No OaTest classes found in: ${fileUri.fsPath}`);
                return undefined;
            }

            ExtensionOutputChannel.info(this.LOG_SOURCE, `Found ${testClasses.length} test class(es) in: ${fileUri.fsPath}`);

            return {
                fileUri,
                testClasses
            };
        } catch (error) {
            ExtensionOutputChannel.error(this.LOG_SOURCE, `Failed to parse file: ${fileUri.fsPath}`, error as Error);
            return undefined;
        }
    }

    /**
     * Find all test classes in file content
     */
    private static findTestClasses(content: string): ParsedTestClass[] {
        const testClasses: ParsedTestClass[] = [];
        const lines = content.split('\n');

        // Find all classes that inherit from OaTest
        let match;
        this.CLASS_PATTERN.lastIndex = 0;
        while ((match = this.CLASS_PATTERN.exec(content)) !== null) {
            const className = match[1];
            const classPosition = match.index;

            // Find line number
            const line = content.substring(0, classPosition).split('\n').length;

            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Found test class: ${className} at line ${line}`);

            // Extract class body (rough extraction) - returns { body, startLine }
            const classBodyInfo = this.extractClassBody(content, classPosition);

            // Find test cases in class body
            const testCases = this.extractTestCases(classBodyInfo.body, classBodyInfo.startLine);

            if (testCases.length > 0) {
                testClasses.push({
                    className,
                    line,
                    testCases
                });
                ExtensionOutputChannel.debug(this.LOG_SOURCE, `Class ${className} has ${testCases.length} test case(s)`);
            }
        }

        return testClasses;
    }

    /**
     * Extract class body (simple brace matching)
     */
    private static extractClassBody(content: string, startPosition: number): { body: string; startLine: number } {
        let braceCount = 0;
        let startBrace = content.indexOf('{', startPosition);
        
        if (startBrace === -1) {
            return { body: '', startLine: 0 };
        }

        // Calculate the line number where the class body starts
        const startLine = content.substring(0, startBrace).split('\n').length;

        let endBrace = startBrace;
        for (let i = startBrace; i < content.length; i++) {
            if (content[i] === '{') {
                braceCount++;
            } else if (content[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    endBrace = i;
                    break;
                }
            }
        }

        return {
            body: content.substring(startBrace, endBrace + 1),
            startLine
        };
    }

    /**
     * Extract test cases from getAllTestCaseIds method
     */
    private static extractTestCases(classBody: string, classBodyStartLine: number): ParsedTestCase[] {
        const testCases: ParsedTestCase[] = [];

        // Find getAllTestCaseIds method
        const methodMatch = this.GET_ALL_TEST_CASE_IDS_PATTERN.exec(classBody);
        if (!methodMatch) {
            ExtensionOutputChannel.trace(this.LOG_SOURCE, 'getAllTestCaseIds method not found');
            return testCases;
        }

        const methodBody = methodMatch[1];

        // Find makeDynString call
        const makeDynStringMatch = this.MAKE_DYN_STRING_PATTERN.exec(methodBody);
        if (!makeDynStringMatch) {
            ExtensionOutputChannel.trace(this.LOG_SOURCE, 'makeDynString not found in getAllTestCaseIds');
            return testCases;
        }

        const argumentsString = makeDynStringMatch[1];

        // Extract all string literals
        let stringMatch;
        this.STRING_LITERAL_PATTERN.lastIndex = 0;
        while ((stringMatch = this.STRING_LITERAL_PATTERN.exec(argumentsString)) !== null) {
            const testCaseId = stringMatch[1];
            
            // Find the line number of the corresponding case statement (absolute line in file)
            const caseLine = this.findCaseLineNumber(classBody, testCaseId, classBodyStartLine);
            
            testCases.push({
                id: testCaseId,
                line: caseLine
            });
            ExtensionOutputChannel.trace(this.LOG_SOURCE, `Found test case: ${testCaseId}${caseLine ? ` at line ${caseLine}` : ''}`);
        }

        return testCases;
    }

    /**
     * Find the line number of a case statement in the switch
     */
    private static findCaseLineNumber(classBody: string, testCaseId: string, classBodyStartLine: number): number | undefined {
        // Pattern: case "testCaseId":
        const casePattern = new RegExp(`case\\s+"${testCaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`, 'm');
        const match = casePattern.exec(classBody);
        
        if (match) {
            // Count lines before the match within class body
            const linesBeforeMatchInBody = classBody.substring(0, match.index).split('\n').length;
            // Add to class body start line to get absolute line number
            return classBodyStartLine + linesBeforeMatchInBody - 1;
        }
        
        return undefined;
    }

    /**
     * Quick check if file contains OaTest class (for performance)
     */
    public static async containsOaTest(fileUri: vscode.Uri): Promise<boolean> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const content = document.getText();
            
            // Quick check without full parsing
            return content.includes(': OaTest') || content.includes(':OaTest');
        } catch (error) {
            return false;
        }
    }
}
