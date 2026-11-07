import * as assert from 'assert';
import * as vscode from 'vscode';
import { ClassHierarchy, TestParser } from '../../testParser.js';

suite('TestParser inheritance detection', () => {
    const fixture = `class ElexFixture : OaTest
{
  protected int _helper() { return 0; }
};`;

    const derivedTest = `#uses "classes/oaTest/OaTest"
#uses "tests/ElexFixture"

class TestEngineeringContext : ElexFixture
{
  public int test_loadsProfile()
  {
    return 0;
  }
};

void main(...) {}`;

    function hierarchyOf(files: Record<string, string>): ClassHierarchy {
        const hierarchy = new ClassHierarchy();
        for (const [file, content] of Object.entries(files)) {
            hierarchy.setFile(file, content);
        }
        return hierarchy;
    }

    function parse(content: string, hierarchy: ClassHierarchy) {
        return TestParser.parseContent(
            vscode.Uri.file('/proj/scripts/Test.ctl'),
            content,
            hierarchy,
        );
    }

    test('finds a class inheriting OaTest directly', () => {
        const content = `class DirectTest : OaTest
{
  public int test_a() { return 0; }
};`;
        const parsed = parse(content, hierarchyOf({ a: content }));

        assert.deepStrictEqual(
            parsed?.testClasses.map((c) => c.className),
            ['DirectTest'],
        );
    });

    test('finds a class inheriting OaTest through a fixture in another file', () => {
        const parsed = parse(derivedTest, hierarchyOf({ fixture, test: derivedTest }));

        assert.strictEqual(parsed?.testClasses.length, 1);
        assert.strictEqual(parsed?.testClasses[0].className, 'TestEngineeringContext');
        assert.deepStrictEqual(parsed?.testClasses[0].testCases, [
            { id: 'test_loadsProfile', line: 6 },
        ]);
        assert.strictEqual(parsed?.supportsIndividualTests, true);
    });

    test('follows multi-level inheritance chains', () => {
        const middle = 'class SpecialFixture : ElexFixture {};';
        const content = `class DeepTest : SpecialFixture
{
  public int test_deep() { return 0; }
};`;
        const parsed = parse(content, hierarchyOf({ fixture, middle, content }));

        assert.strictEqual(parsed?.testClasses[0].className, 'DeepTest');
    });

    test('ignores the derived test when its fixture file is unknown', () => {
        assert.strictEqual(parse(derivedTest, hierarchyOf({ test: derivedTest })), undefined);
    });

    test('ignores classes not inheriting OaTest and base names only prefixed with OaTest', () => {
        const content = `class Helper : SomeBase
{
  public int test_notATest() { return 0; }
};
class Other : OaTestBaseLike
{
  public int test_notATestEither() { return 0; }
};`;
        assert.strictEqual(parse(content, hierarchyOf({ content })), undefined);
    });

    test('terminates on cyclic inheritance', () => {
        const content = `class A : B { public int test_a() { return 0; } };
class B : A {};`;
        assert.strictEqual(parse(content, hierarchyOf({ content })), undefined);
    });

    test('setFile replaces the classes previously declared in the same file', () => {
        const hierarchy = hierarchyOf({ fixture, test: derivedTest });
        hierarchy.setFile('fixture', 'class ElexFixture : NotATest {};');

        assert.strictEqual(parse(derivedTest, hierarchy), undefined);
    });
});
