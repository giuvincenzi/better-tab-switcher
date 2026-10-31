import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The program that gives the system's own input on macOS (tests/e2e/mac-keys.swift) and on Windows
// (tests/e2e/windows-input.cs), built once before every test (tests/e2e/global-setup.ts): built in the first test that
// used it, it took that test's time (about 20 s for Swift on GitHub's macOS machines), and the test ran out of it.
// Linux needs none: tests/e2e/x11.py runs as it is.

/** Where the global setup tells the tests' workers the program it built. */
const SYSTEM_TOOL = 'E2E_SYSTEM_TOOL';

/** Builds this system's program, or nothing on Linux. Fails with the compiler's messages. */
export function buildSystemTool(): string | undefined {
  if (process.platform === 'darwin') {
    const built = join(mkdtempSync(join(tmpdir(), 'mac-keys-')), 'mac-keys');
    // Swift comes with Xcode on GitHub's macOS machines.
    run('swiftc', ['-O', resolve('tests/e2e/mac-keys.swift'), '-o', built], 'tests/e2e/mac-keys.swift');
    return built;
  }
  if (process.platform === 'win32') {
    const built = join(mkdtempSync(join(tmpdir(), 'windows-input-')), 'windows-input.exe');
    const source = resolve('tests/e2e/windows-input.cs');
    // PowerShell's own C# compiler (Add-Type), which finds the assemblies it uses by name (Windows' accessibility, UI
    // Automation, among them).
    run(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Add-Type -TypeDefinition (Get-Content -Raw '${source}') -OutputAssembly '${built}' -OutputType ConsoleApplication ` +
          `-ReferencedAssemblies UIAutomationClient, UIAutomationTypes, WindowsBase, System.Drawing, System.Windows.Forms`,
      ],
      'tests/e2e/windows-input.cs',
    );
    return built;
  }
  return undefined;
}

/** The program built before the tests, for the system's input (macOS and Windows). */
export function systemTool(): string {
  const tool = process.env[SYSTEM_TOOL];
  if (!tool)
    throw new Error(`No ${SYSTEM_TOOL}: the global setup (tests/e2e/global-setup.ts) builds it before the tests.`);
  return tool;
}

/** Hands the program built to the tests' workers, which get the global setup's environment. */
export function shareSystemTool(tool: string | undefined) {
  if (tool) process.env[SYSTEM_TOOL] = tool;
}

function run(command: string, args: string[], source: string) {
  try {
    execFileSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    throw new Error(`${source} didn't build:\n${stdout ?? ''}${stderr ?? ''}`);
  }
}
