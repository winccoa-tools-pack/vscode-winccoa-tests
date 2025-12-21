# WinCC OA Log Parser Architecture

## Übersicht

Der Log Parser muss in der Lage sein, die PVSS_II.log-Datei zu parsen und Test-Ergebnisse zuverlässig zu extrahieren.

## Anforderungen

### 1. Test-Ablauf Identifikation
- **Problem**: Mehrfache Test-Läufe schreiben in dieselbe Log-Datei
- **Lösung**: Zeitstempel-basierte Filterung - nur Einträge nach Test-Start parsen

### 2. Parsing-Strategie
- **Von unten nach oben parsen**: Vom Ende der Datei bis alle benötigten Infos gefunden
- **Start-Marker**: `(INFO) Testcase 'xxx' write message: \n  Note: Start the test case`
- **Dieser Marker definiert die Grenzen**: Alles zwischen Start-Marker und nächstem Start-Marker (oder Ende) gehört zum Test

### 3. Test-Zustände
- `passed`: Test erfolgreich (mindestens ein `(OK)` ohne `(FAILED)` oder `(ABORTED)`)
- `failed`: Test fehlgeschlagen (mindestens ein `(FAILED)`)
- `aborted`: Test abgebrochen (`(ABORTED)`)

### 4. Mehrfache Assertions pro Test
- **Problem**: Ein Test kann mehrere `assert` Aufrufe haben
- **Lösung**: Alle `(OK)`, `(FAILED)` und `(ABORTED)` Einträge für einen Test sammeln
- **Endstatus**: 
  - Wenn mindestens ein `(ABORTED)` → Status = `aborted`
  - Sonst wenn mindestens ein `(FAILED)` → Status = `failed`
  - Sonst wenn nur `(OK)` → Status = `passed`

### 5. Informationen pro Assert sammeln
Für jede Assertion (FAILED, ABORTED):
- `message`: Die Fehlermeldung
- `note`: Der Note-Text (falls vorhanden)
- `stackTrace`: Kompletter Stack-Trace
- `errorMessage`: ErrMsg-Feld (bei Aborts besonders wichtig)
- `timestamp`: Zeitstempel
- `scriptPath`, `libraryPath`, `line`: Code-Location für Click-to-Source

### 6. Abort-Behandlung
Bei `(ABORTED)`:
- `ErrMsg` enthält die Fehlerursache → **MUSS angezeigt werden**
- Oft enthält `ErrMsg` auch Script + Line → **Link zum Code erstellen**
- Stack-Trace zeigt wo der Abort aufgetreten ist

## Log-Format-Muster

### Test Start
```
WCCOActrl    (3), 2025.12.21 16:32:03.173, CTRL, INFO,        6/oaUnit_errors, (INFO) Testcase 'tc_01_pass_only' write message: 
  Note: Start the test case
```

### Passed Assert
```
WCCOActrl    (3), 2025.12.21 16:32:03.174, SYS,  INFO,        1/oaUnit_errors, (OK) Testcase 'tc_01_pass_only' passed, 
  Note: pass: int equal
  StackTrace: 
	int TstParserStates::startTestCase(...) at /path/to/file.ctl:57
	...
```

### Failed Assert
```
WCCOActrl    (3), 2025.12.21 16:32:03.178, CTRL, WARNING,    13/oaUnit_errors, (FAILED) Testcase 'tc_02_single_fail' failed, actual value (1) is NOT equal to expected value (0), 
  Note: FAIL: 1 != 0 (single fail testcase)
  StackTrace: 
	int TstParserStates::startTestCase(...) at /path/to/file.ctl:79
	...
    Script: /path/to/script.ctl
    Library: /path/to/library.ctl
    Line: 503
```

