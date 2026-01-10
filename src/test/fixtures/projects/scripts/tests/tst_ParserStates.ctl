// $License: NOLICENSE
/** Parser state generator tests for OaTestBase/OaTest.
 *
 * Ziel: Alle Zustände und typische Kombinationen von Assert-Resultaten erzeugen,
 * damit du daraus robuste Parser-Regeln bauen kannst.
 *
 * @file $relPath
 * @test Parser state generator for oaTest logs
 */

//--------------------------------------------------------------------------------
// Libraries used (#uses)
#uses "classes/oaTest/OaTest"
#uses "CtrlOaUnit"
//--------------------------------------------------------------------------------

class TstParserStates : OaTest
{
  //------------------------------------------------------------------------------
  protected dyn_string getAllTestCaseIds()
  {
    // Reihenfolge ist wichtig:
    // - erst "harmlose" Fälle
    // - abort/unknownFunction ganz am Ende
    return makeDynString(
             "tc_01_pass_only",
             "tc_02_single_fail",
             "tc_03_pass_then_fail",
             "tc_04_multi_fail_same_tc",
             "tc_05_assertPass_assertFail_mix",
             "tc_06_compare_mix_pass_fail",
             "tc_07_string_mix_pass_fail",
             "tc_08_fileExists_pass_fail",
             "tc_09_messages_info_pass_fail",
             "tc_10_abort_explicit_unknownFunction_note",
             "tc_11_pass_after_pass"
             // "tc_99_runtime_unknown_function" // optional, siehe unten
           );
  }

