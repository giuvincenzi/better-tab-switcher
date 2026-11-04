import { execFile, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import type { BrowserContext } from '@playwright/test';
import { browserExecutable } from '../../scripts/real-browser.mjs';
import { browserPid, browserPipe } from './fixtures';
import { systemTool } from './system-tool';
import { windowsInput } from './windows-input';

// The system's own input, beyond the browser: Playwright talks to the browser only, so what the user does with the
// keyboard and outside the browser (the browser's own shortcuts, another program coming to the front) is done here with
// the system's own tools. The tests using it run with a window on screen (test.use({ headed: true })): on Linux a
// desktop (xvfb-run on GitHub), on Windows and macOS theirs.
//
// Every tool runs without holding this process: Playwright's connection to the browser and the test sites' server
// (tests/e2e/site.ts) live in it, and a tool waited for at once (execFileSync) stopped both. On GitHub's Windows
// machines the browser's request to the test site got no answer for 30 s while a tool waited for a window (NetLog).

/** Runs a program to its end, this process going on meanwhile; its output. */
export async function run(command: string, args: string[]): Promise<string> {
  return (await promisify(execFile)(command, args, { encoding: 'utf8' })).stdout;
}

/** Where the other program's window is, on the screen, in its pixels: inside the smallest screen of the machines. */
const OTHER = { left: 600, top: 300, width: 400, height: 300 };

/** The X11 desktop's top-level windows on screen, or only those of a process (tests/e2e/x11.py). */
async function x11Windows(pid?: number): Promise<string[]> {
  return (await run('python3', ['tests/e2e/x11.py', 'windows', ...(pid ? [String(pid)] : [])]))
    .split('\n')
    .filter(Boolean);
}

/** The X11 desktop's own input (tests/e2e/x11.py). */
const x11 = (...args: string[]) => run('python3', ['tests/e2e/x11.py', ...args]);

/** Whether a process still runs. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The program a test brought to the front last, on macOS: the system's keys go to it (macKeysGoToFront). */
let macFrontPid: number | undefined;

/** Brings a program to the front, on macOS (System Events, which GitHub's machines allow to tests). */
async function macFront(pid: number) {
  await run('osascript', [
    '-e',
    `tell application "System Events" to set frontmost of (first process whose unix id is ${pid}) to true`,
  ]);
  macFrontPid = pid;
}

/**
 * On macOS the system's keys go to the program in front. Before a key goes down, that is still the one the test brought
 * there: another program that took the front meanwhile (a system dialog, an update) would get the keys, and the test
 * would fail far from the cause. It fails here instead, naming that program.
 */
async function macKeysGoToFront() {
  // None yet in this test: the one of an earlier test has ended with its browser.
  if (macFrontPid === undefined || !alive(macFrontPid)) return;
  const [name, pid] = (
    await run('osascript', [
      '-e',
      'tell application "System Events"',
      '-e',
      'set frontProcess to first process whose frontmost is true',
      '-e',
      'return (name of frontProcess) & ", " & (unix id of frontProcess)',
      '-e',
      'end tell',
    ])
  )
    .trim()
    .split(', ');
  if (Number(pid) !== macFrontPid)
    throw new Error(
      `The keys would go to ${name} (process ${pid}), which came to the front instead of process ${macFrontPid}.`,
    );
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
  if (process.platform === 'linux') await x11('focus', (await x11Windows(pid))[0] as string);
  else if (process.platform === 'win32')
    await windowsInput('click', String(Math.round(at.left + at.width / 2)), String(Math.round(at.top + at.height / 2)));
  else {
    await macFront(pid);
    await run(macTool(), ['click', String(at.left + at.width / 2), String(at.top + at.height / 2)]);
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
  T: { x11: 't', windows: 0x54, mac: 17, flag: '' },
} as const;
type Key = keyof typeof KEYS;
type Letter = 'S' | 'L' | 'T';
type Modifier = Exclude<Key, Letter>;

/** The modifiers held now, on macOS: each key event says them (its flags). */
const held = new Set<Modifier>();

/** tests/e2e/mac-keys.swift, built before the tests (tests/e2e/system-tool.ts). */
const macTool = systemTool;
function macKey(direction: 'down' | 'up', key: Key) {
  return run(macTool(), [direction, String(KEYS[key].mac), ...[...held].map((modifier) => KEYS[modifier].flag)]);
}

/** A key going down or up on the system's keyboard, to the window that has the system's focus. */
async function key(direction: 'down' | 'up', name: Key) {
  const codes = KEYS[name];
  if (process.platform === 'linux') await x11(direction, codes.x11);
  else if (process.platform === 'win32') await windowsInput('key', direction, String(codes.windows));
  else await macKey(direction, name);
}

/** Presses a modifier and holds it. */
export async function hold(modifier: Modifier) {
  if (process.platform === 'darwin') await macKeysGoToFront();
  held.add(modifier);
  await key('down', modifier);
}

/** Lets a held modifier go. */
export async function release(modifier: Modifier) {
  held.delete(modifier);
  await key('up', modifier);
}

/**
 * Presses a letter and lets it go, the modifiers held staying held. On macOS with System Events, which the browser's
 * shortcuts answer to (CoreGraphics' letter doesn't reach them), the modifiers held named with it; the modifiers
 * themselves go down and up with CoreGraphics, which the page hears.
 */
export async function press(letter: Letter) {
  if (process.platform === 'darwin') {
    await macKeysGoToFront();
    const using = [...held].map((modifier) => `${KEYS[modifier].flag} down`).join(', ');
    await run('osascript', [
      '-e',
      `tell application "System Events" to keystroke "${letter.toLowerCase()}"${using ? ` using {${using}}` : ''}`,
    ]);
    return;
  }
  await key('down', letter);
  await key('up', letter);
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
      window = process.platform === 'linux' ? (await x11Windows(pid))[0] : 'on screen';
    }
    await delay(1000);
    if (process.platform === 'linux') await x11('focus', window as string);
    else if (process.platform === 'win32') await windowsInput('click-window', 'Another program');
    else await macFront(pid);
    return close;
  } catch (error) {
    await close();
    throw error;
  }
}

/** Puts the keyboard focus in the browser's address bar, as Ctrl+L (Command+L on the Mac) does. */
export async function focusAddressBar() {
  const modifier = process.platform === 'darwin' ? 'Command' : 'Control';
  await hold(modifier);
  await press('L');
  await release(modifier);
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
  // When the click was sent, against when Chrome gave it to the extension (background-console).
  console.info(`(test) Toolbar button clicked at ${Date.now()}`);
  await send('Extensions.triggerAction', { id: extensionId, targetId: tab.targetId });
}

/**
 * A picture of the whole screen, as the user would see it (the browser's own bars and menus too, which a page's
 * screenshot leaves out), for a failed test's report: PNG, or nothing where the system gives none (Linux).
 */
export async function screenPicture(): Promise<Buffer | undefined> {
  const file = join(mkdtempSync(join(tmpdir(), 'screen-')), 'screen.png');
  if (process.platform === 'darwin') await run('screencapture', ['-x', file]);
  else if (process.platform === 'win32') await windowsInput('screen', file);
  else return undefined;
  return readFileSync(file);
}