### Aborted Test
```
WCCOActrl    (3), 2025.12.21 16:32:03.188, CTRL, SEVERE,      2/oaUnit_errors, (ABORTED) Testcase 'tc_05_...' aborted, 
  ErrMsg: Function not defined, 
    Script: /path/to/script.ctl
    Line: 142, assertPass
  StackTrace: 
	int OaTestBase::startSingle(...) at classes/oaTest/OaTestBase.ctl:384
	...
    Script: /path/to/script.ctl
    Library: /path/to/library.ctl
    Line: 384
```

## Neue Parser-Architektur

### Datenstrukturen

```typescript
export interface AssertionResult {
    type: 'passed' | 'failed' | 'aborted';
    message: string;
    note?: string;
    errorMessage?: string;
    stackTrace: StackTraceLocation[];
    scriptPath?: string;
    libraryPath?: string;
    line?: number;
    timestamp?: string;
}

export interface TestCaseResult {
    testCaseId: string;
    status: 'passed' | 'failed' | 'aborted';
    startTimestamp?: string;
    endTimestamp?: string;
    assertions: AssertionResult[];
}

export interface TestRunResult {
    testCases: Map<string, TestCaseResult>;
    summary: {
        passed: number;
        failed: number;
        aborted: number;
    };
}
```

### Parsing-Algorithmus

1. **Datei öffnen und von unten nach oben lesen**
   - Verwende `tail`-ähnlichen Ansatz oder lese komplette Datei und arbeite rückwärts

2. **Test-Grenzen identifizieren**
   - Suche nach Start-Marker: `(INFO) Testcase 'xxx' write message: \n  Note: Start the test case`
   - Sammle alle Zeilen bis zum nächsten Start-Marker (weiter oben)

3. **Für jeden Test-Block:**
   - Sammle alle `(OK)`, `(FAILED)`, `(ABORTED)` Einträge
   - Parse jeweils:
     - Message-Zeile
     - Note (falls vorhanden)
     - ErrMsg (falls vorhanden)
     - StackTrace (alle Zeilen)
     - Script/Library/Line am Ende

4. **Endstatus ermitteln**
   - Hat mindestens ein `(ABORTED)` → `aborted`
   - Hat mindestens ein `(FAILED)` → `failed`
   - Nur `(OK)` → `passed`

5. **Ergebnis aggregieren**
   - Alle Assertions zu einer TestCaseResult kombinieren

### Implementierungs-Schritte

1. **Phase 1: Rückwärts-Parser**
   - Datei von unten lesen
   - Test-Blöcke identifizieren

2. **Phase 2: Assertion-Parser**
   - Alle Assertion-Typen erkennen
   - Vollständige Informationen extrahieren

3. **Phase 3: Multi-Assert-Aggregation**
   - Mehrere Assertions zu einem Test-Ergebnis kombinieren

4. **Phase 4: UI-Integration**
   - Hauptfehler im Editor anzeigen (erste FAILED/ABORTED)
   - Alle Assertions im Test Results Panel

## Kritische Punkte der aktuellen Implementierung

### ❌ Probleme

1. **Von vorne nach hinten parsen**: 
   - Kann alte Test-Läufe erfassen
   - Keine klare Abgrenzung

2. **Nur letzte Occurrence speichern**:
   - Überschreibt frühere Assertions
   - Verliert Information bei Multi-Assert-Tests

3. **Kein Abort-Handling**:
   - `(ABORTED)` wird nicht erkannt
   - ErrMsg wird nicht geparst

4. **Keine Test-Grenzen**:
   - Weiß nicht wo Test anfängt/endet
   - Kann Assertions verschiedener Tests mischen

5. **Unvollständige Information**:
   - Script/Library/Line Felder werden ignoriert
   - ErrMsg wird nicht erfasst

### ✅ Was funktioniert

1. Basis-Parsing von FAILED/OK
2. Stack-Trace-Extraktion
3. Note-Extraktion
4. Zeitstempel-Handling

## Nächste Schritte

1. Neue Parser-Klasse erstellen: `TestRunParser`
2. Rückwärts-Lese-Mechanismus implementieren
3. Test-Block-Erkennung
4. Multi-Assert-Sammlung
5. Abort-Handling
6. Integration in TestController
