# WinCC OA Test Explorer - Implementation Plan

## 📋 Überblick

Die Extension ist tatsächlich recht simpel strukturiert:
1. **Test Discovery** - Tests in `.ctl` Dateien finden
2. **Test Execution** - WinCC OA Test-Runner ausführen
3. **Output Parsing** - Test-Ergebnisse parsen
4. **Results Reporting** - Ergebnisse an VS Code zurückmelden

---

## 🎯 VS Code Testing API - Was müssen wir bedienen?

### 1. TestController (Haupteinstiegspunkt)
```typescript
controller = vscode.tests.createTestController(id, label)
```

**Verantwortlichkeiten:**
- ✅ Test Items verwalten (`controller.items`)
- ✅ Run Profiles erstellen (Run, Debug)
- ✅ Test Runs erzeugen und steuern

**Was wir implementieren müssen:**
```typescript
controller.createRunProfile(
  'Run',
  vscode.TestRunProfileKind.Run,
  runHandler,  // ← Unsere Run-Logik
  true
)
```

### 2. TestItem (Einzelne Tests)
```typescript
testItem = controller.createTestItem(id, label, uri)
```

**Hierarchie für WinCC OA:**
```
📁 Workspace Root
  └─ 📄 myModule_test.ctl
      ├─ 🧪 testFunction1()
      ├─ 🧪 testFunction2()
      └─ 🧪 testFunction3()
```

**Properties die wir setzen:**
- `testItem.uri` - Datei-URI
- `testItem.range` - Zeile/Spalte im Code
- `testItem.canResolveChildren` - Für lazy loading
- `testItem.children` - Sub-Tests (Funktionen)

### 3. TestRun (Ausführung & Ergebnisse)
```typescript
run = controller.createTestRun(request)
```

**Lifecycle während Ausführung:**
```typescript
run.started(testItem)              // Test startet
run.passed(testItem, duration)     // ✓ Success
run.failed(testItem, message)      // ✗ Failed
run.errored(testItem, message)     // ⚠ Error
run.skipped(testItem)              // ○ Skipped
run.end()                          // Abschluss
```

---

## 🏗️ Komponenten-Architektur

### Komponente 1: **Test Discovery**
**Datei:** `src/testDiscovery.ts`

**Aufgaben:**
1. Workspace nach `**/*_test.ctl` durchsuchen
2. Jede Datei nach Test-Funktionen parsen
3. Test-Hierarchie erstellen

**Parser-Logik:**
```typescript
// Pattern: function test*() oder testSuite()
const TEST_FUNCTION_PATTERN = /(?:^|\n)\s*(?:public\s+)?(?:function\s+)?(test\w+)\s*\(/gi

// Beispiel:
// function testAddition() { ... }
// testMultiplication() { ... }
```

**Output:**
```typescript
interface DiscoveredTest {
  file: vscode.Uri;
  tests: Array<{
    name: string;
    line: number;
    range: vscode.Range;
  }>;
}
```

---

### Komponente 2: **Test Execution**
**Datei:** `src/testRunner.ts`

**Aufgaben:**
1. WinCC OA Ctrl-Prozess starten
2. Test-Datei ausführen
3. Output sammeln

**WinCC OA Kommando:**
```bash
# Beispiel (muss angepasst werden):
WCCOActrl -proj <project> -f <test_file.ctl> -log +stderr
```

**Execution Flow:**
```typescript
async function executeTest(testFile: string): Promise<TestOutput> {
  const winccoaBin = config.get('winccoaBinPath');
  const cmd = `${winccoaBin}/WCCOActrl -f ${testFile}`;
  
  const { stdout, stderr } = await execPromise(cmd);
  return { stdout, stderr };
}
```

---

### Komponente 3: **Output Parser**
**Datei:** `src/testOutputParser.ts`

**Aufgaben:**
1. CTRL-Output parsen
2. Test-Status extrahieren (PASS/FAIL)
3. Fehler-Messages und Stack Traces finden
4. Assertions zuordnen

**Expected Output Format:**
```
[TEST] testAddition: PASS (120ms)
[TEST] testSubtraction: FAIL
  Expected: 5
  Actual: 3
  at line 45 in myModule_test.ctl
[TEST] testMultiplication: PASS (80ms)
```

**Parser Output:**
```typescript
interface TestResult {
  testName: string;
  status: 'pass' | 'fail' | 'error' | 'skip';
  duration?: number;
  message?: string;
  location?: { file: string; line: number };
}
```

---

### Komponente 4: **Results Mapper**
**Datei:** `src/resultsMapper.ts`

