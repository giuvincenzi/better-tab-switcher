import { execFileSync } from 'node:child_process';

/**
 * Microsoft Edge on Windows, with an extension loaded as the tests load it (developer mode), soon shows a bubble
 * "Turn off extensions in developer mode", which takes the keyboard's focus: the system's keys and focus would go to
 * it, not to the page. Users who install Better Tab Switcher from a store never see it. Answers it "Not now" as a user
 * does, with Windows' own accessibility (UI Automation): found among Edge's windows, clicked with the system's mouse.
 * Waits a few seconds for it; nothing when it doesn't come.
 */
export function dismissEdgeDeveloperModeBubble() {
  const script = `
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    Add-Type -Namespace System -Name Mouse -MemberDefinition @'
      [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
      [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, System.UIntPtr extra);
'@
    $automation = [System.Windows.Automation.AutomationElement]
    $named = New-Object System.Windows.Automation.PropertyCondition($automation::NameProperty, 'Not now')
    $edge = New-Object System.Windows.Automation.PropertyCondition($automation::ClassNameProperty, 'Chrome_WidgetWin_1')
    for ($try = 0; $try -lt 50; $try++) {
      foreach ($window in $automation::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $edge)) {
        $button = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $named)
        if ($button) {
          $box = $button.Current.BoundingRectangle
          [System.Mouse]::SetCursorPos([int]($box.X + $box.Width / 4), [int]($box.Y + $box.Height / 2)) | Out-Null
          [System.Mouse]::mouse_event(0x0002, 0, 0, 0, [System.UIntPtr]::Zero)
          [System.Mouse]::mouse_event(0x0004, 0, 0, 0, [System.UIntPtr]::Zero)
          exit 0
        }
      }
      Start-Sleep -Milliseconds 100
    }
  `;
  execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script]);
}
