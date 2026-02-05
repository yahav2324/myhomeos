import * as React from 'react';
import { View, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { AppText } from '../ui/AppText';
import { theme } from '../theme/theme';
import { I18nManager } from 'react-native';
import { WebPortal } from './categoryDropdown';

type TermStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type MyVote = 'UP' | 'DOWN' | null;

export type SuggestTerm = {
  termId: string;
  text: string;
  status: TermStatus;
  upCount: number;
  downCount: number;
  myVote?: MyVote;
};

type SuggestItem = { kind: 'create'; text: string } | { kind: 'term'; term: SuggestTerm };
function normText(s: string) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export type PickPayload =
  | { kind: 'term'; termId: string; text: string }
  | { kind: 'create'; text: string };

export function NameAutocompleteField(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  overlayActive?: boolean; // ✅ חדש
  minChars?: number;
  lang: string;
  isRTL?: boolean;
  fetchSuggest: (q: string, lang: string) => Promise<SuggestTerm[]>;
  onCreateNew: (text: string, lang: string) => Promise<void>;
  onVote: (termId: string, vote: 'UP' | 'DOWN') => Promise<void>;

  // ✅ חדש: למי שמריץ UX של "בחר -> הוסף לרשימה -> פתח מודאל"
  onPick?: (p: PickPayload) => void;
  existingNames?: string[]; // ✅ חדש
}) {
  const {
    label,
    value,
    onChangeText,
    placeholder,
    minChars = 2,
    lang,
    fetchSuggest,
    onCreateNew,
    onVote,
    onPick,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<SuggestItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const isRTL = props.isRTL ?? I18nManager.isRTL;
  const existingSet = React.useMemo(() => {
    const arr = props.existingNames ?? [];
    return new Set(arr.map(normText));
  }, [props.existingNames]);

  const q = value.trim();
  const tooShort = q.length < minChars;
  const alreadyExists = existingSet.has(normText(q));
  const hasResults = items.some((i) => i.kind === 'term');
  React.useEffect(() => {
    if (q.length < minChars) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;

      setLoading(true);

      fetchSuggest(q, lang)
        .then((arr) => {
          if (cancelled) return;
          const filtered = arr.filter((t) => !existingSet.has(normText(t.text)));
          const canCreate = !existingSet.has(normText(q));

          setItems([
            ...(canCreate ? ([{ kind: 'create', text: q }] as const) : []),
            ...filtered.map((t) => ({ kind: 'term', term: t }) as const),
          ]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350); // ✅ debounce ms (תשחק עם זה: 250-450)

    return () => {
      cancelled = true;
      clearTimeout(timer); // ✅ cancel debounce waiting
    };
  }, [q, lang, minChars, fetchSuggest, existingSet]);

  React.useEffect(() => {
    if (props.overlayActive) {
      setOpen(false);
    }
  }, [props.overlayActive]);

  async function pick(item: SuggestItem) {
    if (item.kind === 'term') {
      // ✅ מעדכן טקסט בשדה
      onChangeText(item.term.text);
      // ✅ מעדכן הורה (למשל: להוסיף פריט ולפתוח מודאל)
      onPick?.({ kind: 'term', termId: item.term.termId, text: item.term.text });
      setOpen(false);
      return;
    }

    // create
    const text = item.text;
    try {
      await onCreateNew(text, lang);
      onChangeText(text);
      onPick?.({ kind: 'create', text });
    } finally {
      setOpen(false);
    }
  }

  async function vote(termId: string, v: 'UP' | 'DOWN') {
    // optimistic update
    setItems((prev) =>
      prev.map((it) => {
        if (it.kind !== 'term' || it.term.termId !== termId) return it;

        const t = it.term;
        let up = t.upCount;
        let down = t.downCount;

        if (t.myVote === 'UP') up--;
        if (t.myVote === 'DOWN') down--;

        if (v === 'UP') up++;
        if (v === 'DOWN') down++;

        return {
          ...it,
          term: { ...t, upCount: up, downCount: down, myVote: v },
        };
      }),
    );

    await onVote(termId, v);
  }

  const anchorRef = React.useRef<View>(null);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  function renderDropdownContent() {
    return (
      <View style={styles.dropdownContent} pointerEvents="auto">
        {tooShort && (
          <AppText tone="muted" style={[styles.hint, isRTL ? styles.textRTL : styles.textLTR]}>
            מינימום {minChars} אותיות להשלמה
          </AppText>
        )}

        {!tooShort && alreadyExists && !hasResults && (
          <AppText tone="muted" style={[styles.hint, isRTL ? styles.textRTL : styles.textLTR]}>
            ✓ הפריט כבר קיים ברשימה
          </AppText>
        )}

        {!tooShort && !alreadyExists && !hasResults && !loading && (
          <AppText tone="muted" style={[styles.hint, isRTL ? styles.textRTL : styles.textLTR]}>
            לא נמצאו הצעות
          </AppText>
        )}

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator />
            <AppText tone="muted">טוען…</AppText>
          </View>
        )}

        {!loading &&
          items.map((it, idx) => {
            if (it.kind === 'create') {
              return (
                <Pressable
                  key={`create-${idx}`}
                  onPress={() => pick(it)}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                >
                  <AppText style={[{ fontWeight: '800' }, isRTL ? styles.textRTL : styles.textLTR]}>
                    ➕ הוסף ערך חדש: "{it.text}"
                  </AppText>
                  <AppText
                    tone="muted"
                    style={[{ marginTop: 4 }, isRTL ? styles.textRTL : styles.textLTR]}
                  >
                    ישמר במאגר לשימוש עתידי
                  </AppText>
                </Pressable>
              );
            }

            const t = it.term;

            return (
              <View key={t.termId} style={styles.row}>
                <Pressable onPress={() => pick(it)} style={{ flex: 1 }}>
                  <View style={[styles.termTop, isRTL && styles.termTopRTL]}>
                    <AppText
                      style={[
                        { fontWeight: '900', flex: 1 },
                        isRTL ? styles.textRTL : styles.textLTR,
                      ]}
                    >
                      {t.text}
                    </AppText>

                    {t.status === 'APPROVED' ? (
                      <View style={styles.badgeApproved}>
                        <AppText style={{ fontWeight: '900' }}>✓</AppText>
                      </View>
                    ) : (
                      <View style={styles.voteBox}>
                        <Pressable
                          onPress={() => vote(t.termId, 'UP')}
                          style={[styles.voteBtn, t.myVote === 'UP' && styles.voteBtnOn]}
                        >
                          <AppText style={{ fontWeight: '900' }}>✓</AppText>
                        </Pressable>

                        <Pressable
                          onPress={() => vote(t.termId, 'DOWN')}
                          style={[styles.voteBtn, t.myVote === 'DOWN' && styles.voteBtnOff]}
                        >
                          <AppText style={{ fontWeight: '900' }}>✕</AppText>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  <AppText
                    tone="muted"
                    style={[{ marginTop: 4 }, isRTL ? styles.textRTL : styles.textLTR]}
                  >
                    {t.status} · UP {t.upCount} / DOWN {t.downCount}
                  </AppText>
                </Pressable>
              </View>
            );
          })}
      </View>
    );
  }
  const dropdownUI =
    Platform.OS === 'web' ? (
      anchor ? (
        <WebPortal>
          <View
            style={[
              styles.dropdownBox,
              {
                position: 'fixed',
                left: anchor.x,
                top: anchor.y + anchor.h - 1, // -1 כדי "להידבק" לבורדר
                width: anchor.w,
                zIndex: 2147483647,
                pointerEvents: 'auto',
              } as any,
            ]}
            pointerEvents="auto"
          >
            {renderDropdownContent()}
          </View>
        </WebPortal>
      ) : null
    ) : (
      <View style={styles.dropdownNative} pointerEvents="auto">
        {renderDropdownContent()}
      </View>
    );

  const showDropdown = !props.overlayActive && open && q.length >= minChars;
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!showDropdown) return;

    // למדוד אחרי paint
    requestAnimationFrame(() => {
      anchorRef.current?.measureInWindow((x, y, w, h) => {
        setAnchor({ x, y, w, h });
      });
    });
  }, [showDropdown, value]);

  return (
    <View style={styles.root}>
      <AppText style={[styles.label, isRTL ? styles.textRTL : styles.textLTR]}>{label}</AppText>
      <View ref={anchorRef} collapsable={false}>
        <TextInput
          value={value}
          onChangeText={(t) => {
            onChangeText(t);
            setOpen(true);
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 80);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          style={[styles.input, isRTL ? styles.inputRTL : styles.inputLTR]}
        />
      </View>

      {showDropdown ? dropdownUI : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8, position: 'relative', zIndex: 50 },

  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: theme.colors.text,
    backgroundColor: '#0F172A',
  },

  dropdown: {
    position: 'absolute',
    top: 62,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#0B1220',
    maxHeight: 260,
  },

  hint: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },

  loading: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },

  rowPressed: { opacity: 0.7 },

  termTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  badgeApproved: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1D4ED8',
  },
  dropdownContent: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#0B1220',
    maxHeight: 260,
    overflow: 'hidden',
  },
  voteBox: { flexDirection: 'row', gap: 8 },

  voteBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },

  voteBtnOn: {
    backgroundColor: 'rgba(29,78,216,0.6)',
    borderColor: 'rgba(29,78,216,1)',
  },

  voteBtnOff: {
    backgroundColor: 'rgba(220,38,38,0.35)',
    borderColor: 'rgba(220,38,38,0.9)',
  },
  label: { fontWeight: '800' },

  textRTL: { textAlign: 'right', writingDirection: 'rtl' } as any,
  textLTR: { textAlign: 'left', writingDirection: 'ltr' } as any,

  inputRTL: { textAlign: 'right', writingDirection: 'rtl' } as any,
  inputLTR: { textAlign: 'left', writingDirection: 'ltr' } as any,

  termTopRTL: { flexDirection: 'row-reverse' } as any,
  dropdownBox: {
    zIndex: 1000,
    elevation: 10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#0B1220',
    maxHeight: 260,
    overflow: 'hidden',
  },

  dropdownNative: {
    position: 'absolute',
    top: 62,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#0B1220',
    maxHeight: 260,
    overflow: 'hidden',
  },
  dropdownRTL: { right: 0, left: 'auto' } as any,
});
