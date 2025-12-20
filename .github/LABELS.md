# GitHub Labels Configuration

This document describes the label system used for organizing issues and pull requests.

## 🏷️ **Label Categories**

### **Priority Labels** (Red Spectrum)

- `priority/critical` - 🔴 Must have for milestone, blocks other work
- `priority/high` - 🟠 Important for milestone success
- `priority/medium` - 🟡 Nice to have, can be moved to next milestone
- `priority/low` - ⚫ Future consideration, not scheduled

### **Type Labels** (Blue Spectrum)

- `enhancement` - 🔵 New feature or improvement
- `bug` - 🔴 Something isn't working correctly
- `documentation` - 📚 Improvements or additions to documentation
- `question` - ❓ Further information is requested
- `duplicate` - ⚫ This issue or pull request already exists
- `wontfix` - ⚫ This will not be worked on

### **Component Labels** (Green Spectrum)

- `core` - 🟢 Core library functionality
- `api` - 🔌 Public API and interfaces
- `testing` - 🧪 Testing framework and test cases
- `quality` - 🔍 Code quality and static analysis
- `configuration` - ⚙️ Configuration options
- `integration` - 🔗 Third-party integrations

### **Status Labels** (Purple Spectrum)

- `needs-triage` - 🟣 New issue that needs initial review
- `status/planning` - 📋 In planning and design phase
- `status/in-progress` - 🔄 Actively being worked on
- `status/review` - 👀 In code review or testing
- `status/blocked` - 🚫 Blocked by dependency or external factor
- `status/ready` - ✅ Ready for development to begin

### **Special Labels** (Various Colors)

- `good-first-issue` - 🌱 Good for newcomers (Green)
- `help-wanted` - 🙋 Extra attention is needed (Blue)
- `breaking-change` - ⚠️ Introduces breaking changes (Red)
- `security` - 🔒 Security related issue (Red)
- `performance` - ⚡ Performance improvement (Yellow)
- `dependencies` - 📦 Updates to dependencies (Blue)

## 📊 **Label Usage Guidelines**

### **Issue Labeling Workflow**

1. **Automatic Labels** (via GitHub Actions):
    - Issue type labels added based on title prefix
    - `needs-triage` added to all new issues
    - Component labels added based on issue template selection

2. **Manual Triage Process**:
    - Maintainers review `needs-triage` issues within 2-3 business days
    - Add priority and component labels
    - Add to appropriate milestone
    - Remove `needs-triage` and add `status/ready` or `status/planning`

3. **Development Workflow**:
    - Add `status/in-progress` when work begins
    - Add `status/review` when PR is created
    - Close issue when merged and tested

### **Pull Request Labeling**

- Type labels match the type of change
- Component labels match affected areas
- `breaking-change` for API changes
- `dependencies` for package updates
- Priority labels for critical fixes

## 🎯 **Milestone Integration**

Labels work with our milestone system to track project progress and organize work effectively.

## 🔍 **Label Queries**

### **Useful Filter Examples**

```bash
# Ready for development
is:issue is:open label:"status/ready" label:"priority/high"

# Good first issues
is:issue is:open label:"good-first-issue" label:"priority/medium"

# Current milestone critical items
is:issue is:open milestone:"Foundation (v1.0)" label:"priority/critical"

# Documentation needs
is:issue is:open label:documentation -label:"status/in-progress"

# Performance issues
is:issue is:open label:performance label:bug

# Breaking changes in next release
is:issue is:open label:"breaking-change" milestone:"Developer Experience (v1.5)"
```

### **Project Board Automation**

Labels can trigger automatic project board movements:

- `needs-triage` → **Inbox** column
- `status/ready` → **Backlog** column
- `status/in-progress` → **In Progress** column
- `status/review` → **Review** column
- Closed → **Done** column

## 🛠️ **Label Management**

### **Creating Labels via GitHub CLI**

```bash
# Priority labels
gh label create "priority/critical" --color "B60205" --description "Must have for milestone"
gh label create "priority/high" --color "D93F0B" --description "Important for milestone success"
gh label create "priority/medium" --color "FBCA04" --description "Nice to have, can be moved"
gh label create "priority/low" --color "0E8A16" --description "Future consideration"

# Component labels
gh label create "core-feature" --color "0E8A16" --description "Core extension functionality"
gh label create "ui" --color "1D76DB" --description "User interface and experience"
gh label create "api" --color "5319E7" --description "API and integration features"

# Status labels
gh label create "needs-triage" --color "8B5CF6" --description "Needs initial review"
gh label create "status/planning" --color "A855F7" --description "In planning phase"
gh label create "status/in-progress" --color "3B82F6" --description "Actively being worked on"
```

### **Bulk Label Operations**

```bash
# Add priority label to all enhancement issues
gh issue list --label "enhancement" --json number | jq -r '.[].number' | \
xargs -I {} gh issue edit {} --add-label "priority/medium"

# Move all critical issues to current milestone
gh issue list --label "priority/critical" --json number | jq -r '.[].number' | \
xargs -I {} gh issue edit {} --milestone "Foundation (v1.0)"
```

## 📈 **Label Analytics**

Track project health using label metrics:

- **Triage Velocity**: Time from `needs-triage` to `status/ready`
- **Development Velocity**: Time from `status/ready` to closed
- **Priority Distribution**: Balance of priority levels
- **Component Coverage**: Issue distribution across components
- **Milestone Progress**: Completed vs remaining issues per milestone

---

_This label system helps maintain organization and visibility across the entire WinCC OA VS Code Extension project lifecycle._
