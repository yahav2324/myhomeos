// apps/mobile/src/shared/components/categoryDropdown.tsx
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
  KeyboardAvoidingView,
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

/**
 * Web portal: guarantees top-most overlay even when RN-web Modal gets clipped by stacking contexts.
 */
export function WebPortal({ children }: { children: React.ReactNode }) {
  const isWeb = Platform.OS === 'web';
  const elRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isWeb) return;
    const d = document.createElement('div');
    d.style.position = 'fixed';
    d.style.left = '0';
    d.style.top = '0';
    d.style.width = '100%';
    d.style.height = '100%';
    d.style.zIndex = '2147483647';
    d.style.pointerEvents = 'none'; // חשוב!
    document.body.appendChild(d);
    elRef.current = d;

    return () => {
      try {
        document.body.removeChild(d);
      } catch {
        /* empty */
      }
      elRef.current = null;
    };
  }, [isWeb]);

  if (!isWeb || !elRef.current) return <>{children}</>;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createPortal } = require('react-dom') as typeof import('react-dom');
  return createPortal(children, elRef.current);
}

type Props = {
  value: ShoppingCategory | null;
  onChange: (v: ShoppingCategory | null) => void;
  label?: string;
  isRTL?: boolean;
  measureOnly?: boolean;
  onOpenChange?: (open: boolean) => void; // ✅ חדש
};

