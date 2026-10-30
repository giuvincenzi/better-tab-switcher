import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * The C# compiler of Windows' .NET Framework, which every Windows has, and the folder of its accessibility
 * (UI Automation) assemblies.
 */
const FRAMEWORK = join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319');

/** tests/e2e/windows-input.cs, built once: a step takes milliseconds, not a PowerShell started for each. */
let tool: string | undefined;

/** Runs one step of the system's own input on Windows (tests/e2e/windows-input.cs says which). */
export function windowsInput(...args: string[]): void {
  if (!tool) {
    const built = join(mkdtempSync(join(tmpdir(), 'windows-input-')), 'windows-input.exe');
    execFileSync(join(FRAMEWORK, 'csc.exe'), [
      '/nologo',
      '/optimize',
      `/out:${built}`,
      `/lib:${join(FRAMEWORK, 'WPF')}`,
      '/r:UIAutomationClient.dll',
      '/r:UIAutomationTypes.dll',
      '/r:WindowsBase.dll',
      '/r:System.Drawing.dll',
      '/r:System.Windows.Forms.dll',
      'tests/e2e/windows-input.cs',
    ]);
    tool = built;
  }
  execFileSync(tool, args);
}
