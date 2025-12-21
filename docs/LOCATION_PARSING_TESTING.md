# Location Parsing - Testing Guide

## Problem

Inline Fehleranzeigen in VS Code Test Explorer erscheinen am Ende der Datei statt an der richtigen Zeile.

## Ursache

Die TestMessage Location wird aus den JSON-Assertions extrahiert. Wenn ein Test mehrere Assertions hat, muss die richtige (failed/aborted) Assertion für die Location verwendet werden.

## Lösung

Die `createJsonTestMessage()` Methode im TestController priorisiert jetzt:
1. **Erste failed/aborted Assertion** mit Location
2. Falls keine failed/aborted Location: **Erste beliebige Assertion** mit Location

## Location-Tests Ausführen

Die Location-Tests prüfen ob die Locations korrekt aus der JSON geparst werden:

### 1. fullResult.json generieren

Führe zuerst einen echten Test in WinCC OA aus:

```bash
# Im VS Code Test Explorer:
# - Öffne einen WinCC OA Test (z.B. tst_ParserStates.ctl)
# - Klicke auf "Run Test" Icon
# - Warte bis Test fertig ist
```

Die Extension erstellt automatisch `/home/testus/wincc_proj/DevEnv/fullResult.json`.

### 2. Datei für Tests verfügbar machen

Da die Extension die fullResult.json nach dem Parsen löscht, kopiere sie:

```bash
# WÄHREND der Test läuft oder direkt danach (bevor die Extension sie löscht):
cp /home/testus/wincc_proj/DevEnv/fullResult.json /tmp/fullResult_backup.json

# Kopiere sie zurück für Tests:
cp /tmp/fullResult_backup.json /home/testus/wincc_proj/DevEnv/fullResult.json
```

### 3. Location-Tests ausführen

```bash
cd /home/testus/vscode_wincc_extenssion/vscode-winccoa-tests
npm test
```

Die Location-Tests (`locationParsing.test.ts`) prüfen:
- ✅ Failed Assertions haben korrekte File Locations
- ✅ Line Numbers sind korrekt (nicht am Ende der Datei)
- ✅ Locations zeigen auf Test-File, nicht auf OaTestBase Library
- ✅ Jede Assertion hat ihre eigene Line Number
- ✅ Aborted Tests haben korrekte Locations

## Debugging

Wenn Locations immer noch am Ende der Datei erscheinen:

### 1. Prüfe JSON Location String

```bash
grep -A 5 "FAILED" /home/testus/wincc_proj/DevEnv/fullResult.json | head -20
```

Sollte zeigen:
```json
{
    "Location": "\n    Script: /path/to/test.ctl\n    Library: /path/to/lib.ctl\n    Line: 79",
    ...
}
```

### 2. Prüfe Parser Output

Füge Debug-Logging in `jsonResultParser.ts` hinzu:

```typescript
private static parseLocation(locationStr: string): vscode.Location | undefined {
    const scriptMatch = locationStr.match(/Script:\s*(.+)/);
    const lineMatch = locationStr.match(/Line:\s*(\d+)/);

    console.log('[DEBUG] Location string:', locationStr);
    console.log('[DEBUG] Script match:', scriptMatch?.[1]);
    console.log('[DEBUG] Line match:', lineMatch?.[1]);
    
    // ... rest of code
}
```

### 3. Prüfe TestController Location Setting

Die Extension logged jetzt automatisch:
```
[TestController] Set message location to failed assertion at /path/to/test.ctl:79
```

Suche nach diesen Messages im Output Channel.

### 4. Manuelle Prüfung

```bash
# Zeige alle Line-Nummern in fullResult.json
grep -o '"Line": [0-9]*' /home/testus/wincc_proj/DevEnv/fullResult.json | sort -u

# Zeige alle Script-Pfade
grep -o '"Script": "[^"]*"' /home/testus/wincc_proj/DevEnv/fullResult.json | sort -u
```

## Erwartetes Verhalten

Wenn korrekt:
- Failed Test → Location zeigt auf die Zeile mit `assertEqual()` im Test-File
- Aborted Test → Location zeigt auf die Zeile die `abort()` aufruft
- Multiple Failures → Location zeigt auf den **ersten** Fail

Wenn falsch:
- Location zeigt auf die **letzte Zeile** der Datei
- Location zeigt auf `OaTestBase.ctl` Library statt Test-File
- Alle Tests zeigen auf die **gleiche** Zeile

## Test Coverage

```bash
npm test -- --grep "Location Parsing"
```

Zeigt:
- ✔ Failed assertion should have correct file location
- ✔ Multiple assertions - each should have correct location  
- ✔ Aborted test should have location at abort line
- ✔ Location points to actual test file, not library
- ✔ ParseLocation extracts correct line from Location string
