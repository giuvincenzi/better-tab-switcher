// Guide: the version select opens the same section in the chosen version.
const versionSelect = document.getElementById('version');
if (versionSelect) {
  versionSelect.addEventListener('change', () => {
    window.location.href = versionSelect.value;
  });
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The guide's figures: a click, Enter or Space shows the picture at full size, as far as the screen allows; a click, Esc
// or the close button closes it. Every guide version uses this script, so all of them get it. The home's views do not
// zoom: the carousel already shows them large.
const zoomables = document.querySelectorAll('.shot img');
if (zoomables.length && typeof HTMLDialogElement === 'function') {
  const dialog = document.createElement('dialog');
  dialog.className = 'zoom';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'zoom-close';
  close.textContent = '✕';
  close.setAttribute('aria-label', 'Close');
  const big = document.createElement('img');
  dialog.append(close, big);
  document.body.append(dialog);
  let opener = null;
  dialog.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    big.removeAttribute('src');
    if (opener) opener.focus();
  });
  zoomables.forEach((image) => {
    image.classList.add('zoomable');
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-haspopup', 'dialog');
    const open = () => {
      opener = image;
      big.src = image.currentSrc || image.src;
      big.alt = image.alt;
      dialog.showModal();
      close.focus();
    };
    image.addEventListener('click', open);
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

// The switcher's views on the home: a tab, an arrow or the keyboard's arrows on the tabs show a view's picture, and a
// click on the picture shows the next one, as the next arrow does. On phones the tabs give way to the view's name (style.css),
// and the pictures scroll with a finger. The tab, the name, the dots and the one caption
// follow the picture in sight.
const track = document.querySelector('.view-track');
if (track) {
  const tabs = [...document.querySelectorAll('.view-tabs [role="tab"]')];
  const views = [...track.querySelectorAll('.view')];
  const rtl = document.documentElement.dir === 'rtl';
  let current = 0;
  const pager = document.querySelector('.view-pager');
  const dots = [...document.querySelectorAll('.view-dots span')];
  const caption = document.querySelector('.view-caption');
  const select = (index, scroll) => {
    current = (index + views.length) % views.length;
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === current));
      tab.tabIndex = i === current ? 0 : -1;
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('current', i === current);
    });
    pager.textContent = tabs[current].textContent;
    caption.textContent = views[current].dataset.caption;
    if (scroll) {
      track.scrollTo({
        left: (rtl ? -1 : 1) * current * track.clientWidth,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    }
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i, true));
  });
  for (const tab of tabs) {
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
      const target = step ? current + step : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : null;
      if (target === null) return;
      event.preventDefault();
      select(target, true);
      tabs[current].focus();
    });
  }
  pager.hidden = false;
  for (const [selector, step] of [
    ['.view-previous', -1],
    ['.view-next', 1],
  ]) {
    const arrow = document.querySelector(selector);
    arrow.hidden = false;
    arrow.addEventListener('click', () => select(current + step, true));
  }
  for (const view of views) {
    view.querySelector('img').addEventListener('click', () => select(current + 1, true));
  }
  let settling;
  track.addEventListener(
    'scroll',
    () => {
      clearTimeout(settling);
      settling = setTimeout(() => {
        const inSight = Math.round(Math.abs(track.scrollLeft) / track.clientWidth);
        if (inSight !== current) select(inSight, false);
      }, 80);
    },
    { passive: true },
  );
}

// The visitor's browser first: in Microsoft Edge, the header's Install opens its store, and on the home its store's button
// is the main one.
const browserStore = /\bEdg\//.test(navigator.userAgent) ? 'edge' : 'chrome';
if (browserStore === 'edge') {
  for (const link of document.querySelectorAll('.header-install, .nav-install')) {
    link.href = link.dataset.edgeHref;
  }
}
const stores = document.querySelector('#install');
if (stores) {
  const first = stores.querySelector(`[data-store="${browserStore}"]`);
  const other = stores.querySelector(`[data-store]:not([data-store="${browserStore}"])`);
  stores.prepend(first);
  first.classList.replace('button-secondary', 'button-primary');
  other.classList.replace('button-primary', 'button-secondary');
}

