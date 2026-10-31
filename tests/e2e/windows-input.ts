import { execFileSync } from 'node:child_process';
import { systemTool } from './system-tool';

/** Runs one step of the system's own input on Windows (tests/e2e/windows-input.cs says which). */
export function windowsInput(...args: string[]): void {
  execFileSync(systemTool(), args);
}