**Aufgaben:**
1. TestResults → VS Code TestRun API
2. Fehler-Messages formatieren
3. Locations/Ranges zuordnen

**Mapping:**
```typescript
function mapResultsToVSCode(
  results: TestResult[],
  run: vscode.TestRun,
  testItems: Map<string, vscode.TestItem>
) {
  for (const result of results) {
    const item = testItems.get(result.testName);
    
    switch (result.status) {
      case 'pass':
        run.passed(item, result.duration);
        break;
      case 'fail':
        const msg = new vscode.TestMessage(result.message);
        msg.location = new vscode.Location(item.uri, item.range);
        run.failed(item, msg, result.duration);
        break;
      // ...
    }
  }
}
```

---

## 📝 Minimales PoC - Step by Step

### Phase 1: Statische Test Discovery ✅
- [x] Dateien mit Pattern `**/*_test.ctl` finden
- [ ] Einfacher Parser für `function test*()` Pattern
- [ ] TestItems in Hierarchie erstellen

### Phase 2: Dummy Execution ✅
- [x] Run Handler implementiert
- [x] Simulierte Results (random pass/fail)
- [ ] Echte WinCC OA Integration

### Phase 3: Output Parsing
- [ ] WinCC OA Prozess starten
- [ ] stdout/stderr sammeln
- [ ] Basis-Parser für Test-Output

### Phase 4: Result Mapping
- [ ] Parser Results → VS Code API
- [ ] Fehler-Messages mit Locations
- [ ] Duration tracking

---

## 🔧 Technische Entscheidungen

### WinCC OA Test-Output Format
**Frage:** Wie sieht der Output aus?
- Standard WinCC OA Log-Format?
- Custom Test-Framework Output?
- Brauchen wir ein standardisiertes Format?

**Vorschlag:** 
Eigenes Test-Framework in CTRL entwickeln mit strukturiertem Output:
```ctrl
// testFramework.ctl
void reportTestResult(string testName, bool passed, string message) {
  DebugN("[VSTEST] " + testName + " | " + (passed ? "PASS" : "FAIL") + " | " + message);
}
```

### File Watching
- ✅ `vscode.workspace.createFileSystemWatcher` für Auto-Refresh
- Bereits implementiert in `testController.ts`

### Configuration
Settings die wir brauchen:
- ✅ `winccoaTests.testFilesPattern` (bereits da)
- ✅ `winccoaTests.winccoaBinPath` (bereits da)
- Neue: `winccoaTests.projectPath` - WinCC OA Projekt-Pfad

---

## 🎯 Nächste Schritte für PoC

### Step 1: Test Parser implementieren
```typescript
// src/testParser.ts
export function parseTestFile(content: string): ParsedTest[] {
  const tests: ParsedTest[] = [];
  const regex = /function\s+(test\w+)\s*\(/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    tests.push({
      name: match[1],
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  return tests;
}
```

### Step 2: WinCC OA Test Runner
```typescript
// src/testRunner.ts
export async function runWinCCOATest(
  testFile: string,
  winccoaBin: string
): Promise<string> {
  const child = spawn(`${winccoaBin}/WCCOActrl`, ['-f', testFile]);
  // Output sammeln...
}
```

### Step 3: Output Parser
```typescript
// src/outputParser.ts
export function parseTestOutput(output: string): TestResult[] {
  // [VSTEST] testName | PASS | message
  const results: TestResult[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('[VSTEST]')) {
      const [_, testName, status, message] = line.split(' | ');
      results.push({ testName, status, message });
    }
  }
  
  return results;
}
```

---

## 📊 Zusammenfassung

### VS Code API Punkte:
1. ✅ `TestController` - Erstellt und registriert
2. ✅ `TestItem` - Hierarchie erstellen (basic)
3. ✅ `TestRun` - Run-Lifecycle (simuliert)
4. ⏳ Echte Test Discovery (Parser fehlt)
5. ⏳ Echte Test Execution (WinCC OA Integration)
6. ⏳ Output Parsing & Mapping

### Kritischer Pfad:
```
1. Test Parser (CTRL Syntax) 
   ↓
2. WinCC OA Runner Integration
   ↓
3. Output Format definieren
   ↓
4. Parser für Test Results
   ↓
5. VS Code Results Mapping
```

**Geschätzte Komplexität:** Mittel
- Test Discovery: Einfach (Regex)
- Test Execution: Mittel (Process Management)
- Output Parsing: Einfach-Mittel (abhängig vom Format)
- VS Code Integration: Einfach (API ist straightforward)

Lass uns loslegen! 🚀
