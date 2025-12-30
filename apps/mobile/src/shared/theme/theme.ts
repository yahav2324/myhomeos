export const theme = {
  colors: {
    bg: '#0B0F14',
    card: '#111827',
    border: '#243244',
    text: '#E5E7EB',
    muted: '#9CA3AF',
    danger: '#F87171',
    ok: '#22C55E',
    low: '#F59E0B',
    empty: '#EF4444',
    primary: '#60A5FA',
    primaryDark: '#2563EB',
  },
  space: { xs: 6, sm: 10, md: 14, lg: 18, xl: 24 },
  radius: { md: 14, lg: 18, xl: 22 },
  shadow: {
    card: {
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
  },
} as const;
