/**
 * Copies a text to the clipboard, from a click (the user's gesture): true once it is there. The Clipboard API first;
 * its writing is allowed in the switcher's frame by the frame's allow="clipboard-write" (entrypoints/switcher.content.ts),
 * but a site can forbid it to every frame of its page (Permissions-Policy: clipboard-write=()), and Chrome then refuses
 * it (NotAllowedError, crbug.com/414348233). There the older copy command still works: that policy doesn't cover it
 * (tests/e2e: a site that forbids the clipboard). Both refused: false.
 */
export async function copyText(text: string, page: Document = document): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = page.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    // The command copies what is selected where the focus is: the text, focused a moment, then the focus back where it
    // was (the switcher's tabs keep the keyboard). Inside the open modal dialog, if there is one (the switcher is one):
    // outside it the page is inert, the text can't take the focus and nothing is copied, though the command says true.
    const focused = page.activeElement as HTMLElement | null;
    (focused?.closest('dialog[open]') ?? page.body).append(area);
    area.focus({ preventScroll: true });
    area.select();
    try {
      return page.execCommand('copy');
    } catch {
      return false;
    } finally {
      area.remove();
      focused?.focus({ preventScroll: true });
    }
  }
}
