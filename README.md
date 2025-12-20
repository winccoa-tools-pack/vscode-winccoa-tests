# WinCC OA Test Explorer

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-^1.106.2-007ACC.svg)

**Test Explorer integration for WinCC OA unit tests in Visual Studio Code**

⚠️ *Pre-Release Version - Proof of Concept*

</div>

---

## 🎯 Project Goal

This extension aims to integrate WinCC OA unit tests into the Visual Studio Code Test Explorer, providing a seamless testing experience for WinCC OA CTRL script developers.

### Vision
- **Discover** WinCC OA test files automatically
- **Run** tests directly from VS Code Test Explorer
- **View** test results with detailed output
- **Debug** failed tests with integrated debugging support

---

## ✨ Features (Planned)

### 🔍 Test Discovery
- Automatic discovery of WinCC OA test files (`*_test.ctl`)
- Parse test functions and test suites
- Support for nested test structures

### 🚀 Test Execution
- Run individual tests or entire test suites
- Integration with WinCC OA runtime
- Real-time test execution feedback

### 📊 Test Results
- Visual test status indicators (✓ passed, ✗ failed, ⊘ skipped)
- Detailed error messages and stack traces
- Test duration tracking

### 🎨 IDE Integration
- Native VS Code Test Explorer UI
- CodeLens integration for quick test execution
- Inline test decorations

---

## 🚀 Getting Started

### Prerequisites
- Visual Studio Code ^1.106.2
- WinCC OA installation (3.17 or higher)
- WinCC OA project with test files

### Installation

#### From Source (Development)
1. Clone the repository
   ```bash
   git clone https://github.com/winccoa-tools-pack/vscode-winccoa-tests
   cd vscode-winccoa-tests
   ```

2. Install dependencies and build
   ```bash
   make install
   make build
   ```

3. Package and test locally
   ```bash
   make test-local
   ```

---

## ⚙️ Configuration

Configure the extension in your VS Code `settings.json`:

```json
{
  "winccoaTests.testFilesPattern": "**/*_test.ctl",
  "winccoaTests.winccoaBinPath": "C:\\Siemens\\Automation\\WinCC_OA\\3.19\\bin",
  "winccoaTests.logLevel": "INFO"
}
```

### Settings Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `winccoaTests.testFilesPattern` | `**/*_test.ctl` | Glob pattern to discover test files |
| `winccoaTests.winccoaBinPath` | - | Path to WinCC OA bin directory |
| `winccoaTests.logLevel` | `INFO` | Logging level (ERROR, WARN, INFO, DEBUG) |

---

## 📋 Usage

### Discovering Tests

1. Open a WinCC OA project workspace in VS Code
2. The extension will automatically scan for test files matching the pattern
3. View discovered tests in the Test Explorer sidebar

### Running Tests

**Via Test Explorer:**
- Click the ▶️ icon next to a test or test suite
- Use "Run All Tests" from the command palette

**Via Command Palette:**
- `WinCC OA Tests: Run All Tests` - Run all discovered tests
- `WinCC OA Tests: Refresh Tests` - Refresh test discovery

---

## 🏗️ Project Structure

```
vscode-winccoa-tests/
├── src/
│   ├── extension.ts           # Extension entry point
│   ├── testController.ts      # Test Explorer controller
│   ├── testDiscovery.ts       # Test file discovery
│   ├── testParser.ts          # Parse CTRL test files
│   └── testRunner.ts          # Execute WinCC OA tests
├── test/
│   └── suite/                 # Extension tests
├── resources/                 # Icons and assets
├── Makefile                   # Build automation
├── package.json              # Extension manifest
└── tsconfig.json             # TypeScript configuration
```

---

## 🛠️ Development Workflow

### Using Makefile

```bash
# Install dependencies
make install

# Build extension
make build

# Watch mode for development
make watch

# Run tests
make test

# Package extension
make package

# Local testing workflow
make test-local
```

### Git Flow Integration

This project uses Git Flow for development:

```bash
# Start new feature
git flow feature start test-discovery

# Finish feature
git flow feature finish test-discovery

# Create release
git flow release start 0.2.0
git flow release finish 0.2.0
```

---

## 🧪 Testing

### Extension Tests
```bash
npm test
```

### Manual Testing
Use the local test workflow:
```bash
make test-local TEST_WORKSPACE=path/to/winccoa/project
```

---

## 🗺️ Roadmap

### Phase 1: Proof of Concept ✅ (Current)
- [x] Project setup and structure
- [x] Basic extension scaffolding
- [ ] Simple test discovery
- [ ] Basic test execution

### Phase 2: Core Features
- [ ] Full Test Explorer integration
- [ ] Test result parsing
- [ ] Error reporting and diagnostics
- [ ] Test file watching and auto-refresh

### Phase 3: Advanced Features
- [ ] Debugging support
- [ ] Code coverage
- [ ] Test parametrization
- [ ] Performance profiling

### Phase 4: Polish & Release
- [ ] Documentation and examples
- [ ] CI/CD integration
- [ ] Marketplace publication

---

## 📚 Resources

### WinCC OA Testing
- [WinCC OA Documentation](https://www.winccoa.com/)
- WinCC OA Unit Test Framework

### VS Code Test API
- [Testing API](https://code.visualstudio.com/api/extension-guides/testing)
- [Test Explorer UI](https://github.com/microsoft/vscode/issues/testing)

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

## 🙏 Acknowledgments

- VS Code Testing API team
- WinCC OA community
- All contributors and testers

---

<div align="center">

**Made with ❤️ for the WinCC OA community**

</div>


- **Automation tokens** are recommended for CI/CD (they don't expire but can be revoked)
- The token needs **publish** permission for your package scope
- For scoped packages (`@winccoa-tools-pack/...`), ensure your NPM organization allows publishing

### Testing Without NPM_TOKEN

If `NPM_TOKEN` is not configured, the workflow will:
- ✅ Still run tests and build the package
- ✅ Create GitHub releases with artifacts
- ⚠️ Skip NPM publishing with a warning message

You can always publish manually later:
```bash
npm publish --access public
```

## 📦 Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## 🏆 Recognition

Special thanks to all our [contributors](https://github.com/orgs/winccoa-tools-pack/people) who make this project possible!

### Key Contributors
- **Martin Pokorny** ([@mPokornyETM](https://github.com/mPokornyETM)) - Creator & Lead Developer
- And many more amazing contributors!

---

## 📜 License

This project is basically licensed under the **MIT License** - see the [LICENSE](https://github.com/winccoa-tools-pack/.github/blob/main/LICENSE) file for details.

It might happens, that the partial repositories contains third party SW which are using other license models.

---

## ⚠️ Disclaimer

**WinCC OA** and **Siemens** are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

---

## 🎉 Thank You!

Thank you for using WinCC OA tools package! We're excited to be part of your development journey.

**Happy Coding! 🚀**

---

<div align="center">

**Quick Links**

• [📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mPokornyETM.wincc-oa-projects)

*Made with ❤️ for and by the WinCC OA community*
</div>
