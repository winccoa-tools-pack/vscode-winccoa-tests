.PHONY: help install build clean watch package test test-local

# Variables
EXTENSION_NAME := winccoa-vscode-tests
VERSION := $(shell node -p "require('./package.json').version")
BIN_DIR := bin
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
	rm -rf dist/
	rm -rf out/
	rm -rf bin/
	rm -rf node_modules/
	@echo "Clean completed!"

# Watch mode for development
watch:
	@echo "Starting watch mode..."
	npm run watch

# Package extension
package: build
	@echo "Packaging extension..."
	@mkdir -p $(BIN_DIR)
	npx vsce package --out $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix
	@echo "Package created: $(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION).vsix"

# Run tests
test:
	@echo "Running tests..."
	npm test

# Local test target - Build, package with local stamp, replace extension, restart VS Code
test-local:
	@echo "========================================"
	@echo "Starting Local Test Setup..."
	@echo "OS: $(DETECTED_OS)"
	@echo "========================================"
	@echo ""
	@echo "[1/5] Creating local build counter..."
	@$(MKDIR) $(BIN_DIR)
	@if [ ! -f $(LOCAL_COUNTER_FILE) ]; then echo "0" > $(LOCAL_COUNTER_FILE); fi
	@LOCAL_COUNT=$$(cat $(LOCAL_COUNTER_FILE)); \
	NEW_COUNT=$$((LOCAL_COUNT + 1)); \
	echo $$NEW_COUNT > $(LOCAL_COUNTER_FILE); \
	LOCAL_VSIX="$(BIN_DIR)/$(EXTENSION_NAME)-$(VERSION)-local-$$NEW_COUNT.vsix"; \
	echo "[2/5] Packaging to $$LOCAL_VSIX (includes build via vscode:prepublish)..."; \
	echo "Updating version badge in README.md..."; \
	sed -i.bak 's|!\[Version\](https://img.shields.io/badge/version-[^)]*)|![Version](https://img.shields.io/badge/version-$(VERSION).local.'$$NEW_COUNT'-blue.svg)|' README.md; \
	echo "Backing up package.json..."; \
	cp package.json package.json.bak; \
	echo "Modifying displayName for local build..."; \
	ORIGINAL_DISPLAY_NAME=$$(node -p "require('./package.json').displayName"); \
	node -e "const fs=require('fs'); const p=require('./package.json'); p.displayName='$$ORIGINAL_DISPLAY_NAME [LOCAL-$$NEW_COUNT]'; fs.writeFileSync('package.json', JSON.stringify(p, null, 2) + '\n')"; \
	$(VSCE) package -o $$LOCAL_VSIX; \
	PACKAGE_RESULT=$$?; \
	echo "Restoring package.json from backup..."; \
	mv package.json.bak package.json; \
	echo "Restoring README.md from backup..."; \
	mv README.md.bak README.md; \
	if [ $$PACKAGE_RESULT -ne 0 ]; then exit 1; fi; \
	echo ""; \
	if [ "$(SKIP_UNINSTALL)" != "yes" ]; then \
		echo "[3/5] Uninstalling existing extension ($(EXT_ID))..."; \
		$(CODE_BIN) --uninstall-extension $(EXT_ID) 2>/dev/null || echo "Extension not installed or already removed"; \
		echo ""; \
	else \
		echo "[3/5] Skipping uninstall (SKIP_UNINSTALL=yes)"; \
		echo ""; \
	fi; \
	echo "[4/5] Installing new extension from $$LOCAL_VSIX..."; \
	$(CODE_BIN) --install-extension $$LOCAL_VSIX --force || exit 1; \
	sleep 1; \
	echo ""; \
	echo "[5/5] Reloading VS Code window..."; \
	if [ "$(FORCE_CLOSE_VSCODE)" = "yes" ]; then \
		echo "⚠️  Closing ALL VS Code instances (FORCE_CLOSE_VSCODE=yes)..."; \
		$(KILL_CODE); \
		sleep 2; \
		echo "Opening workspace: $(TEST_WORKSPACE)"; \
		$(CODE_BIN) $(TEST_WORKSPACE) & \
	elif [ "$(CLOSE_OLD_WINDOW)" = "yes" ]; then \
		echo "🔄 Closing old test workspace window and opening fresh..."; \
		$(CODE_BIN) --reuse-window $(TEST_WORKSPACE) 2>/dev/null || true; \
		sleep 0.5; \
		$(CODE_BIN) --command workbench.action.closeWindow 2>/dev/null || true; \
		sleep 1; \
		echo "Opening fresh workspace window: $(TEST_WORKSPACE)"; \
		$(CODE_BIN) --new-window $(TEST_WORKSPACE) & \
	else \
		echo "ℹ️  Opening workspace in new window: $(TEST_WORKSPACE)"; \
		$(CODE_BIN) --new-window $(TEST_WORKSPACE) & \
	fi; \
	echo ""; \
	echo "========================================"; \
	echo "Local Test Setup Complete!"; \
	echo "Extension ID: $(EXT_ID)"; \
	echo "VSIX: $$LOCAL_VSIX"; \
	echo "Workspace: $(TEST_WORKSPACE)"; \
	echo "Build Counter: $$NEW_COUNT"; \
	echo "========================================";
