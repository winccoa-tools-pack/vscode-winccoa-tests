import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as os from 'os';
import {
    getWinCCOAInstallationPathByVersion,
    getAvailableWinCCOAVersions,
    getWindowsAvailableVersions,
} from '@winccoa-tools-pack/npm-winccoa-core';

describe('winccoa-paths', () => {
    describe('getWinCCOAInstallationPathByVersion', () => {
        it('should return null for non-existent version', () => {
            const path = getWinCCOAInstallationPathByVersion('999.999');
            assert.strictEqual(path, null);
        });

        it('should cache results for same version', () => {
            const version = '3.19';
            const path1 = getWinCCOAInstallationPathByVersion(version);
            const path2 = getWinCCOAInstallationPathByVersion(version);

            // Should return same reference (cached)
            assert.strictEqual(path1, path2);
        });

        it('should handle different versions independently', () => {
            const path1 = getWinCCOAInstallationPathByVersion('3.19');
            const path2 = getWinCCOAInstallationPathByVersion('3.20');

            // Different versions can have different results
            // (may both be null if not installed, or different paths)
            assert.ok(path1 === null || typeof path1 === 'string');
            assert.ok(path2 === null || typeof path2 === 'string');
        });
    });

    describe('getAvailableWinCCOAVersions', () => {
        it('should return an array', () => {
            const versions = getAvailableWinCCOAVersions();
            assert.ok(Array.isArray(versions));
        });

        it('should cache results', () => {
            const versions1 = getAvailableWinCCOAVersions();
            const versions2 = getAvailableWinCCOAVersions();

            // Should return same reference (cached)
            assert.strictEqual(versions1, versions2);
        });

        it('should return versions in descending order', () => {
            const versions = getAvailableWinCCOAVersions();

            if (versions.length > 1) {
                for (let i = 0; i < versions.length - 1; i++) {
                    const current = versions[i];
                    const next = versions[i + 1];

                    // Parse versions for comparison
                    const [currMajor, currMinor] = current.split('.').map(Number);
                    const [nextMajor, nextMinor] = next.split('.').map(Number);

                    const currValue = currMajor * 100 + currMinor;
                    const nextValue = nextMajor * 100 + nextMinor;

                    assert.ok(
                        currValue >= nextValue,
                        `Versions should be descending: ${current} >= ${next}`,
                    );
                }
            }
        });

        it('should return valid version format', () => {
            const versions = getAvailableWinCCOAVersions();
            const versionRegex = /^\d+\.\d+(\.\d+)?$/;

            versions.forEach((version) => {
                assert.ok(
                    versionRegex.test(version),
                    `Version ${version} should match format X.Y or X.Y.Z`,
                );
            });
        });
    });

    describe('getWindowsAvailableVersions', () => {
        it('should return an array', () => {
            const versions = getWindowsAvailableVersions();
            assert.ok(Array.isArray(versions));
        });

        it('should return sorted versions in descending order', () => {
            const versions = getWindowsAvailableVersions();

            if (versions.length > 1) {
                for (let i = 0; i < versions.length - 1; i++) {
                    const current = versions[i];
                    const next = versions[i + 1];

                    const [currMajor, currMinor] = current.split('.').map(Number);
                    const [nextMajor, nextMinor] = next.split('.').map(Number);

                    const currValue = currMajor * 100 + currMinor;
                    const nextValue = nextMajor * 100 + nextMinor;

                    assert.ok(currValue >= nextValue);
                }
            }
        });

        it('should only be called on Windows in production', () => {
            // This test documents the expected behavior
            // In real usage, this function should only be called on win32 platform
            if (os.platform() !== 'win32') {
                // On non-Windows, registry commands will fail gracefully
                // and return empty array
                const versions = getWindowsAvailableVersions();
                assert.ok(Array.isArray(versions));
            }
        });
    });

    describe('Platform-specific behavior', () => {
        it('should handle current platform correctly', () => {
            const platform = os.platform();
            const versions = getAvailableWinCCOAVersions();

            assert.ok(Array.isArray(versions));

            // On any platform, should return array (may be empty if not installed)
            if (platform === 'win32') {
                // Windows: uses registry
                assert.ok(true, 'Windows platform detected');
            } else {
                // Unix/Linux: uses /opt/WinCC_OA
                assert.ok(true, 'Unix/Linux platform detected');
            }
        });
    });
});
