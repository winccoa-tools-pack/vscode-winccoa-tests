import * as vscode from 'vscode';
import { ExtensionOutputChannel } from './extensionOutput.js';

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
    supportsIndividualTests: boolean;
}

const OA_TEST_BASE_CLASS = 'OaTest';

/**
 * Base classes of all CTRL classes declared in the scanned files, so test classes that
 * inherit OaTest through fixtures (class MyTest : MyFixture, MyFixture : OaTest) are found.
 */
export class ClassHierarchy {
    private readonly basesByFile = new Map<string, Map<string, string>>();

    public setFile(filePath: string, content: string): void {
        this.basesByFile.set(filePath, TestParser.findClassBases(content));
    }

    public inheritsFromOaTest(className: string, visited = new Set<string>()): boolean {
        if (className === OA_TEST_BASE_CLASS) {
            return true;
        }
        if (visited.has(className)) {
            return false;
        }
        visited.add(className);

        for (const bases of this.basesByFile.values()) {
            const base = bases.get(className);
            if (base && this.inheritsFromOaTest(base, visited)) {
                return true;
            }
        }
        return false;
    }
}

/**
 * Parser for WinCC OA CTRL test files
 * Searches for classes that inherit from OaTest, directly or through other classes
 */
export class TestParser {
    private static readonly LOG_SOURCE = 'TestParser';

