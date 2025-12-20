#!/usr/bin/env pwsh
# Git Flow Setup Script for NPM Shared Library Template
# This script initializes Git Flow and applies branch protection rules

param(
    [string]$Owner = "",
    [string]$Repo = ""
)

Write-Host "🌳 Git Flow Setup for NPM Shared Library" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Detect owner and repo from git remote if not provided
if (-not $Owner -or -not $Repo) {
    Write-Host "🔍 Detecting repository information from git remote..." -ForegroundColor Yellow
    $remote = git remote get-url origin 2>$null
    if ($remote -match 'github\.com[:/]([^/]+)/([^/\.]+)') {
        $Owner = $Matches[1]
        $Repo = $Matches[2]
        Write-Host "✅ Detected: $Owner/$Repo" -ForegroundColor Green
    } else {
        Write-Error "❌ Could not detect repository. Please provide -Owner and -Repo parameters."
        exit 1
    }
}

Write-Host ""
Write-Host "📋 Repository: $Owner/$Repo" -ForegroundColor Cyan
Write-Host ""

# Step 1: Initialize Git Flow
Write-Host "1️⃣  Initializing Git Flow..." -ForegroundColor Cyan
if (Test-Path ".gitflow") {
    Write-Host "   Using .gitflow configuration file" -ForegroundColor Gray
    git flow init -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Git Flow initialized with defaults" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Git Flow already initialized or error occurred" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  .gitflow file not found, using manual setup" -ForegroundColor Yellow
    Write-Host "   Run: git flow init" -ForegroundColor Gray
}

Write-Host ""

# Step 2: Ensure develop branch exists
Write-Host "2️⃣  Ensuring develop branch exists..." -ForegroundColor Cyan
$developExists = git show-ref --verify --quiet refs/heads/develop
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Creating develop branch from main..." -ForegroundColor Gray
    git branch develop main
    git push -u origin develop
    Write-Host "   ✅ Develop branch created and pushed" -ForegroundColor Green
} else {
    Write-Host "   ✅ Develop branch already exists" -ForegroundColor Green
}

Write-Host ""

# Step 3: Set develop as default branch
Write-Host "3️⃣  Setting develop as default branch..." -ForegroundColor Cyan
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh repo edit "$Owner/$Repo" --default-branch develop 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Default branch set to develop" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Could not set default branch (requires admin permissions)" -ForegroundColor Yellow
        Write-Host "   → Set manually: Settings → Branches → Default branch → develop" -ForegroundColor Gray
    }
} else {
    Write-Host "   ⚠️  GitHub CLI (gh) not found" -ForegroundColor Yellow
    Write-Host "   → Install from: https://cli.github.com" -ForegroundColor Gray
    Write-Host "   → Or set manually: Settings → Branches → Default branch → develop" -ForegroundColor Gray
}

Write-Host ""

# Step 4: Apply branch protection rules
Write-Host "4️⃣  Applying branch protection rules..." -ForegroundColor Cyan
$rulesScript = "..\..\..\.github\rulesets\apply-rules.ps1"
if (Test-Path $rulesScript) {
    Write-Host "   Running apply-rules.ps1..." -ForegroundColor Gray
    & $rulesScript -Owner $Owner -Repo $Repo
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Branch protection rules applied" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Some rules may have failed (check output above)" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  apply-rules.ps1 not found at expected location" -ForegroundColor Yellow
    Write-Host "   → Apply manually via: Settings → Branches → Branch protection rules" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Recommended protection for main:" -ForegroundColor Gray
    Write-Host "   - Require pull request reviews (1+)" -ForegroundColor Gray
    Write-Host "   - Require status checks (ci, build)" -ForegroundColor Gray
    Write-Host "   - No force pushes" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   Recommended protection for develop:" -ForegroundColor Gray
    Write-Host "   - Require pull request reviews (1+)" -ForegroundColor Gray
    Write-Host "   - Require status checks (ci, build)" -ForegroundColor Gray
    Write-Host "   - Allow force pushes (for rebasing)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✨ Git Flow Setup Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📖 Git Flow Workflow:" -ForegroundColor Cyan
Write-Host "   • Start feature:  git flow feature start <name>" -ForegroundColor Gray
Write-Host "   • Finish feature: git flow feature finish <name>" -ForegroundColor Gray
Write-Host "   • Start release:  git flow release start <version>" -ForegroundColor Gray
Write-Host "   • Finish release: git flow release finish <version>" -ForegroundColor Gray
Write-Host "   • Start hotfix:   git flow hotfix start <version>" -ForegroundColor Gray
Write-Host "   • Finish hotfix:  git flow hotfix finish <version>" -ForegroundColor Gray
Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Cyan
Write-Host "   • Git Flow: https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow" -ForegroundColor Gray
Write-Host "   • Template README: README.md" -ForegroundColor Gray
Write-Host ""
