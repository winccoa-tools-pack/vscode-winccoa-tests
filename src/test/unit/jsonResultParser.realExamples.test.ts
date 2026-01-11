import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { JsonResultParser } from '../../jsonResultParser.js';

suite('JsonResultParser Real Examples', () => {
    const examplesDir = path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'src',
        'test',
        'fixtures',
        'results-examples',
    );

    function listExampleFiles(): string[] {
        if (!fs.existsSync(examplesDir)) {
            return [];
        }
        return fs
            .readdirSync(examplesDir)
            .filter((f) => f.toLowerCase().endsWith('.json'))
            .map((f) => path.join(examplesDir, f))
            .sort();
    }

    test('Parses bundled real example JSONs (no Location field)', async () => {
        const exampleFiles = listExampleFiles();
        assert.ok(exampleFiles.length > 0, 'Expected at least one real example .json file');

        for (const exampleFile of exampleFiles) {
            const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'winccoa-real-example-'));
            try {
                fs.copyFileSync(exampleFile, path.join(tmpRoot, 'fullResult.json'));
                const results = await JsonResultParser.parseResults(tmpRoot);

                assert.ok(
                    results.size > 0,
                    `Expected parsed results for ${path.basename(exampleFile)}`,
                );

                let foundLocation = false;
                for (const testCase of results.values()) {
                    const assertion = testCase.assertions?.find(
                        (a: any) => a.location?.uri?.fsPath,
                    );
                    if (assertion) {
                        foundLocation = true;
                        break;
                    }
                }

                assert.ok(
                    foundLocation,
                    `Expected at least one assertion with a derived location for ${path.basename(exampleFile)}`,
                );
            } finally {
                try {
                    fs.rmSync(tmpRoot, { recursive: true, force: true });
                } catch {
                    // ignore
                }
            }
        }
    });
});
