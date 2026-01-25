# WinCC OA Test Explorer

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.13-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-^1.106.2-007ACC.svg)

**Test Explorer integration for WinCC OA unit tests in Visual Studio Code**

[Features](#-features) • [Known Issues](#-known-issues)

</div>

---

> **Disclaimer:** This is one of the first releases of the WinCC OA Test Explorer extension. Some edge cases may not be fully covered yet. Please check the [Known Issues](#-known-issues) section for workarounds if you encounter problems.  
> **Tip:** If the extension doesn't work as expected, try `Ctrl+Shift+P` → `Reload Window` to refresh.

---

## 🎬 See It In Action

![WinCC OA Test Explorer Demo](https://github.com/winccoa-tools-pack/vscode-winccoa-tests/blob/develop/images/Animation.gif?raw=true)

---

## ✨ Features

### 🔍 Test Discovery

- Automatic discovery of WinCC OA test files in workspace
- Support for both WinCC OA 3.19 and 3.20 test formats
- Auto-refresh on file changes with incremental updates
- Workspace folder hierarchy

#### Supported Test Patterns

**WinCC OA 3.19 Format:**

```c
// $License: NOLICENSE
/** Tests for the library: scripts/libs/$origLibRelPath.

  @file $relPath
  @test Unit tests for the library: scripts/libs/$origLibRelPath
  @copyright $copyright
  @author RichardJanisch
 */

//--------------------------------------------------------------------------------
// Libraries used (#uses)
#uses "$origLibRelPathWithoutExtension" // tested object
#uses "classes/oaTest/OaTest" // oaTest basic class

//--------------------------------------------------------------------------------
// Variables and Constants

//--------------------------------------------------------------------------------
/**
*/
class TstHelloWorld : OaTest
{
  //------------------------------------------------------------------------------
  // List of the test cases
  protected dyn_string getAllTestCaseIds()
  {
    return makeDynString("$origLibName_");
  }

  //------------------------------------------------------------------------------
  protected int startTestCase(const string &tcId)
  {
    //----------------------------------------------------------------------------
    switch (tcId)
    {
      //--------------------------------------------------------------------------
      case "$origLibName_":
      {
        // Test your script here.
        assertEqual("currentValue", "expectedValue");
        return 0;
      }
    }

    return -1;
  }
};

//--------------------------------------------------------------------------------
main()
{
  TstHelloWorld test = TstHelloWorld();
  test.startAll();
  exit(0);
}
```

**WinCC OA 3.20 Format:**

```cpp
// $License: NOLICENSE
/** Tests for the library: scripts/libs/$origLibRelPath.

  @file $relPath
  @test Unit tests for the library: scripts/libs/$origLibRelPath
  @copyright $copyright
  @author RichardJanisch
 */

//--------------------------------------------------------------------------------
// Libraries used (#uses)
#uses "$origLibRelPathWithoutExtension" // tested object
#uses "classes/oaTest/OaTest" // oaTest basic class

//--------------------------------------------------------------------------------
// Variables and Constants

//--------------------------------------------------------------------------------
/**
*/
class TstPass : OaTest
{
  //------------------------------------------------------------------------------
  // List of the test cases
  protected dyn_string getAllTestCaseIds()
  {
    return makeDynString("$origLibName_");
  }

  //------------------------------------------------------------------------------
  protected int startTestCase(const string &tcId)
  {
    //----------------------------------------------------------------------------
    switch (tcId)
    {
      //--------------------------------------------------------------------------
      case "$origLibName_":
      {
        // Test your script here.
        assertEqual("expectedValue", "expectedValue");
        return 0;
      }
    }

    return -1;
  }
};

//--------------------------------------------------------------------------------
main()
{
  TstPass test = TstPass();
  test.startAll();
  exit(0);
}
```

### 🚀 Test Execution

- Run individual test files or entire folders
- **Test Cancellation**: Stop running tests via stop button
- Click-to-navigate for all test states (passed, failed, aborted)
- Accurate error locations with StackTrace parsing
- Individual test messages per assertion

### 📊 Test Results

- Visual test status indicators in Test Explorer sidebar
- Detailed error messages with file and line references
- Test duration tracking
- Structured logging with configurable log levels

### 🎨 IDE Integration

- Native VS Code Test Explorer UI
- Recursive folder execution
- Multi-workspace support
- Auto-detection via WinCC OA Control extension

---

## ⚙️ Configuration

### Essential Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoaTests.testFilesPattern` | `scripts/tests/**/*.ctl` | Glob pattern to discover test files |
| `winccoaTests.logLevel` | `INFO` | Log verbosity: `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` |

### Logging (for debugging)

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoaTests.logLevel` | `INFO` | Log verbosity: `ERROR`, `WARN`, `INFO`, `DEBUG`, `TRACE` |

💡 **Tip**: Set log level to `DEBUG` when reporting bugs for detailed diagnostics.

---

## 🐛 Known Issues

### Performance

**Windows Performance:**  
The extension may run slower on Windows with longer loading times. Linux performs significantly better.

**Large Projects:**  
Very large projects (1000+ test files) may experience performance issues during discovery.

### General

**Extension Not Responding:**  
If the extension doesn't work as expected (tests not refreshing, detection issues), reload VS Code:  

1. Press `Ctrl+Shift+P`
2. Type and select `Reload Window`
3. For test refresh: Run `WinCC OA Tests: Refresh Tests` from Command Palette

### Current Limitations

1. **Single Test Execution Not Supported**:
   - Running individual test cases within a file is not possible
   - Only entire test files can be executed
   - This is a WinCC OA limitation - no complete test report for individual test cases

2. **Test Debugging**:
   - Debugger integration not yet implemented
   - Use `DebugN()` for manual debugging in tests

3. **Test Discovery**:
   - Complex test files may not be parsed correctly
   - Requires strict adherence to WinCC OA test format patterns

### Reporting Bugs

Found an issue? Please report it with:

- WinCC OA version
- Extension version (`1.0.0`)
- Test file example that reproduces the issue
- Enable `DEBUG` logging and attach log output

[Report Issue on GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-tests/issues)

---

## 📝 Commands

Access via `Ctrl+Shift+P`:

| Command | Description |
|---------|-------------|
| `WinCC OA Tests: Run All Tests` | Run all discovered tests |
| `WinCC OA Tests: Refresh Tests` | Manually refresh test discovery |
| `WinCC OA Tests: Stop Running Tests` | Cancel currently running tests |

---

## 🛠️ Requirements

- **VS Code:** 1.106.2 or higher
- **WinCC OA:** 3.19+
- **WinCC OA Script Actions:** Extension (required for test execution)
- **WinCC OA Control:** Extension (optional, for auto-detection)
- **Project Structure:** Test files in `scripts/tests/` directory

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 📜 Disclaimer

WinCC OA and Siemens are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project.

---

<div align="center">

Made with ❤️ for the WinCC OA community

[GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-tests) • [Issues](https://github.com/winccoa-tools-pack/vscode-winccoa-tests/issues) • [WinCC OA Docs](https://www.winccoa.com)

</div>
