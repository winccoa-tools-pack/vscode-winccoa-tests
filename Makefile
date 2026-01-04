.PHONY: help install build clean watch package test test-local

# Variables
EXTENSION_NAME := winccoa-vscode-tests
VERSION := $(shell node -p "require('./package.json').version")
BIN_DIR := bin
DIST_DIR := dist
EXT_PUBLISHER := RichardJanisch
EXT_NAME := winccoa-vscode-tests
EXT_ID := $(EXT_PUBLISHER).$(EXT_NAME)
NPM := npm
VSCE := npx vsce

# Test workspace configuration
TEST_WORKSPACE ?= DevEnv.code-workspace
CODE_BIN ?= code
FORCE_CLOSE_VSCODE ?= no
SKIP_UNINSTALL ?= yes
CLOSE_OLD_WINDOW ?= no

# Local build counter file
LOCAL_COUNTER_FILE := $(BIN_DIR)/.local_build_counter

# OS Detection
ifeq ($(OS),Windows_NT)
    DETECTED_OS := Windows
    RM := del /Q /F
    RMDIR := rmdir /S /Q
    MKDIR := mkdir
    KILL_CODE := taskkill /IM Code.exe /F 2>nul || echo "No VS Code process found"
else
    DETECTED_OS := $(shell uname -s)
    RM := rm -f
    RMDIR := rm -rf
    MKDIR := mkdir -p
    KILL_CODE := pkill -f "$(CODE_BIN)" 2>/dev/null || echo "No VS Code process found"
endif

# Default target
help:
	@echo "Available targets:"
	@echo "  make install     - Install all dependencies"
	@echo "  make build       - Build extension"
	@echo "  make clean       - Remove build artifacts"
	@echo "  make watch       - Watch mode for development"
	@echo "  make package     - Package extension as .vsix"
	@echo "  make test        - Run tests"
	@echo "  make test-local  - Build, package with local stamp, install in VS Code, open test workspace"
	@echo ""
	@echo "Local Test Configuration:"
	@echo "  TEST_WORKSPACE        - Path to test workspace (default: DevEnv.code-workspace)"
	@echo "  CODE_BIN              - VS Code binary (default: code, use 'code-insiders' for Insiders)"
	@echo "  FORCE_CLOSE_VSCODE    - Close all VS Code instances before opening (default: no, use 'yes' to force)"
	@echo "  SKIP_UNINSTALL        - Skip uninstall step (default: yes)"
	@echo "  CLOSE_OLD_WINDOW      - Close old window and open fresh (default: no)"
	@echo "  Example: make test-local TEST_WORKSPACE=/path/to/workspace CODE_BIN=code-insiders"

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install
	@echo "Dependencies installed successfully!"

# Build everything
build:
	@echo "Building extension..."
	npm run compile
	@echo "Build completed successfully!"

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(DIST_DIR)/
	rm -rf out/
	rm -rf $(BIN_DIR)/
	rm -rf node_modules/
	@echo "Clean completed!"

# Watch mode for development
watch:
	@echo "Starting watch mode..."
	npm run watch

# Package extension
package: build
	@echo "Packaging production release..."
	@-$(MKDIR) $(BIN_DIR) 2>nul || echo "" >nul
	@echo "Updating version badge in README.md..."
	@node -e "const fs=require('fs'); let c=fs.readFileSync('README.md','utf8'); c=c.replace(/!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^)]*\)/,'![Version](https://img.shields.io/badge/version-$(VERSION)-blue.svg)'); fs.writeFileSync('README.md',c);"
	@npx vsce package --out $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix
	@echo "Extension packaged to $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix"

# Run tests
test:
	@echo "Running tests..."
	npm test

# Local test target - Build, package with local stamp, replace extension, restart VS Code
# Local test target - Build, package with local stamp, replace extension, restart VS Code
test-local:
	@node scripts/test-local.js $(BIN_DIR) $(EXTENSION_NAME) $(VERSION) $(EXT_ID) $(CODE_BIN) $(TEST_WORKSPACE)
	@LOCAL_COUNT=$$(cat $(LOCAL_COUNTER_FILE)); \
