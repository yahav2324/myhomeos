import * as React from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { theme } from '../theme/theme';
import { AppText } from '../ui/AppText';
import { AppButton } from '../ui/AppButton';

export function BoxActionsSheet({
  open,
  onClose,
  onRecalibrate,
  onDelete,
  boxName,
}: {
  open: boolean;
  onClose: () => void;
  onRecalibrate: () => void;
  onDelete: () => Promise<void>;
  boxName: string;
}) {
  const [showDanger, setShowDanger] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setShowDanger(false);
    setConfirmText('');
    setErr(null);
    setLoading(false);
  }, [open]);

  const canDelete = confirmText.trim().toUpperCase() === 'DELETE' && !loading;

  const doDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    setErr(null);
    try {
      await onDelete();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* overlay */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* sheet */}
      <View style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <AppText style={styles.sheetTitle}>Box actions</AppText>
              <AppText tone="muted" style={{ marginTop: 2 }}>
                {boxName}
              </AppText>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            >
              <AppText style={{ fontWeight: '900' }}>✕</AppText>
            </Pressable>
          </View>

          {/* actions */}
          <View style={{ marginTop: theme.space.md }}>
            <ActionRow
              label="Recalibrate full"
              sub="Update the 'full' reference for accurate %"
              onPress={onRecalibrate}
            />

            <View style={styles.divider} />

            {!showDanger ? (
              <Pressable
                onPress={() => setShowDanger(true)}
                style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.75 }]}
              >
                <View style={{ flex: 1 }}>
                  <AppText style={[styles.actionText, { color: theme.colors.empty }]}>
                    Delete box…
                  </AppText>
                  <AppText tone="muted" style={styles.actionSub}>
                    Remove this box from your account
                  </AppText>
                </View>
              </Pressable>
            ) : (
              <View style={{ marginTop: 8 }}>
                <AppText style={styles.dangerTitle}>Delete box</AppText>
                <AppText tone="muted" style={{ marginTop: 4 }}>
                  Type <AppText>DELETE</AppText> to confirm.
                </AppText>

                <TextInput
                  value={confirmText}
                  onChangeText={setConfirmText}
                  placeholder='Type "DELETE"'
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />

                {err ? (
                  <AppText tone="danger" style={{ fontWeight: '900', marginTop: 8 }}>
                    {err}
                  </AppText>
                ) : null}

                <AppButton
                  title={loading ? 'Deleting…' : 'Delete'}
                  onPress={doDelete}
                  disabled={!canDelete}
                  style={{ marginTop: theme.space.md }}
                />

                <AppButton
                  title="Cancel"
                  variant="ghost"
                  onPress={() => {
                    setShowDanger(false);
                    setConfirmText('');
                    setErr(null);
                  }}
                  style={{ marginTop: 10 }}
                />
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ActionRow({ label, sub, onPress }: { label: string; sub?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.75 }]}
    >
      <View style={{ flex: 1 }}>
        <AppText style={styles.actionText}>{label}</AppText>
        {sub ? (
          <AppText tone="muted" style={styles.actionSub}>
            {sub}
          </AppText>
        ) : null}
      </View>
      <AppText tone="muted" style={{ fontWeight: '900' }}>
        ›
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  sheetWrap: {
    position: 'absolute',
    left: theme.space.lg,
    right: theme.space.lg,
    bottom: theme.space.lg,
  },

  sheet: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card ?? '#0B1220',
    paddingHorizontal: theme.space.lg,
    paddingTop: 12,
    paddingBottom: theme.space.lg,
  },

  handle: {
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    opacity: 0.75,
  },

  topRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.md,
  },

  sheetTitle: { fontSize: 16, fontWeight: '900' },

  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
    marginVertical: 10,
  },

  actionRow: {
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  actionSub: {
    marginTop: 3,
    fontSize: 12,
  },

  dangerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.colors.empty,
  },

  input: {
    marginTop: theme.space.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.text,
    backgroundColor: '#0F172A',
  },
});
