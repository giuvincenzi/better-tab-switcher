import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import type { BrowserContext } from '@playwright/test';
import { browserExecutable } from '../../scripts/real-browser.mjs';
import { browserPid, browserPipe } from './fixtures';

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

/**
 * Clicks in the middle of the window with this title, where Windows has it (it may not be where it was asked to be,
 * and Microsoft Edge gives its windows to another of its processes), which brings it to the front.
 */
function windowsClickWindowTitled(title: string) {
  user32(`
    Add-Type -Namespace System -Name Window -MemberDefinition @'
      [DllImport("user32.dll")] public static extern bool GetWindowRect(System.IntPtr window, out RECT rect);
      public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
'@
    $window = $null
    for ($try = 0; $try -lt 50 -and -not $window; $try++) {
      $window = (Get-Process | Where-Object { $_.MainWindowTitle -like '${title}*' } | Select-Object -First 1).MainWindowHandle
      if (-not $window) { Start-Sleep -Milliseconds 100 }
    }
    if (-not $window) { throw 'No window titled ${title}.' }
    $rect = New-Object System.Window+RECT
    [System.Window]::GetWindowRect($window, [ref]$rect) | Out-Null
    $x = [int](($rect.Left + $rect.Right) / 2); $y = [int](($rect.Top + $rect.Bottom) / 2)
    [System.Input]::SetCursorPos($x, $y) | Out-Null
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
 * Brings the tested browser's window to the front, as a click on it does: the system's keys go to it. On Windows and
 * macOS the click is in the middle of the window `at` (its screen position and size, in the screen's pixels).
 */
export async function focusBrowser(
  context: BrowserContext,
  at: { left: number; top: number; width: number; height: number },
) {
  const pid = browserPid.get(context) as number;
  if (process.platform === 'linux') x11('focus', x11Windows(pid)[0] as string);
  else if (process.platform === 'win32') windowsClick(at.left + at.width / 2, at.top + at.height / 2);
  else {
    macFront(pid);
    execFileSync(macTool(), ['click', String(at.left + at.width / 2), String(at.top + at.height / 2)]);
  }
  await delay(300);
}

/** The keys the tests press, as each system names them (macOS: virtual key codes, and the modifier's flag). */
const KEYS = {
  Alt: { x11: 'Alt_L', windows: 0x12, mac: 58, flag: 'option' },
  Control: { x11: 'Control_L', windows: 0x11, mac: 59, flag: 'control' },
  Shift: { x11: 'Shift_L', windows: 0x10, mac: 56, flag: 'shift' },
  Command: { x11: 'Super_L', windows: 0x5b, mac: 55, flag: 'command' },
  S: { x11: 's', windows: 0x53, mac: 1, flag: '' },
  L: { x11: 'l', windows: 0x4c, mac: 37, flag: '' },
} as const;
type Key = keyof typeof KEYS;
type Letter = 'S' | 'L';
type Modifier = Exclude<Key, Letter>;

/** The modifiers held now, on macOS: each key event says them (its flags). */
const held = new Set<Modifier>();

/** tests/e2e/mac-keys.swift, built once (Swift comes with Xcode on GitHub's macOS machines). */
let macKeys: string | undefined;
function macTool(): string {
  if (!macKeys) {
    macKeys = join(mkdtempSync(join(tmpdir(), 'mac-keys-')), 'mac-keys');
    execFileSync('swiftc', ['-O', 'tests/e2e/mac-keys.swift', '-o', macKeys]);
  }
  return macKeys;
}
function macKey(direction: 'down' | 'up', key: Key) {
  execFileSync(macTool(), [direction, String(KEYS[key].mac), ...[...held].map((modifier) => KEYS[modifier].flag)]);
}

/** A key going down or up on the system's keyboard, to the window that has the system's focus. */
function key(direction: 'down' | 'up', name: Key) {
  const codes = KEYS[name];
  if (process.platform === 'linux') x11(direction, codes.x11);
  else if (process.platform === 'win32')
    user32(`[System.Input]::keybd_event(${codes.windows}, 0, ${direction === 'down' ? 0 : 2}, [System.UIntPtr]::Zero)`);
  else macKey(direction, name);
}

/** Presses a modifier and holds it. */
export function hold(modifier: Modifier) {
  held.add(modifier);
  key('down', modifier);
}

/** Lets a held modifier go. */
export function release(modifier: Modifier) {
  held.delete(modifier);
  key('up', modifier);
}

/**
 * Presses a letter and lets it go, the modifiers held staying held. On macOS with System Events, which the browser's
 * shortcuts answer to (CoreGraphics' letter doesn't reach them), the modifiers held named with it; the modifiers
 * themselves go down and up with CoreGraphics, which the page hears.
 */
export function press(letter: Letter) {
  if (process.platform === 'darwin') {
    const using = [...held].map((modifier) => `${KEYS[modifier].flag} down`).join(', ');
    execFileSync('osascript', [
      '-e',
      `tell application "System Events" to keystroke "${letter.toLowerCase()}"${using ? ` using {${using}}` : ''}`,
    ]);
    return;
  }
  key('down', letter);
  key('up', letter);
}

/**
 * Starts another program, a browser of its own (not the one tested, nothing shared with it), and brings it to the
 * front as the user would: the browser tested loses the system's focus. Returns how to close it.
 */
export async function focusAnotherProgram(): Promise<() => Promise<void>> {
  const profile = mkdtempSync(join(tmpdir(), 'other-program-'));
  // The browser the tests run in, as another program of its own: the one sure to be on the machine.
  const other = spawn(
    browserExecutable(process.env.E2E_BROWSER ?? 'chromium'),
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
    else if (process.platform === 'win32') windowsClickWindowTitled('Another program');
    else macFront(pid);
    return close;
  } catch (error) {
    await close();
    throw error;
  }
}

/** Puts the keyboard focus in the browser's address bar, as Ctrl+L (Command+L on the Mac) does. */
export function focusAddressBar() {
  const modifier = process.platform === 'darwin' ? 'Command' : 'Control';
  hold(modifier);
  press('L');
  release(modifier);
}

/**
 * Clicks the extension's toolbar button for the tab of this page, as the browser does when the user clicks it: the
 * button's own action (Extensions.triggerAction), with the button's grant of the page (activeTab). The browser's window
 * on screen: a browser with none runs no button.
 */
export async function clickToolbarButton(context: BrowserContext, extensionId: string, pageUrl: string) {
  const send = browserPipe.get(context) as (method: string, params?: object) => Promise<unknown>;
  const { targetInfos } = (await send('Target.getTargets', { filter: [{ type: 'tab' }] })) as {
    targetInfos: { targetId: string; url: string }[];
  };
  const tab = targetInfos.find((target) => target.url === pageUrl);
  if (!tab) throw new Error(`No tab shows ${pageUrl}.`);
  await send('Extensions.triggerAction', { id: extensionId, targetId: tab.targetId });
}

/**
 * A picture of the whole screen, as the user would see it (the browser's own bars and menus too, which a page's
 * screenshot leaves out), for a failed test's report: PNG, or nothing where the system gives none (Linux).
 */
export function screenPicture(): Buffer | undefined {
  const file = join(mkdtempSync(join(tmpdir(), 'screen-')), 'screen.png');
  if (process.platform === 'darwin') execFileSync('screencapture', ['-x', file]);
  else if (process.platform === 'win32')
    execFileSync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Add-Type -AssemblyName System.Windows.Forms, System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $picture = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height
      [System.Drawing.Graphics]::FromImage($picture).CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
      $picture.Save('${file}')`,
    ]);
  else return undefined;
  return readFileSync(file);
}
