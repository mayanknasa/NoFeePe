export const colors = {
  // Backgrounds
  bgBase: '#07070B',
  bgElevated: '#0C0C14',

  // Glass surface
  glassFill: 'rgba(255, 255, 255, 0.055)',
  glassBorder: 'rgba(255, 255, 255, 0.10)',
  glassHighlight: 'rgba(255, 255, 255, 0.15)',

  // Brand Accent gradient stops
  accentStart: '#7C5CFF', // Ultraviolet
  accentEnd: '#22D3EE', // Electric Cyan
  accentGradient: ['#7C5CFF', '#22D3EE'] as const,

  // Statuses
  success: '#2BD9A0',
  successFill: 'rgba(43, 217, 160, 0.12)',
  successBorder: 'rgba(43, 217, 160, 0.25)',

  warning: '#FFB020',
  pending: '#FFB020',
  pendingFill: 'rgba(255, 176, 32, 0.12)',
  pendingBorder: 'rgba(255, 176, 32, 0.25)',

  danger: '#FF5470',
  dangerFill: 'rgba(255, 84, 112, 0.12)',
  dangerBorder: 'rgba(255, 84, 112, 0.25)',

  // Text hierarchy
  textPrimary: '#F5F6FA',
  textMuted: '#9AA0B4',
  textFaint: '#5A5F73',
  textPurpleLight: '#C4B5FD', // Light purple for text on dark backgrounds (11.8:1 AAA contrast)

  // Primary Button (Theme Purple)
  primaryButton: '#6338F2',
  primaryButtonHover: '#7247FF',
  primaryButtonBorder: '#7C5CFF',
  primaryButtonDisabled: '#1C1635',
  primaryButtonDisabledBorder: '#2E2452',
  primaryButtonText: '#FFFFFF',
  primaryButtonTextDisabled: '#5E5380',

  // Overlays
  overlayDim: 'rgba(0, 0, 0, 0.75)',
};

export const radii = {
  card: 28,
  button: 20,
  row: 16,
  pill: 999,
  sm: 8,
  md: 12,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
};

export const motion = {
  duration: 240,
  progressDuration: 300,
  easing: [0.22, 1, 0.36, 1] as const,
};

export const typography = {
  headingLg: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headingMd: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  headingSm: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.textPrimary,
    letterSpacing: -0.1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: colors.textMuted,
    lineHeight: 20,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    color: colors.textFaint,
  },
  captionMedium: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: colors.textMuted,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
  },
  currencyDisplay: {
    fontSize: 38,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'] as ['tabular-nums'],
    letterSpacing: -0.5,
  },
};
