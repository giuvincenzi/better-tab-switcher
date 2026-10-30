import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { type BrowserContext, chromium } from '@playwright/test';
import { browserPid } from './fixtures';

// The system's own input, beyond the browser: Playwright talks to the browser only, so what the user does with the
// keyboard and outside the browser (the browser's own shortcuts, another program coming to the front) is done here with
// the system's own tools. The tests using it run with a window on screen (test.use({ headed: true })): on Linux a
// desktop (xvfb-run on GitHub), on Windows and macOS theirs.

/** Where the other program's window is, on the screen, in its pixels: inside the smallest screen of the machines. */
const OTHER = { left: 600, top: 300, width: 400, height: 300 };

/** The X11 desktop's top-level windows on screen, or only those of a process (tests/e2e/x11.py). */
function x11Windows(pid?: number): string[] {
  return execFileSync('python3', ['tests/e2e/x11.py', 'windows', ...(pid ? [String(pid)] : [])], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

/** The X11 desktop's own input (tests/e2e/x11.py). */
const x11 = (...args: string[]) => execFileSync('python3', ['tests/e2e/x11.py', ...args]);

/** Runs PowerShell commands with user32's input functions at hand ([System.Input]), on Windows. */
function user32(commands: string) {
  const script = `
    Add-Type -Namespace System -Name Input -MemberDefinition @'
      [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
      [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, System.UIntPtr extra);
      [DllImport("user32.dll")] public static extern void keybd_event(byte key, byte scan, uint flags, System.UIntPtr extra);
'@
    ${commands}
  `;
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
}

/** A click of the system's mouse at a point of the screen, in its pixels, on Windows: it brings that window forward. */
function windowsClick(x: number, y: number) {
  user32(`
    [System.Input]::SetCursorPos(${Math.round(x)}, ${Math.round(y)}) | Out-Null
    [System.Input]::mouse_event(0x0002, 0, 0, 0, [System.UIntPtr]::Zero)
    [System.Input]::mouse_event(0x0004, 0, 0, 0, [System.UIntPtr]::Zero)
  `);
}

/** Brings a program to the front, on macOS (System Events, which GitHub's machines allow to tests). */
function macFront(pid: number) {
  execFileSync('osascript', [
    '-e',
    `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`,
  ]);
}

/**
 * Brings the tested browser's window to the front, as a click on it does: the system's keys go to it. On Windows the
 * click is in the middle of the window `at` (its screen position and size, in the screen's pixels).
 */
export async function focusBrowser(
  context: BrowserContext,
  at: { left: number; top: number; width: number; height: number },
) {
  const pid = browserPid.get(context) as number;
  if (process.platform === 'linux') x11('focus', x11Windows(pid)[0] as string);
  else if (process.platform === 'win32') windowsClick(at.left + at.width / 2, at.top + at.height / 2);
  else macFront(pid);
  await delay(300);
}

/** The keys the tests press, as each system names them. */
const KEYS = {
  Alt: { x11: 'Alt_L', windows: 0x12, mac: 'option' },
  Control: { x11: 'Control_L', windows: 0x11, mac: 'control' },
  Shift: { x11: 'Shift_L', windows: 0x10, mac: 'shift' },
  S: { x11: 's', windows: 0x53, mac: 's' },
} as const;
type Key = keyof typeof KEYS;
type Modifier = Exclude<Key, 'S'>;

/** Presses a modifier and holds it, as the keyboard does, to the window that has the system's focus. */
export function hold(modifier: Modifier) {
  const key = KEYS[modifier];
  if (process.platform === 'linux') x11('down', key.x11);
  else if (process.platform === 'win32')
    user32(`[System.Input]::keybd_event(${key.windows}, 0, 0, [System.UIntPtr]::Zero)`);
  else execFileSync('osascript', ['-e', `tell application "System Events" to key down ${key.mac}`]);
}

/** Lets a held modifier go. */
export function release(modifier: Modifier) {
  const key = KEYS[modifier];
  if (process.platform === 'linux') x11('up', key.x11);
  else if (process.platform === 'win32')
    user32(`[System.Input]::keybd_event(${key.windows}, 0, 2, [System.UIntPtr]::Zero)`);
  else execFileSync('osascript', ['-e', `tell application "System Events" to key up ${key.mac}`]);
}

/** Presses a letter and lets it go, the modifiers held staying held. */
export function press(letter: Exclude<Key, Modifier>) {
  const key = KEYS[letter];
  if (process.platform === 'linux') {
    x11('down', key.x11);
    x11('up', key.x11);
  } else if (process.platform === 'win32') {
    user32(`
      [System.Input]::keybd_event(${key.windows}, 0, 0, [System.UIntPtr]::Zero)
      [System.Input]::keybd_event(${key.windows}, 0, 2, [System.UIntPtr]::Zero)
    `);
  } else {
    execFileSync('osascript', ['-e', `tell application "System Events" to keystroke "${key.mac}"`]);
  }
}

/**
 * Starts another program, a browser of its own (not the one tested, nothing shared with it), and brings it to the
 * front as the user would: the browser tested loses the system's focus. Returns how to close it.
 */
export async function focusAnotherProgram(): Promise<() => Promise<void>> {
  const profile = mkdtempSync(join(tmpdir(), 'other-program-'));
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
    const pid = other.pid as number;
    let window: string | undefined;
    for (let tries = 0; tries < 100 && !window; tries++) {
      await delay(100);
      window = process.platform === 'linux' ? x11Windows(pid)[0] : 'on screen';
    }
    await delay(1000);
    if (process.platform === 'linux') x11('focus', window as string);
    else if (process.platform === 'win32') windowsClick(OTHER.left + OTHER.width / 2, OTHER.top + OTHER.height / 2);
    else macFront(pid);
    return close;
  } catch (error) {
    await close();
    throw error;
  }
}
