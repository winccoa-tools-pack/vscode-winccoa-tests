# Test Workflow Migration

## Änderungen

Der TestController wurde von Log-Parsing auf JSON-Parsing umgestellt für zuverlässigere und vollständigere Test-Ergebnisse.

## Neuer Workflow

### 1. Vorbereitung
```typescript
// Prüfe ob alte Result-Dateien existieren
if (JsonResultParser.resultFilesExist(projectRoot)) {
    JsonResultParser.deleteResultFiles(projectRoot);
}

// Erstelle leere Result-Dateien
JsonResultParser.createResultFiles(projectRoot);
```

### 2. Test Ausführung
```typescript
// Führe Test über Script Actions aus
await TestRunner.executeTestFile(testUri);
```

### 3. Warten auf Ergebnisse
```typescript
// Warte bis fullResult.json vollständig geschrieben wurde
await waitForTestCompletion(projectRoot, 10000);
```

### 4. Parsen
```typescript
// Parse JSON Results
const results = await JsonResultParser.parseResults(projectRoot, testCaseIds);
```

### 5. Aufräumen
```typescript
// Lösche Result-Dateien
JsonResultParser.deleteResultFiles(projectRoot);
```

## Dateien Struktur

```
/home/testus/wincc_proj/DevEnv/          ← Project Root
├── fullResult.json                       ← Erstellt vor Test, gelöscht nach Parse
├── quickResult.json                      ← Erstellt vor Test, gelöscht nach Parse
├── config/
├── log/                                  ← Log Directory (für PathResolver)
│   └── PVSS_II.log
└── scripts/
    └── tests/
        └── test.ctl
```

## Vorteile

- ✅ **Zuverlässiger**: Strukturierte JSON statt Regex-Parsing
- ✅ **Vollständiger**: Alle Assertions mit Expected/Actual Values
- ✅ **Schneller**: Direktes JSON-Parsing statt Zeile-für-Zeile
- ✅ **Sauberer**: Automatisches Cleanup der Result-Dateien
- ✅ **Genauer**: Pre-parsed Stack Traces mit korrekten Locations

## Status Prioritäten

1. **Aborted** (höchste Priorität)
2. **Failed**
3. **Passed**

Beispiel: Ein Test mit `[Pass, Fail, Aborted]` wird als **aborted** markiert.

## Test Coverage

Alle 18 Unit Tests bestehen:
- ✅ JsonResultParser Tests (10)
- ✅ TestRunParser Tests (7)
- ✅ JSON Structure Tests (1)

## Migration Notes

- **Entfernt**: `LogParser.waitForTestResults()` aus executeTest
- **Neu**: `JsonResultParser.parseResults()` mit vollständigen Assertion-Details
- **Neu**: `waitForTestCompletion()` pollt fullResult.json bis Daten vorhanden
- **Neu**: `processTestResult()` verarbeitet JSON-basierte Results
- **Neu**: `createJsonTestMessage()` erstellt TestMessage aus JSON-Assertions
