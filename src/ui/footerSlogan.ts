import { getRequiredElement } from './dom';

/** Internet-famous festival / rave totem lines, memes, and harm-reduction slogans. */
const FESTIVAL_SLOGANS = [
  'DRINK MORE WATER',
  'HYDRATE OR DIEDRATE',
  "YOU'RE NOT ASCENDING YOU'RE DEHYDRATED",
  'WHO TF IS B2B?!',
  "DON'T DIE DRINK WATER",
  'EARPLUGS ARE SEXY',
  'PROTECT YA EARS',
  'BIG FISH LITTLE FISH CARDBOARD BOX',
  'IF LOST: FIND THE BASS',
  'MEET ME AT THE WATER STATION',
  'NO SERVICE? WAVE YOUR TOTEM',
  'PLUR VIBES ONLY',
  'PEACE LOVE UNITY RESPECT',
  'SEND LOCATION NOT NUDES',
  'IS THIS TECHNO?',
  'WE OUTSIDE',
  'LESS PHONE MORE BASS',
  'VIBES ONLY NO BAD ENERGY',
  'STAY WEIRD STAY HYDRATED',
  'BASS FACE ACTIVATED',
  'ONE MORE SONG (IT\'S 5 AM)',
  'FREE WATER IS A LOVE LANGUAGE',
  'CHECK ON YOUR RAVE FAM',
  'FIND YOUR SQUAD',
  'LOST? FOLLOW THE STROBES',
  'RAIL OR REGRET NOTHING',
  'GOOD TRIPS NEED WATER',
  'PACE YOURSELF LEGEND',
  'YOUR EARS WILL THANK YOU',
  'NOT THIRSTY YET? DRINK ANYWAY',
  'DANCE FIRST HYDRATE ALWAYS',
  'THIS DROP GOES HARD SO DO EARPLUGS',
  'STAY ELECTRIC STAY ALIVE',
  'LOOK UP FROM YOUR PHONE',
  'WHO HAS MY FRIEND?',
  'IF LOST, COME DANCE WITH US',
  'SHREK RAVE ENERGY',
  'TURN UP THE VIBES NOT THE VOLUME',
  'HOLY SHIT THAT DROP',
  'NEON SOUL GOOD VIBES',
  'RAVE FAMILY FOREVER',
  'GLOW WITH LOVE',
  'STAY IN THE POCKET',
  'REFILL STATION > MAIN STAGE FOMO',
  'SLEEP IS ALSO A SET',
  'HOME SAFE HITS DIFFERENT',
  'IDEME KU SKRINKAM',
  'AFTERKA KEDY??',
] as const;

const SLOGAN_ACCENTS = [
  { light: '#0066cc', dark: '#6eb5ff' },
  { light: '#0f766e', dark: '#2dd4bf' },
  { light: '#6d28d9', dark: '#a78bfa' },
  { light: '#be185d', dark: '#f472b6' },
  { light: '#0369a1', dark: '#38bdf8' },
  { light: '#047857', dark: '#34d399' },
  { light: '#4338ca', dark: '#818cf8' },
  { light: '#c2410c', dark: '#fb923c' },
] as const;

function pickRandomIndex(length: number, exclude?: number): number {
  if (length <= 1) {
    return 0;
  }

  let index = Math.floor(Math.random() * length);
  while (index === exclude) {
    index = Math.floor(Math.random() * length);
  }

  return index;
}

function applyRandomSlogan(
  footer: HTMLElement,
  sloganEl: HTMLElement,
  previous?: { sloganIndex: number; accentIndex: number },
): { sloganIndex: number; accentIndex: number } {
  const sloganIndex = pickRandomIndex(FESTIVAL_SLOGANS.length, previous?.sloganIndex);
  const accentIndex = pickRandomIndex(SLOGAN_ACCENTS.length, previous?.accentIndex);
  const accent = SLOGAN_ACCENTS[accentIndex];

  footer.style.setProperty('--slogan-accent-light', accent.light);
  footer.style.setProperty('--slogan-accent-dark', accent.dark);
  sloganEl.textContent = FESTIVAL_SLOGANS[sloganIndex];

  return { sloganIndex, accentIndex };
}

export function initFooterSlogan(): void {
  const footer = getRequiredElement('site-footer', HTMLElement);
  const sloganEl = getRequiredElement('footer-slogan', HTMLElement);
  const sloganContainer = sloganEl.closest('.footer-slogan');

  if (!(sloganContainer instanceof HTMLElement)) {
    throw new Error('Footer slogan container not found');
  }

  let current = applyRandomSlogan(footer, sloganEl);

  sloganContainer.classList.add('footer-slogan--interactive');
  sloganContainer.setAttribute('role', 'button');
  sloganContainer.setAttribute('tabindex', '0');
  sloganContainer.setAttribute('aria-label', 'Show another festival slogan');

  const showNextSlogan = (): void => {
    current = applyRandomSlogan(footer, sloganEl, current);
  };

  sloganContainer.addEventListener('click', showNextSlogan);
  sloganContainer.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showNextSlogan();
    }
  });
}
