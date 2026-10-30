// The system's own input on Windows, for the end-to-end tests (tests/e2e/windows-input.ts builds it once with the C#
// compiler of Windows' .NET Framework, then runs it for each step):
//   click X Y            a click of the system's mouse at that point of the screen, in its pixels
//   key down|up CODE     a key going down or up (its virtual key code), to the window that has the system's focus
//   click-window TITLE   a click in the middle of the top-level window whose title starts so, where Windows has it
//                        (waits up to 5 s for it)
//   edge-bubble          answers Microsoft Edge's "Turn off extensions in developer mode" bubble "Not now", found
//                        with Windows' accessibility (UI Automation); waits up to 5 s for it, nothing when it doesn't come
//   screen FILE          a picture of the whole screen, as PNG
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Forms;

static class WindowsInput {
  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  [DllImport("user32.dll")] static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr window, StringBuilder text, int size);
  [DllImport("user32.dll")] static extern bool EnumWindows(WindowFound found, IntPtr data);
  delegate bool WindowFound(IntPtr window, IntPtr data);
  struct Rect { public int Left; public int Top; public int Right; public int Bottom; }

  const uint LeftDown = 0x0002, LeftUp = 0x0004, KeyUp = 0x0002;

  static void Click(int x, int y) {
    SetCursorPos(x, y);
    mouse_event(LeftDown, 0, 0, 0, UIntPtr.Zero);
    mouse_event(LeftUp, 0, 0, 0, UIntPtr.Zero);
  }

  static IntPtr WindowTitled(string title) {
    IntPtr result = IntPtr.Zero;
    EnumWindows(delegate (IntPtr window, IntPtr data) {
      if (!IsWindowVisible(window)) return true;
      StringBuilder text = new StringBuilder(512);
      GetWindowText(window, text, text.Capacity);
      if (!text.ToString().StartsWith(title, StringComparison.Ordinal)) return true;
      result = window;
      return false;
    }, IntPtr.Zero);
    return result;
  }

  static int Main(string[] args) {
    // The screen's own pixels, as the browser's windows give their positions.
    SetProcessDPIAware();
    switch (args[0]) {
      case "click":
        Click(int.Parse(args[1]), int.Parse(args[2]));
        return 0;
      case "key":
        keybd_event(byte.Parse(args[2]), 0, args[1] == "up" ? KeyUp : 0, UIntPtr.Zero);
        return 0;
      case "click-window": {
        for (int tries = 0; tries < 50; tries++) {
          IntPtr window = WindowTitled(args[1]);
          if (window != IntPtr.Zero) {
            Rect rect;
            GetWindowRect(window, out rect);
            Click((rect.Left + rect.Right) / 2, (rect.Top + rect.Bottom) / 2);
            return 0;
          }
          Thread.Sleep(100);
        }
        Console.Error.WriteLine("No window titled " + args[1] + ".");
        return 1;
      }
      case "edge-bubble": {
        Condition edge = new PropertyCondition(AutomationElement.ClassNameProperty, "Chrome_WidgetWin_1");
        Condition named = new PropertyCondition(AutomationElement.NameProperty, "Not now");
        for (int tries = 0; tries < 50; tries++) {
          foreach (AutomationElement window in AutomationElement.RootElement.FindAll(TreeScope.Children, edge)) {
            AutomationElement button = window.FindFirst(TreeScope.Descendants, named);
            if (button == null) continue;
            System.Windows.Rect box = button.Current.BoundingRectangle;
            Click((int)(box.X + box.Width / 4), (int)(box.Y + box.Height / 2));
            return 0;
          }
          Thread.Sleep(100);
        }
        return 0;
      }
      case "screen": {
        Rectangle screen = Screen.PrimaryScreen.Bounds;
        using (Bitmap picture = new Bitmap(screen.Width, screen.Height)) {
          using (Graphics graphics = Graphics.FromImage(picture)) {
            graphics.CopyFromScreen(screen.Location, Point.Empty, screen.Size);
          }
          picture.Save(args[1], ImageFormat.Png);
        }
        return 0;
      }
    }
    Console.Error.WriteLine("Unknown command " + args[0] + ".");
    return 2;
  }
}
