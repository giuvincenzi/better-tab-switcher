import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

// The system's own input, beyond the browser: Playwright talks to the browser only, so what the user does outside it
// (another program coming to the front) is done here with the system's own tools. The tests using it run with a
// window on screen (test.use({ headed: true })): on Linux a desktop (xvfb-run on GitHub), on Windows and macOS theirs.

/** Where the other program's window is, on the screen, in its pixels: inside the smallest screen of the machines. */
const OTHER = { left: 600, top: 300, width: 400, height: 300 };

/** The X11 desktop's top-level windows (tests/e2e/x11.py). */
function x11Windows(): string[] {
  return execFileSync('python3', ['tests/e2e/x11.py', 'windows'], { encoding: 'utf8' }).split('\n').filter(Boolean);
}

/** A click of the system's mouse at a point of the screen, in its pixels (Windows: user32 through PowerShell). */
function windowsClick(x: number, y: number) {
  const script = `
    Add-Type -Namespace System -Name Mouse -MemberDefinition @'
      [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
      [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, System.UIntPtr extra);
'@
    [System.Mouse]::SetCursorPos(${Math.round(x)}, ${Math.round(y)}) | Out-Null
    [System.Mouse]::mouse_event(0x0002, 0, 0, 0, [System.UIntPtr]::Zero)
    [System.Mouse]::mouse_event(0x0004, 0, 0, 0, [System.UIntPtr]::Zero)
  `;
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

/**
 * Starts another program, a browser of its own (not the one tested, nothing shared with it), and brings it to the
 * front as the user would: the browser tested loses the system's focus. Returns how to close it.
 */
export async function focusAnotherProgram(): Promise<() => Promise<void>> {
  const profile = mkdtempSync(join(tmpdir(), 'other-program-'));
  const before = process.platform === 'linux' ? x11Windows() : [];
  const other = spawn(
    chromium.executablePath(),
    [
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      ...(process.platform === 'linux' ? ['--no-sandbox', '--ozone-platform=x11'] : []),
      `--window-position=${OTHER.left},${OTHER.top}`,
      `--window-size=${OTHER.width},${OTHER.height}`,
      'data:text/html,<title>Another program</title>',
    ],
    { stdio: 'ignore' },
  );
  const exited = new Promise((resolve) => other.once('exit', resolve));
  const close = async () => {
    other.kill();
    await exited;
    rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  };
  try {
    // Its window, once it is on screen.
    let window: string | undefined;
    for (let tries = 0; tries < 100 && !window; tries++) {
      await delay(100);
      if (process.platform === 'linux') window = x11Windows().find((id) => !before.includes(id));
      else window = 'on screen';
    }
    await delay(1000);
    if (process.platform === 'linux') {
      execFileSync('python3', ['tests/e2e/x11.py', 'focus', window as string]);
    } else if (process.platform === 'win32') {
      windowsClick(OTHER.left + OTHER.width / 2, OTHER.top + OTHER.height / 2);
    } else {
      execFileSync('osascript', [
        '-e',
        `tell application "System Events" to set frontmost of (first process whose unix id is ${other.pid}) to true`,
      ]);
    }
    return close;
  } catch (error) {
    await close();
    throw error;
  }
}
