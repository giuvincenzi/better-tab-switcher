import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** tests/e2e/windows-input.cs, built once: a step takes milliseconds, not a PowerShell started for each. */
let tool: string | undefined;

/**
 * Builds tests/e2e/windows-input.cs into a program, with PowerShell's own C# compiler (Add-Type), which finds the
 * assemblies it uses by name (Windows' accessibility, UI Automation, among them). Fails with the compiler's messages.
 */
function build(): string {
  const built = join(mkdtempSync(join(tmpdir(), 'windows-input-')), 'windows-input.exe');
  const source = resolve('tests/e2e/windows-input.cs');
  try {
    execFileSync(
      'powershell',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Add-Type -TypeDefinition (Get-Content -Raw '${source}') -OutputAssembly '${built}' -OutputType ConsoleApplication ` +
          `-ReferencedAssemblies UIAutomationClient, UIAutomationTypes, WindowsBase, System.Drawing, System.Windows.Forms`,
      ],
      { encoding: 'utf8', stdio: 'pipe' },
    );
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: string; stderr?: string };
    throw new Error(`tests/e2e/windows-input.cs didn't build:\n${stdout ?? ''}${stderr ?? ''}`);
  }
  return built;
}

/** Runs one step of the system's own input on Windows (tests/e2e/windows-input.cs says which). */
export function windowsInput(...args: string[]): void {
  tool ??= build();
  execFileSync(tool, args);
}
