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
  'THIS DROP GOES HARD  SO DO EARPLUGS',
  'STAY ELECTRIC STAY ALIVE',
  'LOOK UP FROM YOUR PHONE',
  'WHO HAS MY FRIEND?',
  'CAMP NEIGHBORS ARE FRIENDS',
  'IF LOST, COME DANCE WITH US',
  'MAKE TRANCE GREAT AGAIN',
  'SHREK RAVE ENERGY',
  'AM I RAVING OR ASCENDING?',
  'TURN UP THE VIBES NOT THE VOLUME',
  'HOLY SHIT THAT DROP',
  'NEON SOUL GOOD VIBES',
  'RAVE FAMILY FOREVER',
  'GLOW WITH LOVE',
  'STAY IN THE POCKET',
  'REFILL STATION > MAIN STAGE FOMO',
  'SLEEP IS ALSO A SET',
  'HOME SAFE HITS DIFFERENT',
] as const;

const FUNKY_GRADIENTS = [
  ['#ff006e', '#8338ec', '#3a86ff'],
  ['#06ffa5', '#00d4ff', '#7b2cbf'],
  ['#ffbe0b', '#fb5607', '#ff006e'],
  ['#b5179e', '#7209b7', '#560bad'],
  ['#00f5d4', '#00bbf9', '#9b5de5'],
  ['#f72585', '#4361ee', '#4cc9f0'],
  ['#70e000', '#0077b6', '#ff006e'],
  ['#ff5400', '#ffbd00', '#90be6d'],
] as const;

export function initFooterSlogan(): void {
  const footer = getRequiredElement('site-footer', HTMLElement);
  const sloganEl = getRequiredElement('footer-slogan', HTMLElement);
  const gradient = FUNKY_GRADIENTS[Math.floor(Math.random() * FUNKY_GRADIENTS.length)];
  const slogan = FESTIVAL_SLOGANS[Math.floor(Math.random() * FESTIVAL_SLOGANS.length)];

  footer.style.setProperty('--slogan-c1', gradient[0]);
  footer.style.setProperty('--slogan-c2', gradient[1]);
  footer.style.setProperty('--slogan-c3', gradient[2]);
  sloganEl.textContent = slogan;
}
