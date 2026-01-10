# Git Flow Workflow (Guide)

This repository template uses the Git Flow branching model. The repository
includes GitHub Actions workflows that help enforce branch protection and
automate parts of the release process.

Summary

**Branch Overview:**

- main: Production-ready code (stable releases)
- develop: Integration branch for ongoing development
- feature/\*: New features (branch off `develop`)
- release/\*: Prepare and test release candidates (branch off `develop`)
- hotfix/\*: Emergency fixes for `main`

Recommended local setup

1.Install the `git-flow` tooling for your platform (optional). - Windows: use Scoop/Chocolatey or WSL - macOS: `brew install git-flow-avh` - Linux: `apt install git-flow` (Debian/Ubuntu)

2.Initialize git-flow locally (if using the tool):

```bash
git flow init -d
git push -u origin develop
```

3.Branching examples

```bash
# Start a feature from develop
git checkout develop
git flow feature start my-feature

# Finish feature and push
git flow feature finish my-feature
git push origin develop
```

Applying branch protection

There is a workflow `Setup Git Flow Branch Protection` in `.github/workflows/setup-gitflow.yml` which can apply recommended protection settings to `main` and `develop`.
Run it from the Actions tab or via `workflow_dispatch` if you have repository admin rights.

Notes

- If you don't want to install the `git-flow` CLI, you can use standard git commands and follow the same branch naming conventions.
- The template's release workflows (e.g. `release.yml`) will operate on `main` and require repository secrets (e.g. `NPM_TOKEN`) for publishing.

---

## 🎉 Thank You

Thank you for using WinCC OA tools package!
We're excited to be part of your development journey. **Happy Coding! 🚀**

---

## Quick Links

• [📦 VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=mPokornyETM.wincc-oa-projects)

---

<center>Made with ❤️ for and by the WinCC OA community</center>