export function CategoryDropdown(props: Props) {
  const { value, onChange, label = 'קטגוריה', isRTL = false, measureOnly = false } = props;

  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');

  const selectedLabel = value ? SHOPPING_CATEGORY_LABELS_HE[value] : 'בחר קטגוריה';
  const ALL_CATEGORIES: ShoppingCategory[] = React.useMemo(() => {
    const x: any = SHOPPING_CATEGORIES as any;

    // אם זה כבר מערך - סבבה
    if (Array.isArray(x)) return x as ShoppingCategory[];

    // אם זה enum/object - קח values
    const vals = Object.values(x ?? {});
    // לפעמים enum של TS יוצר גם מספרים וגם מחרוזות, אז מסננים רק מחרוזות
    return vals.filter((v) => typeof v === 'string') as ShoppingCategory[];
  }, []);
  const options = React.useMemo(() => {
    const query = String(q ?? '').trim();
    if (!query) return ALL_CATEGORIES;

    return ALL_CATEGORIES.filter((c) =>
      String(SHOPPING_CATEGORY_LABELS_HE[c] ?? '').includes(query),
    );
  }, [q, ALL_CATEGORIES]);

  // ===== Bottom Sheet mechanics =====
  const SNAP_PCTS = React.useMemo(() => [0.35, 0.6, 0.82], []);
  const snapHeights = React.useMemo(
    () => SNAP_PCTS.map((p) => Math.round(SCREEN_H * p)),
    [SNAP_PCTS],
  );

  const [snapIdx, setSnapIdx] = React.useState(1);
  const sheetH = snapHeights[snapIdx];

  const translateY = React.useRef(new Animated.Value(snapHeights[1])).current;

  const closeSheet = React.useCallback(() => {
    Animated.timing(translateY, {
      toValue: sheetH,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setOpen(false);
      props.onOpenChange?.(false); // ✅
      setQ('');
    });
  }, [props, sheetH, translateY]);

  const openSheet = React.useCallback(
    (idx: number) => {
      const nextIdx = clamp(idx, 0, snapHeights.length - 1);
      const nextH = snapHeights[nextIdx];

      setSnapIdx(nextIdx);
      translateY.setValue(nextH);

      requestAnimationFrame(() => {
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 18,
        }).start();
      });
    },
    [snapHeights, translateY],
  );

  React.useEffect(() => {
    if (!open) return;
    openSheet(1);
  }, [open, openSheet]);

  const pan = React.useRef({ startY: 0, startIdx: 1 }).current;

  const goSnap = React.useCallback(
    (idx: number) => {
      const nextIdx = clamp(idx, 0, snapHeights.length - 1);
      setSnapIdx(nextIdx);

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
          const next = clamp(pan.startY + g.dy, 0, sheetH);
          translateY.setValue(next);
        },
        onPanResponderRelease: (_e, g) => {
          translateY.stopAnimation((val: number) => {
            const closeEnough = g.vy > 1.2 || val > sheetH * 0.35;
            if (closeEnough) return closeSheet();

            if (g.dy < -40) return goSnap(pan.startIdx + 1);
            if (g.dy > 40) return goSnap(pan.startIdx - 1);

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

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, sheetH],
    outputRange: [0.55, 0],
    extrapolate: 'clamp',
  });

  const Overlay = (
    <View style={styles.overlayRoot} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetH, transform: [{ translateY }] },
          Platform.OS === 'web' ? ({ position: 'fixed' } as any) : undefined,
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.dragArea}>
          <View style={styles.grabber} />
          <AppText tone="muted" style={{ marginTop: 6, fontWeight: '800' }}>
            גרור למעלה/למטה
          </AppText>
        </View>

        <View style={styles.sheetHeader}>
          <AppText style={{ fontSize: 18, fontWeight: '900' }}>בחר קטגוריה</AppText>
          <Pressable onPress={closeSheet} style={styles.closeBtn}>
            <AppText style={{ fontWeight: '900' }}>✕</AppText>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="חיפוש…"
            placeholderTextColor={theme.colors.muted}
            style={[styles.search, isRTL ? styles.textInputRTL : styles.textInputLTR]}
          />

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
                    <AppText tone="muted" dir={isRTL ? 'rtl' : 'ltr'}>
                      ללא קטגוריה
                    </AppText>
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
                  <AppText
                    style={[
                      { fontWeight: isOn ? '900' : '800' },
                      isRTL ? styles.textRTL : styles.textLTR,
                    ]}
                  >
                    {SHOPPING_CATEGORY_LABELS_HE[c]}
                  </AppText>
                  {isOn ? <AppText style={{ fontWeight: '900' }}>✓</AppText> : null}
                </Pressable>
              );
            }}
          />
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );

  return (
    <View style={{ gap: 8 }}>
      <AppText tone="muted" dir={isRTL ? 'rtl' : 'ltr'}>
        {label}
      </AppText>

      <Pressable
        onPress={
          measureOnly
            ? undefined
            : () => {
                props.onOpenChange?.(true);
                setOpen(true);
              }
        }
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.9 }]}
      >
        <AppText style={[styles.triggerText, isRTL ? styles.textRTL : styles.textLTR]}>
          {selectedLabel}
        </AppText>
        <AppText tone="muted" style={{ fontWeight: '900' }}>
          ▾
        </AppText>
      </Pressable>

      {measureOnly || !open ? null : Platform.OS === 'web' ? (
        <WebPortal>{Overlay}</WebPortal>
      ) : (
        <Modal
          visible={open}
          transparent
          animationType="none"
          onRequestClose={closeSheet}
          presentationStyle="overFullScreen"
          statusBarTranslucent
        >
          {Overlay}
        </Modal>
      )}
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
  triggerText: { fontWeight: '900', flex: 1, minWidth: 0 },

  // root overlay wrapper (important for web portal + native modal)
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
    zIndex: 2147483647,
  } as any,

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

    zIndex: 2147483647,
    elevation: 999999,

    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0px -10px 30px rgba(0,0,0,0.35)' } as any)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -8 },
          elevation: 999999,
        }),
  } as any,

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

  textRTL: { textAlign: 'right', writingDirection: 'rtl' } as any,
  textLTR: { textAlign: 'left', writingDirection: 'ltr' } as any,
  textInputRTL: { textAlign: 'right', writingDirection: 'rtl' } as any,
  textInputLTR: { textAlign: 'left', writingDirection: 'ltr' } as any,
});