    // Regex patterns
    private static readonly CLASS_PATTERN = /\bclass\s+(\w+)\s*:\s*(\w+)/g;
    private static readonly GET_ALL_TEST_CASE_IDS_PATTERN =
        /getAllTestCaseIds\s*\(\s*\)\s*\{([^}]+)\}/s;
    private static readonly MAKE_DYN_STRING_PATTERN = /makeDynString\s*\(([\s\S]*?)\)/;
    private static readonly STRING_LITERAL_PATTERN = /"([^"]+)"/g;
    // 3.20 format: public int test*() methods
    private static readonly TEST_METHOD_PATTERN = /public\s+int\s+(test\w*)\s*\(/gm;
    // Pattern for main function with varargs (for command line arguments)
    private static readonly MAIN_WITH_VARARGS_PATTERN = /\b(void\s+)?main\s*\(\s*\.\.\.\s*\)/;

    public static async readContent(fileUri: vscode.Uri): Promise<string> {
        return Buffer.from(await vscode.workspace.fs.readFile(fileUri)).toString('utf-8');
    }

    /**
     * Parse CTRL file content for test classes and test cases
     */
    public static parseContent(
        fileUri: vscode.Uri,
        content: string,
        hierarchy: ClassHierarchy,
    ): ParsedTestFile | undefined {
        try {
            ExtensionOutputChannel.debug(this.LOG_SOURCE, `Parsing file: ${fileUri.fsPath}`);

            // Find all test classes
            const testClasses = this.findTestClasses(content, hierarchy);

            if (testClasses.length === 0) {
                ExtensionOutputChannel.trace(
                    this.LOG_SOURCE,
                    `No OaTest classes found in: ${fileUri.fsPath}`,
                );
                return undefined;
            }

            ExtensionOutputChannel.info(
                this.LOG_SOURCE,
                `Found ${testClasses.length} test class(es) in: ${fileUri.fsPath}`,
            );

            // Check if file supports individual test execution
            const supportsIndividualTests = this.checkSupportsIndividualTests(content);

            if (supportsIndividualTests) {
                ExtensionOutputChannel.debug(
                    this.LOG_SOURCE,
                    `File supports individual test execution: ${fileUri.fsPath}`,
                );
            } else {
                ExtensionOutputChannel.debug(
                    this.LOG_SOURCE,
                    `File does NOT support individual test execution: ${fileUri.fsPath}`,
                );
            }

            return {
                fileUri,
                testClasses,
                supportsIndividualTests,
            };
        } catch (error) {
            ExtensionOutputChannel.error(
                this.LOG_SOURCE,
                `Failed to parse file: ${fileUri.fsPath}`,
                error as Error,
            );
            return undefined;
        }
    }

    /**
     * Map of class name to base class name for every derived class declared in the content
     */
    public static findClassBases(content: string): Map<string, string> {
        const bases = new Map<string, string>();
        for (const match of content.matchAll(this.CLASS_PATTERN)) {
            bases.set(match[1], match[2]);
        }
        return bases;
    }

    /**
     * Find all test classes in file content
     */
    public static findTestClasses(content: string, hierarchy: ClassHierarchy): ParsedTestClass[] {
        const testClasses: ParsedTestClass[] = [];

        for (const match of content.matchAll(this.CLASS_PATTERN)) {
            const className = match[1];
            const classPosition = match.index;

            if (!hierarchy.inheritsFromOaTest(match[2])) {
                continue;
            }

            // Find line number
            const line = content.substring(0, classPosition).split('\n').length;

            ExtensionOutputChannel.debug(
                this.LOG_SOURCE,
                `Found test class: ${className} at line ${line}`,
            );

            // Extract class body (rough extraction) - returns { body, startLine }
            const classBodyInfo = this.extractClassBody(content, classPosition);

            // Find test cases in class body
            const testCases = this.extractTestCases(classBodyInfo.body, classBodyInfo.startLine);

            if (testCases.length > 0) {
                testClasses.push({
                    className,
                    line,
                    testCases,
                });
                ExtensionOutputChannel.debug(
                    this.LOG_SOURCE,
                    `Class ${className} has ${testCases.length} test case(s)`,
                );
            }
        }

        return testClasses;
    }

    /**
     * Extract class body (simple brace matching)
     */
    private static extractClassBody(
        content: string,
        startPosition: number,
    ): { body: string; startLine: number } {
        let braceCount = 0;
        const startBrace = content.indexOf('{', startPosition);

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
            startLine,
        };
    }

    /**
     * Extract test cases from class body
     * Supports both 3.19 format (getAllTestCaseIds + switch/case) and 3.20 format (public test methods)
     */
    private static extractTestCases(
        classBody: string,
        classBodyStartLine: number,
    ): ParsedTestCase[] {
        // Try 3.19 format first (getAllTestCaseIds method)
        const testCases319 = this.extractTestCases319(classBody, classBodyStartLine);
        if (testCases319.length > 0) {
            ExtensionOutputChannel.debug(
                this.LOG_SOURCE,
                `Using 3.19 format (getAllTestCaseIds): ${testCases319.length} test(s)`,
            );
            return testCases319;
        }

        // Try 3.20 format (public int test*() methods)
        const testCases320 = this.extractTestCases320(classBody, classBodyStartLine);
        if (testCases320.length > 0) {
            ExtensionOutputChannel.debug(
                this.LOG_SOURCE,
                `Using 3.20 format (test methods): ${testCases320.length} test(s)`,
            );
            return testCases320;
        }

        ExtensionOutputChannel.warn(this.LOG_SOURCE, 'No test cases found in either format');
        return [];
    }

    /**
     * Extract test cases from getAllTestCaseIds method (3.19 format)
     */
    private static extractTestCases319(
        classBody: string,
        classBodyStartLine: number,
    ): ParsedTestCase[] {
        const testCases: ParsedTestCase[] = [];

        // Find getAllTestCaseIds method
        const methodMatch = this.GET_ALL_TEST_CASE_IDS_PATTERN.exec(classBody);
        if (!methodMatch) {
            ExtensionOutputChannel.trace(
                this.LOG_SOURCE,
                'getAllTestCaseIds method not found (not 3.19 format)',
            );
            return testCases;
        }

        const methodBody = methodMatch[1];

        // Find makeDynString call
        const makeDynStringMatch = this.MAKE_DYN_STRING_PATTERN.exec(methodBody);
        if (!makeDynStringMatch) {
            ExtensionOutputChannel.trace(
                this.LOG_SOURCE,
                'makeDynString not found in getAllTestCaseIds',
            );
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
                line: caseLine,
            });
            ExtensionOutputChannel.trace(
                this.LOG_SOURCE,
                `Found test case (3.19): ${testCaseId}${caseLine ? ` at line ${caseLine}` : ''}`,
            );
        }

        return testCases;
    }

    /**
     * Extract test cases from public test methods (3.20 format)
     */
    private static extractTestCases320(
        classBody: string,
        classBodyStartLine: number,
    ): ParsedTestCase[] {
        const testCases: ParsedTestCase[] = [];

        // Find all public int test*() methods
        let match;
        this.TEST_METHOD_PATTERN.lastIndex = 0;
        while ((match = this.TEST_METHOD_PATTERN.exec(classBody)) !== null) {
            const methodName = match[1];
            const matchPosition = match.index;

            // Calculate absolute line number
            const linesBeforeMatch = classBody.substring(0, matchPosition).split('\n').length;
            const absoluteLine = classBodyStartLine + linesBeforeMatch - 1;

            testCases.push({
                id: methodName,
                line: absoluteLine,
            });
            ExtensionOutputChannel.trace(
                this.LOG_SOURCE,
                `Found test method (3.20): ${methodName} at line ${absoluteLine}`,
            );
        }

        return testCases;
    }

    /**
     * Find the line number of a case statement in the switch
     */
    private static findCaseLineNumber(
        classBody: string,
        testCaseId: string,
        classBodyStartLine: number,
    ): number | undefined {
        // Pattern: case "testCaseId":
        const casePattern = new RegExp(
            `case\\s+"${testCaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*:`,
            'm',
        );
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
     * Check if file supports individual test execution
     * Requirements:
     * 1. main() function has varargs: void main(...)
     * 2. This allows passing -ETM.oaTest.testCases=<testcase> via command line
     */
    private static checkSupportsIndividualTests(content: string): boolean {
        try {
            // Check: main function with varargs (...) for command line arguments
            if (!this.MAIN_WITH_VARARGS_PATTERN.test(content)) {
                ExtensionOutputChannel.debug(this.LOG_SOURCE, 'No main(...) signature found');
                return false;
            }

            ExtensionOutputChannel.debug(
                this.LOG_SOURCE,
                'File supports individual test execution ✓ (has main(...) with varargs)',
            );
            return true;
        } catch (error) {
            ExtensionOutputChannel.warn(
                this.LOG_SOURCE,
                `Error checking individual test support - defaulting to false: ${error}`,
            );
            return false;
        }
    }
}