// Home pages: the language the visitor chose (from the menu or the banner), remembered in this browser only.
const languageKey = 'bettertabswitcher.language';
function readLanguage() {
  try {
    return window.localStorage.getItem(languageKey);
  } catch {
    return null;
  }
}
function saveLanguage(code) {
  try {
    window.localStorage.setItem(languageKey, code);
  } catch {
    /* storage blocked: nothing is remembered */
  }
}

// Language menu: a choice is remembered; a click outside or Esc closes it.
const languageMenu = document.querySelector('.language-menu');
if (languageMenu) {
  languageMenu.querySelectorAll('a[data-language]').forEach((link) => {
    link.addEventListener('click', () => saveLanguage(link.dataset.language));
  });
  document.addEventListener('click', (event) => {
    if (languageMenu.open && !languageMenu.contains(event.target)) languageMenu.open = false;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && languageMenu.open) {
      languageMenu.open = false;
      languageMenu.querySelector('summary').focus();
    }
  });
}

// Phones' menu (style.css): the button opens the links under the header; a link, a click outside or Esc closes them.
// Without this script the header shows the links as they are.
const header = document.querySelector('.site-header');
const navToggle = header?.querySelector('.nav-toggle');
if (navToggle) {
  const setMenuOpen = (open) => {
    header.classList.toggle('nav-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  };
  header.classList.add('has-menu');
  navToggle.hidden = false;
  navToggle.addEventListener('click', () => setMenuOpen(navToggle.getAttribute('aria-expanded') !== 'true'));
  for (const link of header.querySelectorAll('.site-nav a')) {
    link.addEventListener('click', () => setMenuOpen(false));
  }
  document.addEventListener('click', (event) => {
    if (
      header.classList.contains('nav-open') &&
      !navToggle.contains(event.target) &&
      !header.querySelector('.site-nav').contains(event.target)
    )
      setMenuOpen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && header.classList.contains('nav-open')) {
      setMenuOpen(false);
      navToggle.focus();
    }
  });
}

// English home: when the browser prefers one of the other languages and the visitor has not chosen yet, a banner offers
// that language's home. The page never changes language by itself (search engines read the English one).
const offers = document.getElementById('language-offers');
const banner = document.getElementById('language-banner');
if (offers && banner && readLanguage() === null) {
  const pages = JSON.parse(offers.textContent);
  const offer = browserLanguage(Object.keys(pages));
  if (offer) {
    const page = pages[offer];
    banner.querySelector('.flag').replaceWith(flag(page));
    const text = banner.querySelector('.language-banner-text');
    text.textContent = page.text;
    text.lang = offer;
    const switchLink = banner.querySelector('a');
    switchLink.textContent = page.switch;
    switchLink.href = page.url;
    switchLink.hreflang = offer;
    switchLink.lang = offer;
    switchLink.addEventListener('click', () => saveLanguage(offer));
    const stay = banner.querySelector('button');
    stay.textContent = page.stay;
    stay.lang = offer;
    stay.addEventListener('click', () => {
      saveLanguage('en');
      banner.hidden = true;
    });
    banner.dir = page.dir;
    banner.hidden = false;
  }
}

// The first of the browser's languages that has a home page, or null when English comes first or none has one.
// Portuguese gives pt-BR; Chinese gives zh-Hans unless it is Traditional Chinese (as the extension does).
function browserLanguage(codes) {
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const tag of languages) {
    const lower = tag.toLowerCase();
    const base = lower.split('-')[0];
    if (base === 'en') return null;
    if (base === 'zh') {
      if (/hant|-tw|-hk|-mo/.test(lower)) continue;
      if (codes.includes('zh-Hans')) return 'zh-Hans';
      continue;
    }
    if (base === 'pt' && codes.includes('pt-BR')) return 'pt-BR';
    const match = codes.find((code) => code.toLowerCase() === base);
    if (match) return match;
  }
  return null;
}

function flag(page) {
  if (page.flag) {
    const image = document.createElement('img');
    image.className = 'flag';
    image.src = page.flag;
    image.alt = '';
    return image;
  }
  const letter = document.createElement('span');
  letter.className = 'flag flag-letter';
  letter.setAttribute('aria-hidden', 'true');
  letter.textContent = page.letter;
  return letter;
}
