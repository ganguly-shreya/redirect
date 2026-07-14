// Calm & minimal design system: near-monochrome with a single teal accent.
// The accent is reserved for the primary button, active tab, links, and the
// "helped" state; danger is reserved for delete / "didn't help". Keeping every
// color here (and none inline in screens) is what keeps future screens consistent.

const tintLight = '#0D9488';
const tintDark = '#2DD4BF';

export const Colors = {
  light: {
    text: '#18181B',
    background: '#FFFFFF',
    card: '#F4F4F5',
    border: '#E4E4E7',
    tint: tintLight,
    icon: '#71717A',
    tabIconDefault: '#71717A',
    tabIconSelected: tintLight,
    danger: '#DC2626',
    success: tintLight,
  },
  dark: {
    text: '#FAFAFA',
    background: '#0B0B0D',
    card: '#1C1C1F',
    border: '#2A2A2E',
    tint: tintDark,
    icon: '#A1A1AA',
    tabIconDefault: '#A1A1AA',
    tabIconSelected: tintDark,
    danger: '#DC2626',
    success: tintDark,
  },
} as const;

// Base-8 spacing scale; screens use Spacing.screen for horizontal padding.
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  screen: 20,
} as const;

export const Radius = {
  card: 14,
} as const;