  //------------------------------------------------------------------------------
  protected int startTestCase(const string &tcId)
  {
    switch (tcId)
    {
      //----------------------------------------------------------------------------
      case "tc_01_pass_only":
      {
        // === Arrange ===
        info("tc_01 Arrange: dummy values");
        int a = 42;
        string s = "winccoa";

        // === Act ===
        // (nichts)

        // === Assert ===
        assertEqual(a, 42, "pass: int equal");
        assertNotEqual(a, 0, "pass: int not equal");
        assertTrue(TRUE, "pass: true");
        assertFalse(FALSE, "pass: false");
        assertStartsWith("winccoa-vscode", s, "pass: startsWith");
        assertContains("winccoa-vscode", "vscode", "pass: contains");

        pass("tc_01 done: should be PASS");
        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_02_single_fail":
      {
        // === Arrange ===
        info("tc_02 Arrange: one fail expected");
        int x = 1;

        // === Act ===
        // (nichts)

        // === Assert ===
        assertEqual(x, 0, "FAIL: 1 != 0 (single fail testcase)");

        // danach noch ein pass-assert, damit du "fail then pass" auch im Log hast
        assertTrue(TRUE, "PASS after fail (should still be logged)");

        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_03_pass_then_fail":
      {
        // === Arrange ===
        info("tc_03 Arrange: pass then fail sequence");
        int p = 10;
        int q = 10;

        // === Act ===
        q = q + 1; // q = 11

        // === Assert ===
        assertEqual(p, 10, "PASS: sanity");
        assertEqual(q, 11, "PASS: act check");
        assertEqual(p, q, "FAIL: 10 != 11 (pass->fail pattern)");
        assertNotEqual("abc", "abc", "FAIL: notEqual should fail here");

        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_04_multi_fail_same_tc":
      {
        // === Arrange ===
        info("tc_04 Arrange: multiple failures in a single test case");
        int a = 5;
        int b = 7;

        // === Act ===
        // (nichts)

        // === Assert ===
        // Mehrere FAILs, damit dein Parser "mehrere Fehler pro TC" sauber kann.
        assertEqual(a, b, "FAIL #1: 5 != 7");
        assertGreater(a, b, "FAIL #2: 5 is not greater than 7");
        assertLess(b, 3, "FAIL #3: 7 is not less than 3");
        assertFalse(TRUE, "FAIL #4: condition is TRUE");
        assertTrue(FALSE, "FAIL #5: condition is FALSE");

        // und ein PASS dazwischen (mixed ordering)
        //assertEqual("x", "x", "PASS in the middle of multi-fail");

        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_05_assertPass_assertFail_mix":
      {
        // === Arrange ===
        info("tc_05 Arrange: assertPass/assertFail plus normal asserts");

        // === Act ===
        // (nichts)

        // === Assert ===
        pass("assertPass (should log as PASS-assert)");
        assertEqual(1, 1, "PASS: 1 == 1");

        // bewusst FAIL-Assert
        fail("assertFail (should log as FAIL-assert)");

        // noch ein normaler FAIL hinterher
        assertContains("abc", "z", "FAIL: 'abc' does not contain 'z'");

        // und noch ein PASS danach
        assertStartsWith("abcdef", "abc", "PASS after failures");

        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_06_compare_mix_pass_fail":
      {
        // === Arrange ===
        info("tc_06 Arrange: compare asserts mix");
        int lo = 1;
        int mid = 5;
        int hi = 10;

        // === Act ===
        mid = mid; // noop

        // === Assert ===
        assertGreater(mid, lo, "PASS: 5 > 1");
        assertLess(mid, hi, "PASS: 5 < 10");

        // FAIL variants
        assertGreater(lo, hi, "FAIL: 1 > 10 false");
        assertLess(hi, lo, "FAIL: 10 < 1 false");

        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_07_string_mix_pass_fail":
      {
        // === Arrange ===
        info("tc_07 Arrange: string asserts mix");
        string full = "winccoa-vscode-extension";

        // === Act ===
        // (nichts)

        // === Assert ===
        assertStartsWith(full, "winccoa", "PASS: startsWith winccoa");
        assertContains(full, "vscode", "PASS: contains vscode");

        // FAIL variants
        assertStartsWith(full, "banana", "FAIL: wrong prefix");
        assertContains(full, "cherry", "FAIL: missing substring");

        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_08_fileExists_pass_fail":
      {
        // === Arrange ===
        info("tc_08 Arrange: fileExists pass+fail");
        string likelyExists = "."; // directory should exist on most setups
        string likelyMissing = "Z:/__oaTest__/definitely_missing_file_12345.txt";

        // === Act ===
        // (nichts)

        // === Assert ===
        assertFileExists(likelyExists, "PASS expected: '.' exists");
        assertFileExists(likelyMissing, "FAIL expected: missing path");

        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_09_messages_info_pass_fail":
      {
        // === Arrange ===
        info("tc_09 Arrange: emit various messages");
        int v = 2;

        // === Act ===
        info("tc_09 Act: doing nothing, just logging");
        pass("tc_09 mid: explicit pass() message (not an assert)");

        // === Assert ===
        assertEqual(v, 2, "PASS assert");
        fail("tc_09 explicit fail() message (not an assert)"); // erzeugt FAIL output ohne assert
        assertEqual(v, 3, "FAIL assert after fail() message");

        return 0;
      }

      //----------------------------------------------------------------------------
      case "tc_10_abort_explicit_unknownFunction_note":
      {
        // === Arrange ===
        info("tc_10 Arrange: produce aborted state via abort()");
        int x = 1;

        // === Act ===
        // Erst noch ein bisschen Log-Material
        assertEqual(x, 1, "PASS before abort");
        assertEqual(x, 0, "FAIL before abort");

        // === Assert / Abort ===
        // Wichtig: erzeugt zuverlässig einen ABORTED-Zustand, ohne den ganzen Run
        // durch echten Runtime-Error abzuschießen. Note enthält "unknownFunction".
        abort("ABORTED testcase (simulated unknownFunction)", "unknownFunction");

        // Code nach abort() wird je nach Implementierung evtl. nicht mehr sinnvoll ausgeführt.
        // Falls doch, ist es parser-seitig auch interessant:
        pass("This may or may not appear after abort");

        return 0;
      }

      case "tc_11_pass_after_pass":
      {
        // === Arrange ===
        info("tc_11 Arrange: multiple passes in a row");
        int a = 100;
        int b = 100;
        // === Act ===
        // (nichts)

        // === Assert ===
        assertEqual(a, b, "PASS #1: 100 == 100");
        assertTrue(TRUE, "PASS #2: TRUE is true");
        assertStartsWith("winccoa", "win", "PASS #3: startsWith win");
        pass("tc_11 done: should be PASS with multiple passes");
        return 0;
      }

        //----------------------------------------------------------------------------
        // OPTIONAL: echter Runtime-Error "unknown function".
        // WARNUNG: kann den Testlauf/Script hart beenden, je nach WinCC OA Runtime/Settings.
        /*
        case "tc_99_runtime_unknown_function":
        {
          info("tc_99: calling unknown function now - may terminate run");
          __THIS_FUNCTION_DOES_NOT_EXIST__(); // -> unknownFunction runtime error
          return 0;
        }
        */
    }

    return -1;
  }
};

//--------------------------------------------------------------------------------
main()
{
  TstParserStates test = TstParserStates();
  test.startAll();
  exit(0);
}
