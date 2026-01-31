import * as React from 'react';
import {
  View,
  Pressable,
  Modal,
  TextInput,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  FlatList,
  Platform,
} from 'react-native';
import { AppText } from '../../shared/ui/AppText';
import { theme } from '../../shared/theme/theme';
import {
  SHOPPING_CATEGORIES,
  SHOPPING_CATEGORY_LABELS_HE,
  type ShoppingCategory,
} from '@smart-kitchen/contracts';

const { height: SCREEN_H } = Dimensions.get('window');

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

export function CategoryDropdown(props: {
  value: ShoppingCategory | null;
  onChange: (v: ShoppingCategory | null) => void;
  label?: string;
}) {
  const { value, onChange, label = 'קטגוריה' } = props;

  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');

  const selectedLabel = value ? SHOPPING_CATEGORY_LABELS_HE[value] : 'בחר קטגוריה';

  const options = React.useMemo(() => {
    const query = q.trim();
    if (!query) return SHOPPING_CATEGORIES;
    return SHOPPING_CATEGORIES.filter((c) => SHOPPING_CATEGORY_LABELS_HE[c].includes(query));
  }, [q]);

  // ===== Bottom Sheet mechanics (Android-safe) =====
  // 3 snap points: נמוך/אמצע/גבוה
  const SNAP_PCTS = React.useMemo(() => [0.35, 0.6, 0.82], []);
  const snapHeights = React.useMemo(
    () => SNAP_PCTS.map((p) => Math.round(SCREEN_H * p)),
    [SNAP_PCTS],
  );

  const [snapIdx, setSnapIdx] = React.useState(1);
  const sheetH = snapHeights[snapIdx];

  // translateY is RELATIVE to the sheet itself:
  // 0 = open, sheetH = fully hidden (down)
  const translateY = React.useRef(new Animated.Value(SCREEN_H)).current;

  const openSheet = React.useCallback(
    (idx: number) => {
      setSnapIdx(idx);
      // כשמשנים גובה, מתחילים ממצב "סגור" ואז פותחים ל-0
      translateY.setValue(snapHeights[idx]);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start();
    },
    [snapHeights, translateY],
  );

  const closeSheet = React.useCallback(() => {
    Animated.timing(translateY, {
      toValue: sheetH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setOpen(false);
      setQ('');
    });
  }, [sheetH, translateY]);

  // כשהמודאל נפתח: open to middle snap
  React.useEffect(() => {
    if (!open) return;
    // חשוב: להבטיח ש-translateY רלוונטי לגובה הסנאפ שנבחר
    requestAnimationFrame(() => openSheet(1));
  }, [open, openSheet]);

  // Drag logic:
  // - drag down moves translateY toward sheetH (close)
  // - drag up: אם גררת מספיק למעלה -> snap גבוה יותר (גדל)
  const pan = React.useRef({ startY: 0, startIdx: 1 }).current;

  const goSnap = React.useCallback(
    (idx: number) => {
      const next = clamp(idx, 0, snapHeights.length - 1);
      setSnapIdx(next);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start();
    },
    [snapHeights.length, translateY],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
        onPanResponderGrant: () => {
          translateY.stopAnimation((val: number) => {
            pan.startY = val;
            pan.startIdx = snapIdx;
          });
        },
        onPanResponderMove: (_e, g) => {
          // only allow dragging down to close visually
          // (drag up handled by snapping on release)
          const next = clamp(pan.startY + g.dy, 0, sheetH);
          translateY.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          translateY.stopAnimation((val: number) => {
            // if pulled down enough or fast -> close
            const closeEnough = g.vy > 1.2 || val > sheetH * 0.35;
            if (closeEnough) return closeSheet();

            // otherwise decide snap by dy direction
            // drag up (dy negative) => increase height (higher snap)
            // drag down small => keep same snap
            if (g.dy < -40) {
              return goSnap(pan.startIdx + 1);
            }
            if (g.dy > 40) {
              return goSnap(pan.startIdx - 1);
            }
            // return to current snap
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 0,
              speed: 18,
            }).start();
          });
        },
      }),
    [closeSheet, goSnap, pan, sheetH, snapIdx, translateY],
  );

  // Backdrop opacity by translateY (0 -> 0.55, sheetH -> 0)
  const backdropOpacity = translateY.interpolate({
    inputRange: [0, sheetH],
    outputRange: [0.55, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ gap: 8 }}>
      <AppText tone="muted">{label}</AppText>

      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.9 }]}
      >
        <AppText style={{ fontWeight: '900' }}>{selectedLabel}</AppText>
        <AppText tone="muted" style={{ fontWeight: '900' }}>
          ▾
        </AppText>
      </Pressable>

      <Modal visible={open} transparent animationType="none" onRequestClose={closeSheet}>
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, { height: sheetH, transform: [{ translateY }] }]}>
          {/* Drag area */}
          <View {...panResponder.panHandlers} style={styles.dragArea}>
            <View style={styles.grabber} />
            <AppText tone="muted" style={{ marginTop: 6, fontWeight: '800' }}>
              גרור למעלה/למטה
            </AppText>
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <AppText style={{ fontSize: 18, fontWeight: '900' }}>בחר קטגוריה</AppText>
            <Pressable onPress={closeSheet} style={styles.closeBtn}>
              <AppText style={{ fontWeight: '900' }}>✕</AppText>
            </Pressable>
          </View>

          {/* Search */}
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="חיפוש…"
            placeholderTextColor={theme.colors.muted}
            style={styles.search}
          />

          {/* Options list */}
          <FlatList
            data={['__NONE__', ...options] as any[]}
            keyExtractor={(item) => String(item)}
            style={{ marginTop: 10, flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            contentContainerStyle={{ paddingBottom: 18 }}
            renderItem={({ item }) => {
              if (item === '__NONE__') {
                return (
                  <Pressable
                    onPress={() => {
                      onChange(null);
                      closeSheet();
                    }}
                    style={({ pressed }) => [styles.optionRow, pressed && styles.optionRowPressed]}
                  >
                    <AppText tone="muted">ללא קטגוריה</AppText>
                  </Pressable>
                );
              }

              const c = item as ShoppingCategory;
              const isOn = c === value;

              return (
                <Pressable
                  onPress={() => {
                    onChange(c);
                    closeSheet();
                  }}
                  style={({ pressed }) => [
                    styles.optionRow,
                    isOn && styles.optionRowOn,
                    pressed && styles.optionRowPressed,
                  ]}
                >
                  <AppText style={{ fontWeight: isOn ? '900' : '800' }}>
                    {SHOPPING_CATEGORY_LABELS_HE[c]}
                  </AppText>
                  {isOn ? <AppText style={{ fontWeight: '900' }}>✓</AppText> : null}
                </Pressable>
              );
            }}
          />
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,1)',
  },

  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    backgroundColor: '#0B1220',
    paddingHorizontal: 14,
    paddingTop: 8,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px -10px 30px rgba(0,0,0,0.35)' } as any)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -8 },
          elevation: 8,
        }),
  },

  dragArea: {
    alignItems: 'center',
    paddingVertical: 8,
  },

  grabber: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  search: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: '#0F172A',
  },

  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 10,
  },

  optionRowOn: {
    borderColor: 'rgba(251,191,36,0.55)',
    backgroundColor: 'rgba(251,191,36,0.10)',
  },

  optionRowPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
});
