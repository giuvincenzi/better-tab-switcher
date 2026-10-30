// The Mac's own keyboard events for the end-to-end tests on macOS (tests/e2e/system.ts): CoreGraphics posts them as
// the keyboard does, a held modifier included (System Events' "key down" only marks the next keys as modified, and the
// page never hears the modifier itself).
//
// usage: mac-keys <down|up> <key code> [held modifiers: control shift command option]
//        mac-keys click <x> <y>    a click of the mouse at that point of the screen
import CoreGraphics

let arguments = CommandLine.arguments
if arguments.count == 4, arguments[1] == "click", let x = Double(arguments[2]), let y = Double(arguments[3]) {
  let point = CGPoint(x: x, y: y)
  for type in [CGEventType.leftMouseDown, .leftMouseUp] {
    CGEvent(mouseEventSource: nil, mouseType: type, mouseCursorPosition: point, mouseButton: .left)?
      .post(tap: .cghidEventTap)
  }
  exit(0)
}
guard arguments.count >= 3, let code = UInt16(arguments[2]) else {
  print("usage: mac-keys <down|up> <key code> [control] [shift] [command] [option]")
  exit(2)
}
var flags = CGEventFlags()
for modifier in arguments.dropFirst(3) {
  switch modifier {
  case "control": flags.insert(.maskControl)
  case "shift": flags.insert(.maskShift)
  case "command": flags.insert(.maskCommand)
  case "option": flags.insert(.maskAlternate)
  default: break
  }
}
let source = CGEventSource(stateID: .hidSystemState)
guard let event = CGEvent(keyboardEventSource: source, virtualKey: code, keyDown: arguments[1] == "down") else {
  exit(1)
}
event.flags = flags
event.post(tap: .cghidEventTap)
