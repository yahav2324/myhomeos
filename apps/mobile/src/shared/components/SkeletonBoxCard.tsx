import { View, StyleSheet } from 'react-native';
import { Card } from '../ui/Card';
import { ShimmerBlock } from '../ui/ShimmerBlock';
import { theme } from '../theme/theme';

export const SkeletonBoxCard = () => {
  return (
    <Card>
      <View style={styles.skelRowTop}>
        <ShimmerBlock style={styles.skelTitle} />
        <ShimmerBlock style={styles.skelBadge} />
      </View>

      <ShimmerBlock style={styles.skelSub} />

      <View style={{ marginTop: theme.space.md }}>
        <View style={styles.skelBarTrack}>
          <ShimmerBlock style={styles.skelBarFill} />
        </View>
      </View>

      <View style={styles.skelMetaRow}>
        <ShimmerBlock style={styles.skelMeta} />
        <ShimmerBlock style={styles.skelMeta} />
      </View>

      <ShimmerBlock style={styles.skelTime} />
    </Card>
  );
};

const styles = StyleSheet.create({
  skelRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  skelBarTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skelBarFill: {
    height: '100%',
    width: '55%',
    borderRadius: 999,
  },
  skelTitle: {
    height: 18,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    flex: 1,
    maxWidth: 180,
  },
  skelBadge: {
    height: 22,
    width: 72,
    borderRadius: 999,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  skelSub: {
    marginTop: 10,
    height: 12,
    width: 120,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    opacity: 0.85,
  },
  skelMetaRow: {
    marginTop: theme.space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },
  skelMeta: {
    height: 12,
    width: 120,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    opacity: 0.8,
  },
  skelTime: {
    marginTop: theme.space.sm,
    height: 12,
    width: 140,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    opacity: 0.7,
  },
});
