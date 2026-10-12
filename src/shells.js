// Colours for the handheld console around the screen (Settings > CONSOLE).
// Each sets the CSS variables used in style.css.
export const SHELLS = [
  { name: 'CLASSIC', page: '#1d1e26', light: '#e2dfd6', shell: '#d8d5cc', dark: '#b9b5aa', bezel: '#5c5e6c', ink: '#33378a', pad: '#26262c', button: '#9b2a5b', buttonDark: '#6e1c40', pill: '#8c8a94' },
  { name: 'GRAPE', page: '#17121f', light: '#a487cc', shell: '#7f62ab', dark: '#5a4380', bezel: '#2f2640', ink: '#f3ecff', pad: '#251d33', button: '#3b2d57', buttonDark: '#1e162e', pill: '#4c3d66' },
  { name: 'TEAL', page: '#0f1f1e', light: '#4cc5bb', shell: '#2aa198', dark: '#1b7a72', bezel: '#1d3b3a', ink: '#effffc', pad: '#173230', button: '#f2c14e', buttonDark: '#b88a1f', pill: '#1f5c57' },
  { name: 'CHERRY', page: '#1f0f12', light: '#e45a62', shell: '#c8323c', dark: '#962129', bezel: '#3b1d22', ink: '#fff2ea', pad: '#2a1a1d', button: '#2e2e33', buttonDark: '#111114', pill: '#7d1f26' },
  { name: 'BANANA', page: '#211d0c', light: '#f9e687', shell: '#f2d24b', dark: '#c9a822', bezel: '#4a4536', ink: '#3d3209', pad: '#2d2a20', button: '#3a7bd5', buttonDark: '#24549a', pill: '#a8902a' },
  { name: 'MIDNIGHT', page: '#08090d', light: '#3d4054', shell: '#2b2d3a', dark: '#1c1d27', bezel: '#11121a', ink: '#aeb4ff', pad: '#0c0d12', button: '#5560e0', buttonDark: '#343ca0', pill: '#474a5e' },
  { name: 'SNOW', page: '#2a2c33', light: '#ffffff', shell: '#f2f2ef', dark: '#d6d6d2', bezel: '#44464f', ink: '#575c69', pad: '#2b2b30', button: '#d84a4a', buttonDark: '#9a2e2e', pill: '#b4b4b8' },
];

const VARS = { page: '--page', light: '--shell-light', shell: '--shell', dark: '--shell-dark', bezel: '--bezel', ink: '--ink', pad: '--pad', button: '--button', buttonDark: '--button-dark', pill: '--pill' };

export function applyShell(i) {
  const s = SHELLS[((i % SHELLS.length) + SHELLS.length) % SHELLS.length];
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(VARS)) root.setProperty(v, s[k]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', s.page);
}
