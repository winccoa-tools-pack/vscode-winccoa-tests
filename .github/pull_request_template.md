# 🔄 Git Flow Pull Request

## 🌳 **Git Flow Branch Type**

<!-- Mark the relevant Git Flow branch type with an "x" -->

- [ ] **Feature** (`feature/*` → `develop`) - New functionality
- [ ] **Release** (`release/*` → `main` + back-merge to `develop`) - Release preparation
- [ ] **Hotfix** (`hotfix/*` → `main` + back-merge to `develop`) - Critical production fixes
- [ ] **Bugfix** (`bugfix/*` → `develop`) - Bug fixes for development
- [ ] **Other** (please specify): **\*\***\_\_\_**\*\***

## 📋 **Description**

<!-- Provide a clear and concise description of what this PR does -->

## 🔗 **Related Issue(s)**

<!-- Link to the issue(s) this PR addresses -->

- Fixes #(issue number)
- Closes #(issue number)
- Related to #(issue number)

## 🎯 **Type of Change**

<!-- Mark the relevant option with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🔧 Code refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test coverage improvement
- [ ] 🏗️ Build/CI changes
- [ ] 🔒 Security fix

## 🔍 **Git Flow Validation**

<!-- Ensure your PR follows Git Flow workflow correctly -->

- [ ] Branch follows Git Flow naming convention (`feature/`, `release/`, `hotfix/`, `bugfix/`)
- [ ] Branch is created from correct source:
    - [ ] Feature/Bugfix: branched from `develop`
    - [ ] Release: branched from `develop`
    - [ ] Hotfix: branched from `main`
- [ ] Target branch is correct:
    - [ ] Feature/Bugfix: merging to `develop`
    - [ ] Release: merging to `main` (will be back-merged to `develop`)
    - [ ] Hotfix: merging to `main` (will be back-merged to `develop`)
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/) format
- [ ] Branch will be deleted after merge (for feature/hotfix/release branches)

## 🧪 **Testing**

<!-- Describe the tests you ran to verify your changes -->

### Test Environment

- VS Code Version:
- Extension Version:
- WinCC OA Version:
- Operating System:

### Test Cases

- [ ] Manual testing completed
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] No regressions in existing functionality

### WinCC OA Compatibility

- [ ] Changes are compatible with WinCC OA project structure
- [ ] pvssInst.conf parsing still works correctly
- [ ] Project configuration files are handled properly
- [ ] pmon integration functions correctly

### Test Steps

1. do this
2. and that
3. and it works as proposed

## 📸 **Screenshots (if applicable)**

<!-- Add screenshots to help explain your changes -->

## 📝 **Checklist**

### Code Quality

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] My changes generate no new warnings or errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

### Documentation

- [ ] I have updated the documentation accordingly
- [ ] I have updated the CHANGELOG.md file (if applicable)
- [ ] Any new configuration options are documented

### Dependencies

- [ ] I have checked that my changes don't introduce new security vulnerabilities
- [ ] Any new dependencies are justified and documented
- [ ] Version compatibility is maintained

## 🔄 **Migration Guide (if breaking change)**

<!-- If this is a breaking change, provide migration instructions -->

## 📋 **Additional Notes**

<!-- Add any additional notes, concerns, or implementation details -->

## 🎉 **Reviewer Notes**

<!-- Tag specific reviewers or provide context for reviewers -->

/cc @mPokornyETM

---

## 🎯 **Git Flow Merge Strategy**

### For Feature/Bugfix PRs

- Merge to `develop` using "Squash and merge" or "Create a merge commit"
- Delete feature branch after merge
- Ensure CI/CD checks pass before merging

### For Release PRs

1. Merge to `main` using "Create a merge commit"
2. Create release tag: `git tag -a v[version] -m "Release [version]"`
3. **Important**: Create back-merge PR from `main` to `develop` to sync changes
4. Delete release branch after both merges complete

### For Hotfix PRs

1. Merge to `main` using "Create a merge commit"
2. Create hotfix tag: `git tag -a v[version] -m "Hotfix [version]"`
3. **Important**: Create back-merge PR from `main` to `develop` to sync changes
4. Delete hotfix branch after both merges complete

**📖 For complete Git Flow documentation, see: [docs/GITFLOW_WORKFLOW.md](docs/GITFLOW_WORKFLOW.md)**

---

**By submitting this pull request, I confirm that my contribution is made under the terms of the project license.**
