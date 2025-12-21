# WinCC OA Test Explorer

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-^1.106.2-007ACC.svg)

**Test Explorer integration for WinCC OA unit tests in Visual Studio Code**

⚠️ *Pre-Release Version - Not all features have been fully tested yet*

</div>

---

## ✨ Features

### 🔍 Test Discovery
- Automatic discovery of WinCC OA test files in workspace
- Support for both WinCC OA 3.19 and 3.20 test formats
  - **3.19**: `getAllTestCaseIds()` with switch/case structure
  - **3.20**: `public int test*()` methods
- Auto-refresh on file changes
- Workspace folder hierarchy

### 🚀 Test Execution
- Run individual test files or entire folders
- Click-to-navigate for all test states (passed, failed, aborted)
- Accurate error locations with StackTrace parsing
- Individual test messages per assertion
- Test execution queue to prevent conflicts

### 📊 Test Results
- Visual test status indicators in Test Explorer sidebar
- Detailed error messages with file and line references
- Test duration tracking
- Structured logging with configurable log levels

### 🎨 IDE Integration
- Native VS Code Test Explorer UI
- Recursive folder execution
- Multi-workspace support

---

## 🚀 Getting Started

### Prerequisites
- Visual Studio Code ^1.106.2
- WinCC OA installation (3.19 or higher)
- **[WinCC OA Script Actions](https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-script-actions)** extension (required for test execution)

### Installation

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "WinCC OA Test Explorer"
4. Click Install
5. Install the required **WinCC OA Script Actions** extension

---

## ⚙️ Configuration

Configure the extension in your VS Code `settings.json`:

```json
{
  "winccoaTests.testFilesPattern": "scripts/tests/**/*.ctl",
  "winccoaTests.logLevel": "INFO"
}
```

### Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoaTests.testFilesPattern` | `scripts/tests/**/*.ctl` | Glob pattern to discover test files |
| `winccoaTests.logLevel` | `INFO` | Logging level (ERROR, WARN, INFO, DEBUG, TRACE) |

---

## 📋 Usage

### Discovering Tests

1. Open a WinCC OA project workspace in VS Code
2. The extension will automatically scan for test files
3. View discovered tests in the **Test Explorer** sidebar (beaker icon)

### Running Tests

**Via Test Explorer:**
- Click the ▶️ icon next to a test file or folder
- Use the **Run All Tests** button in the toolbar

**Via Command Palette:**
- `WinCC OA Tests: Run All Tests` - Run all discovered tests
- `WinCC OA Tests: Refresh Tests` - Manually refresh test discovery

### Test File Formats

**WinCC OA 3.19 Format:**
```cpp
main() {
    getAllTestCaseIds();
}

getAllTestCaseIds() {
    dyn_string ids;
    ids[1] = "tc_01_example";
    return ids;
}

test(string id) {
    switch(id) {
        case "tc_01_example":
            // Arrange
            int expected = 5;
            // Act
            int actual = 2 + 3;
            // Assert
            oaTest_assert(expected == actual);
            break;
    }
}
```

**WinCC OA 3.20 Format:**
```cpp
public int test_example() {
    // Arrange
    int expected = 5;
    // Act
    int actual = 2 + 3;
    // Assert
    oaTest_assert(expected == actual);
    return 0;
}
```

---

## 🛠️ Requirements

- Visual Studio Code 1.106.2 or higher
- WinCC OA installation with test framework
- **WinCC OA Script Actions** extension for test execution
- Valid WinCC OA project with test files

---

## ⚠️ Known Limitations

- Individual test case execution not yet supported (runs entire file)
- Test debugging support not yet implemented

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

**winccoa-tools-pack**
- GitHub: [@winccoa-tools-pack](https://github.com/winccoa-tools-pack)

---

<div align="center">

**Made with ❤️ for the WinCC OA community**

