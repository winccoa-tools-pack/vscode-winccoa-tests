// $License: NOLICENSE
/** Timing tests for test execution queue validation.
 *
 * Contains tests with different execution durations to validate:
 * - Sequential execution when multiple tests run
 * - Queue mechanism preventing concurrent JSON file access
 * - Proper handling of short and long running tests
 *
 * @file tst_TimingTests.ctl
 * @test Timing and queue validation tests
 * @author testus
 */

//-----------------------------------------------------------------------------
// Libraries used (#uses)
#uses "classes/oaTest/OaTest" // oaTest basic class

//-----------------------------------------------------------------------------
// Variables and Constants

//-----------------------------------------------------------------------------
/** Timing Tests for Queue Validation
*/
class TstTimingTests : OaTest
{
  //---------------------------------------------------------------------------
  /**
    @test Very fast test - completes almost immediately.
   */
  public int testVeryFast()
  {
    // === Arrange ===
    int expected = 1;
    int actual = 1;

    // === Act ===
    // (no action needed)

    // === Assert ===
    this.assertEqual(actual, expected, "Fast assertion");
    this.assertTrue(true, "Another fast assertion");

    return 0;
  }

  //---------------------------------------------------------------------------
  /**
    @test Short test - takes about 1 second.
   */
  public int testShort()
  {
    // === Arrange ===
    this.pass("Starting short test (1 second)");
    string expected = "short";

    // === Act ===
    delay(1); // Wait 1 second

    // === Assert ===
    this.assertEqual(expected, expected, "After 1 second delay");

    return 0;
  }

  //---------------------------------------------------------------------------
  /**
    @test Medium test - takes about 3 seconds.
   */
  public int testMedium()
  {
    // === Arrange ===
    this.pass("Starting medium test (3 seconds)");
    string testValue = "medium";

    // === Act ===
    delay(3); // Wait 3 seconds

    // === Assert ===
    this.assertEqual(testValue, "medium", "After 3 second delay");
    this.assertTrue(true, "Still passing after delay");

    return 0;
  }

  //---------------------------------------------------------------------------
  /**
    @test Long test - takes about 5 seconds.
   */
  public int testLong()
  {
    // === Arrange ===
    this.pass("Starting long test (5 seconds)");
    string longValue = "long";
    string shortValue = "short";

    // === Act ===
    delay(5); // Wait 5 seconds

    // === Assert ===
    this.assertEqual(longValue, "long", "After 5 second delay");
    this.assertNotEqual(longValue, shortValue, "Different values");
    this.assertTrue(true, "Still passing after long delay");

    return 0;
  }

  //---------------------------------------------------------------------------
  /**
    @test Multiple assertions with small delays between them.
   */
  public int testMultipleDelays()
  {
    // === Arrange ===
    this.pass("Starting multi-delay test");
    int counter = 0;

    // === Act ===
    counter++;
    this.assertEqual(counter, 1, "First assertion");
    delay(0, 500); // 500ms

    counter++;
    this.assertEqual(counter, 2, "Second assertion after 500ms");
    delay(0, 500); // 500ms

    counter++;
    this.assertEqual(counter, 3, "Third assertion after another 500ms");
    delay(0, 500); // 500ms

    // === Assert ===
    this.assertTrue(true, "Final assertion after total 1.5 seconds");

    return 0;
  }

  //---------------------------------------------------------------------------
  /**
    @test Test with intentional failure after delay.
   */
  public int testDelayedFailure()
  {
    // === Arrange ===
    this.pass("Starting test that will fail");
    string passValue = "pass";
    string failValue = "fail";

    // === Act ===
    this.assertEqual(passValue, "pass", "First assertion passes");
    delay(1); // Wait 1 second

    // === Assert ===
    this.assertEqual(failValue, passValue, "EXPECTED FAILURE after 1 second delay");

    return 0;
  }

  //---------------------------------------------------------------------------
  /**
    @test Instant pass - no delays.
   */
  public int testInstantPass()
  {
    // === Arrange ===
    string value = "instant";

    // === Act ===
    // (no action needed)

    // === Assert ===
    this.assertEqual(value, "instant", "Instant validation");

    return 0;
  }
};

//-----------------------------------------------------------------------------
void main()
{
  TstTimingTests test;
  test.startAll();
}
