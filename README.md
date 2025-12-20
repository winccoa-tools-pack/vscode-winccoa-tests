# NPM Shared Library Template

Minimal starter template for creating shared npm libraries with Git Flow workflow.

## 🚀 Quick Start

### Initial Setup

1. **Create repository from this template**
   ```bash
   # Via GitHub CLI
   gh repo create winccoa-tools-pack/<your-library-name> \
     --template winccoa-tools-pack/template-npm-shared-library \
     --public
   ```

2. **Clone and initialize Git Flow**
   ```bash
   git clone https://github.com/winccoa-tools-pack/<your-library-name>
   cd <your-library-name>
   
   # Run the setup script (PowerShell)
   .\setup-gitflow.ps1
   
   # Or manually
   git flow init -d
   git push -u origin develop
   ```

3. **Install dependencies and build**
   ```bash
   npm install
   npm run build
   npm test
   ```

## 🌳 Git Flow Workflow

This template uses [Git Flow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for branch management:

### Branch Structure
- **`main`** - Production-ready code (stable releases)
- **`develop`** - Integration branch (pre-release features)
- **`feature/*`** - New features
- **`release/*`** - Release preparation
- **`hotfix/*`** - Emergency fixes for production

### Common Commands

```bash
# Start a new feature
git flow feature start my-feature

# Finish feature (merges to develop)
git flow feature finish my-feature

# Start a release
git flow release start 1.0.0

# Finish release (merges to main and develop, creates tag)
git flow release finish 1.0.0

# Hotfix for production
git flow hotfix start 1.0.1
git flow hotfix finish 1.0.1
```

### Branch Protection

The `setup-gitflow.ps1` script applies protection rules:
- **main**: Requires PR reviews, status checks, no force pushes
- **develop**: Requires PR reviews, status checks, allows force pushes (for rebasing)

## 🔐 NPM Publishing Setup

To enable automatic publishing to the NPM registry when creating releases, you need to configure an NPM access token:

### Why NPM_TOKEN is Required

The `release.yml` workflow automatically publishes your package to NPM when you merge a release PR to `main`. This requires authentication with the NPM registry.

### How to Get an NPM Access Token

1. **Log in to NPM**
   - Go to [npmjs.com](https://www.npmjs.com/) and sign in (or create an account)

2. **Generate Access Token**
   - Navigate to **Access Tokens** in your account settings: https://www.npmjs.com/settings/~/tokens
   - Click **"Generate New Token"** → Select **"Automation"** type
   - Copy the generated token (you won't see it again!)

3. **Add Token to Repository**
   - Go to your GitHub repository settings
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **"New repository secret"**
   - Name: `NPM_TOKEN`
   - Value: Paste your NPM access token
   - Click **"Add secret"**

### Token Permissions

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
