import { windowsInput } from './windows-input';

/**
 * Microsoft Edge on Windows, with an extension loaded as the tests load it (developer mode), soon shows a bubble
 * "Turn off extensions in developer mode", which takes the keyboard's focus: the system's keys and focus would go to
 * it, not to the page. Users who install Better Tab Switcher from a store never see it. Answers it "Not now" as a user
 * does, with Windows' own accessibility (UI Automation): found among Edge's windows, clicked with the system's mouse
 * (tests/e2e/windows-input.cs). Waits a few seconds for it; nothing when it doesn't come.
 */
export function dismissEdgeDeveloperModeBubble() {
  windowsInput('edge-bubble');
}
