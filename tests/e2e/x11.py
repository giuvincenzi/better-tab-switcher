"""The X11 desktop's own input for the end-to-end tests on Linux (tests/e2e/system.ts), with the system's libraries only.

usage:
  x11.py windows       the top-level windows on screen (mapped), their ids, one per line
  x11.py focus <id>    gives that window the keyboard focus, as the desktop does when the user clicks it
"""
import ctypes
import sys

x = ctypes.CDLL('libX11.so.6')
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

display = x.XOpenDisplay(None)
if not display:
    sys.exit('No X11 display: the tests that use the desktop run on one (DISPLAY, xvfb-run on GitHub).')
root = x.XDefaultRootWindow(display)

command = sys.argv[1:]
if command == ['windows']:
    root_return, parent = ctypes.c_ulong(), ctypes.c_ulong()
    children, count = ctypes.POINTER(ctypes.c_ulong)(), ctypes.c_uint()
    x.XQueryTree(display, root, ctypes.byref(root_return), ctypes.byref(parent), ctypes.byref(children),
                 ctypes.byref(count))
    for i in range(count.value):
        attributes = XWindowAttributes()
        x.XGetWindowAttributes(display, children[i], ctypes.byref(attributes))
        if attributes.map_state == IS_VIEWABLE:
            print(hex(children[i]))
elif len(command) == 2 and command[0] == 'focus':
    window = int(command[1], 16)
    x.XRaiseWindow(display, window)
    # RevertToParent (2), CurrentTime (0).
    x.XSetInputFocus(display, window, 2, 0)
    x.XSync(display, 0)
else:
    sys.exit(__doc__)
