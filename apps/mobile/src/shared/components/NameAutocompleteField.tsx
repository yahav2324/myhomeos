import * as React from 'react';
import { View, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { AppText } from '../ui/AppText';
import { theme } from '../theme/theme';

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

export type PickPayload =
  | { kind: 'term'; termId: string; text: string }
  | { kind: 'create'; text: string };

export function NameAutocompleteField(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  minChars?: number;
  lang: string;

  fetchSuggest: (q: string, lang: string) => Promise<SuggestTerm[]>;
  onCreateNew: (text: string, lang: string) => Promise<void>;
  onVote: (termId: string, vote: 'UP' | 'DOWN') => Promise<void>;

  // ✅ חדש: למי שמריץ UX של "בחר -> הוסף לרשימה -> פתח מודאל"
  onPick?: (p: PickPayload) => void;
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

  const q = value.trim();
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
          setItems([
            { kind: 'create', text: q },
            ...arr.map((t) => ({ kind: 'term', term: t }) as const),
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
  }, [q, lang, minChars, fetchSuggest]);

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

  const showDropdown = open && q.length >= minChars;

  return (
    <View style={styles.root}>
      <AppText style={{ fontWeight: '800' }}>{label}</AppText>

      <TextInput
        value={value}
        onChangeText={(t) => {
          onChangeText(t);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.muted}
        style={styles.input}
      />

      {showDropdown && (
        <View style={styles.dropdown} pointerEvents="box-none">
          <AppText tone="muted" style={styles.hint}>
            מינימום {minChars} אותיות להשלמה
          </AppText>

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
                    <AppText style={{ fontWeight: '800' }}>➕ הוסף ערך חדש: "{it.text}"</AppText>
                    <AppText tone="muted" style={{ marginTop: 4 }}>
                      ישמר במאגר לשימוש עתידי
                    </AppText>
                  </Pressable>
                );
              }

              const t = it.term;

              return (
                <View key={t.termId} style={styles.row}>
                  <Pressable onPress={() => pick(it)} style={{ flex: 1 }}>
                    <View style={styles.termTop}>
                      <AppText style={{ fontWeight: '900', flex: 1 }}>{t.text}</AppText>

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

                    <AppText tone="muted" style={{ marginTop: 4 }}>
                      {t.status} · UP {t.upCount} / DOWN {t.downCount}
                    </AppText>
                  </Pressable>
                </View>
              );
            })}
        </View>
      )}
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
});
