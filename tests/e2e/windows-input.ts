import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { systemTool } from './system-tool';

/**
 * Runs one step of the system's own input on Windows (tests/e2e/windows-input.cs says which), this process going on
 * meanwhile: Playwright's connection to the browser and the test sites' server live in it (tests/e2e/system.ts).
 */
export async function windowsInput(...args: string[]): Promise<void> {
  await promisify(execFile)(systemTool(), args);
}
