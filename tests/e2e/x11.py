"""The X11 desktop's own input for the end-to-end tests on Linux (tests/e2e/system.ts), with the system's libraries only.

usage:
  x11.py windows       the top-level windows on screen (mapped), their ids, one per line
  x11.py windows <pid> the same, only those of that process (_NET_WM_PID)
  x11.py focus <id>    gives that window the keyboard focus, as the desktop does when the user clicks it
  x11.py down <key>    presses a key (an X11 keysym: Alt_L, Shift_L, Control_L, s, l, Escape…) and holds it
  x11.py up <key>      lets the key go
"""
import ctypes
import sys

x = ctypes.CDLL('libX11.so.6')
xtest = ctypes.CDLL('libXtst.so.6')
xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
x.XStringToKeysym.restype = ctypes.c_ulong
x.XStringToKeysym.argtypes = [ctypes.c_char_p]
x.XKeysymToKeycode.restype = ctypes.c_ubyte
x.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x.XOpenDisplay.restype = ctypes.c_void_p
x.XOpenDisplay.argtypes = [ctypes.c_char_p]
x.XDefaultRootWindow.restype = ctypes.c_ulong
x.XDefaultRootWindow.argtypes = [ctypes.c_void_p]
x.XQueryTree.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(ctypes.c_ulong),
                         ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong)),
                         ctypes.POINTER(ctypes.c_uint)]
x.XSetInputFocus.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
x.XRaiseWindow.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]


class XWindowAttributes(ctypes.Structure):
    _fields_ = [('x', ctypes.c_int), ('y', ctypes.c_int), ('width', ctypes.c_int), ('height', ctypes.c_int),
                ('border_width', ctypes.c_int), ('depth', ctypes.c_int), ('visual', ctypes.c_void_p),
                ('root', ctypes.c_ulong), ('class', ctypes.c_int), ('bit_gravity', ctypes.c_int),
                ('win_gravity', ctypes.c_int), ('backing_store', ctypes.c_int), ('backing_planes', ctypes.c_ulong),
                ('backing_pixel', ctypes.c_ulong), ('save_under', ctypes.c_int), ('colormap', ctypes.c_ulong),
                ('map_installed', ctypes.c_int), ('map_state', ctypes.c_int), ('all_event_masks', ctypes.c_long),
                ('your_event_mask', ctypes.c_long), ('do_not_propagate_mask', ctypes.c_long),
                ('override_redirect', ctypes.c_int), ('screen', ctypes.c_void_p)]


x.XGetWindowAttributes.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.POINTER(XWindowAttributes)]
IS_VIEWABLE = 2
x.XInternAtom.restype = ctypes.c_ulong
x.XInternAtom.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_int]
x.XGetWindowProperty.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_ulong, ctypes.c_long, ctypes.c_long,
                                 ctypes.c_int, ctypes.c_ulong, ctypes.POINTER(ctypes.c_ulong),
                                 ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_ulong),
                                 ctypes.POINTER(ctypes.c_ulong), ctypes.POINTER(ctypes.POINTER(ctypes.c_ulong))]


def pid_of(window):
    """The process that made the window (_NET_WM_PID), or None."""
    kind, size, count, left = ctypes.c_ulong(), ctypes.c_int(), ctypes.c_ulong(), ctypes.c_ulong()
    data = ctypes.POINTER(ctypes.c_ulong)()
    # XA_CARDINAL (6), one 32-bit value.
    x.XGetWindowProperty(display, window, x.XInternAtom(display, b'_NET_WM_PID', 1), 0, 1, 0, 6, ctypes.byref(kind),
                         ctypes.byref(size), ctypes.byref(count), ctypes.byref(left), ctypes.byref(data))
    return data[0] if count.value == 1 else None

display = x.XOpenDisplay(None)
if not display:
    sys.exit('No X11 display: the tests that use the desktop run on one (DISPLAY, xvfb-run on GitHub).')
root = x.XDefaultRootWindow(display)

command = sys.argv[1:]
if command[:1] == ['windows'] and len(command) <= 2:
    root_return, parent = ctypes.c_ulong(), ctypes.c_ulong()
    children, count = ctypes.POINTER(ctypes.c_ulong)(), ctypes.c_uint()
    x.XQueryTree(display, root, ctypes.byref(root_return), ctypes.byref(parent), ctypes.byref(children),
                 ctypes.byref(count))
    for i in range(count.value):
        attributes = XWindowAttributes()
        x.XGetWindowAttributes(display, children[i], ctypes.byref(attributes))
        if attributes.map_state == IS_VIEWABLE and (len(command) == 1 or pid_of(children[i]) == int(command[1])):
            print(hex(children[i]))
elif len(command) == 2 and command[0] == 'focus':
    window = int(command[1], 16)
    x.XRaiseWindow(display, window)
    # RevertToParent (2), CurrentTime (0).
    x.XSetInputFocus(display, window, 2, 0)
    x.XSync(display, 0)
elif len(command) == 2 and command[0] in ('down', 'up'):
    # XTEST: the key as the keyboard sends it, to the window with the focus.
    code = x.XKeysymToKeycode(display, x.XStringToKeysym(command[1].encode()))
    if not code:
        sys.exit(f'No key {command[1]} on this keyboard.')
    xtest.XTestFakeKeyEvent(display, code, command[0] == 'down', 0)
    x.XSync(display, 0)
else:
    sys.exit(__doc__)
