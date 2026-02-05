// apps/mobile/src/features/shopping/screens/ShoppingListScreen.tsx
import * as React from 'react';
import {
  View,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Animated,
  PanResponder,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import { theme } from '../../../shared/theme/theme';
import type { ShoppingStackParamList } from '../navigation/shopping.stack';
import { useShallow } from 'zustand/react/shallow';

import { NameAutocompleteField } from '../../../shared/components';
import type { PickPayload, SuggestTerm } from '../../../shared/components/NameAutocompleteField';
import { authedFetch } from '../../auth/api/auth.api';
import { ShoppingCategory } from '@smart-kitchen/contracts';
import { SHOPPING_CATEGORY_LABELS_HE } from '../categories';
import { CategoryDropdown } from '../../../shared/components/categoryDropdown';
import { Lang, t } from '../../../shared/i18n/i18n';
import { useLangStore } from '../../../shared/i18n/lang.store';
import {
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Filter,
  Trash,
  CheckCircle,
  Undo2,
  CheckCircle2,
} from 'lucide-react-native';

import { useShoppingStore } from '../store/shopping.store';
import { OnlineBadge } from '../../../shared/ui/OnlineBadge';

/* =======================
   Types
======================= */

type Props = NativeStackScreenProps<ShoppingStackParamList, 'ShoppingList'>;

type Unit = 'pcs' | 'g' | 'ml' | 'kg' | 'l';

type ExtraKey = 'brand' | 'note' | 'priority' | 'price';

type Item = {
  id: string; // localId
  serverId?: string | null;
  termId?: string | null;
  name: string;
  quantity: number;
  unit: Unit;
  category?: ShoppingCategory | null;
  checked?: boolean;
  extras?: Record<string, string>;
};

type Row = { kind: 'header'; id: string; title: string } | { kind: 'item'; id: string; item: Item };

const DEFAULT_QTY = 1;
const DEFAULT_UNIT: Unit = 'pcs';
const UNIT_OPTIONS: Unit[] = ['pcs', 'g', 'ml', 'kg', 'l'];
const UNIT_I18N_KEY: Record<Unit, string> = {
  pcs: 'unit_pcs',
  g: 'unit_g',
  ml: 'unit_ml',
  kg: 'unit_kg',
  l: 'unit_l',
};

/* =======================
   Helpers (pure)
======================= */

function clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

function normText(s: string) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function parsePrice(extra: Record<string, string> | undefined): number | null {
  const raw = extra?.price;
  if (!raw) return null;
  const n = Number(
    String(raw)
      .replace(/[^\d.,]/g, '')
      .replace(',', '.'),
  );
  return Number.isFinite(n) ? n : null;
}

function toNumberOrNull(s: string): number | null {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function sortUncheckedFirst(a: Item, b: Item) {
  return Number(Boolean(a.checked)) - Number(Boolean(b.checked));
}

function heExtraLabel(k: ExtraKey) {
  if (k === 'brand') return 'מותג';
  if (k === 'note') return 'הערה';
  if (k === 'priority') return 'עדיפות';
  if (k === 'price') return 'מחיר';
  return k;
}

function safeQty(qtyText: string) {
  const n = Number(String(qtyText).replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_QTY;
  return Math.round(n * 100) / 100;
}

/* =======================
   Small UI bits
======================= */

function UnitChips(props: { value: Unit; onChange: (u: Unit) => void }) {
  const { value, onChange } = props;
  return (
    <View style={styles.unitRow}>
      {UNIT_OPTIONS.map((u) => {
        const active = value === u;

        return (
          <Pressable
            key={u}
            onPress={() => onChange(u)}
            style={({ pressed }) => [
              styles.unitChip,
              active && styles.unitChipActive,
              pressed && { opacity: 0.85 },
            ]}
          >
            <AppText style={[styles.unitChipText, active && { opacity: 1 }]}>
              {t(UNIT_I18N_KEY[u])}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function ExtraChip(props: { label: string; disabled?: boolean; onPress: () => void }) {
  const { label, disabled, onPress } = props;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.extraChip,
        disabled && styles.extraChipDisabled,
        pressed && !disabled && styles.extraChipPressed,
      ]}
    >
      <AppText style={styles.extraChipText}>{label}</AppText>
    </Pressable>
  );
}

function SmallPill(props: { label: string; active?: boolean; onPress: () => void }) {
  const { label, active, onPress } = props;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        active && styles.pillActive,
        pressed && { opacity: 0.85 },
      ]}
    >
      <AppText style={[styles.pillText, active && { opacity: 1 }]}>{label}</AppText>
    </Pressable>
  );
}

/* =======================
   Bottom Sheet helper
======================= */

function useBottomSheet(open: boolean) {
  const { height: H } = Dimensions.get('window');
  const sheetH = Math.min(680, Math.floor(H * 0.84));
  const translateY = React.useRef(new Animated.Value(sheetH)).current;

  React.useEffect(() => {
    Animated.timing(translateY, {
      toValue: open ? 0 : sheetH,
      duration: open ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [open, sheetH, translateY]);

  return { sheetH, translateY };
}

/* =======================
   Row component
======================= */

const ItemRow = React.memo(function ItemRow(props: {
  item: Item;
  onOpen: (it: Item) => void;
  onToggleChecked: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { item, onOpen, onToggleChecked, onDelete } = props;
  const isChecked = Boolean(item.checked);
  const price = parsePrice(item.extras);
  const lang = useLangStore((s) => s.lang);
  const isRTL = lang === 'he';
  const unitKey = UNIT_I18N_KEY[(item.unit ?? 'pcs') as Unit] ?? UNIT_I18N_KEY.pcs;

  return (
    <Pressable onPress={() => onOpen(item)} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      <Card style={{ alignItems: 'stretch', justifyContent: 'flex-start' }}>
        <View style={styles.itemRow}>
          <View style={styles.textCol}>
            <AppText
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[
                styles.itemNameInline,
                isRTL ? styles.textRTL : styles.textLTR,
                isChecked && styles.itemNameChecked,
              ]}
            >
              {item.name}
            </AppText>

            <AppText
              numberOfLines={1}
              ellipsizeMode="tail"
              tone="muted"
              style={[styles.itemMetaInline, isRTL ? styles.textRTL : styles.textLTR]}
            >
              {/* {item.category
                ? `קטגוריה: ${SHOPPING_CATEGORY_LABELS_HE[item.category] ?? item.category}`
                : ''} */}
              {/* {item.extras ? ` • פרטים: ${Object.keys(item.extras).length}` : ''} */}
              {price != null ? ` •מחיר: ${price} ${isRTL ? '₪' : '$'}` : ''}
            </AppText>
          </View>

          <View style={[styles.controlsRow, isRTL && styles.controlsRowRTL]}>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onDelete(item.id);
              }}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            >
              <AppText style={styles.iconBtnText}>
                {<Trash size={18} color={theme.colors.text} />}
              </AppText>
            </Pressable>

            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                onToggleChecked(item.id, !isChecked);
              }}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
            >
              <AppText style={styles.iconBtnText}>
                {isChecked ? (
                  <Undo2 size={18} color={theme.colors.text} />
                ) : (
                  <CheckCircle size={18} color={theme.colors.text} />
                )}
              </AppText>
            </Pressable>

            <View style={styles.qtyBadge}>
              <AppText style={[styles.qtyBadgeText, isRTL ? styles.textRTL : styles.textLTR]}>
                {item.quantity} {t(unitKey)}
              </AppText>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
});

/* =======================
   Screen
======================= */

export function ShoppingListScreen({ route }: Props) {
  const { listLocalId, listName } = route.params;

  const lang = useLangStore((s) => s.lang as Lang);
  const isRTL = lang === 'he';

  const {
    lists,
    itemsByListLocalId,
    loading,
    saving,
    lastError,
    refreshLists,
    refreshItems,
    addItem,
    updateItem,
    deleteItem,
    trySync,
  } = useShoppingStore(
    useShallow((s) => ({
      lists: s.lists,
      itemsByListLocalId: s.itemsByListLocalId,
      loading: s.loading,
      saving: s.saving,
      lastError: s.lastError,
      refreshLists: s.refreshLists,
      refreshItems: s.refreshItems,
      addItem: s.addItem,
      updateItem: s.updateItem,
      deleteItem: s.deleteItem,
      trySync: s.trySync,
    })),
  );

  const list = React.useMemo(
    () => lists.find((x) => x.localId === listLocalId) ?? null,
    [lists, listLocalId],
  );

  const localItems = itemsByListLocalId[listLocalId] ?? [];
  const items: Item[] = React.useMemo(
    () =>
      localItems.map((x) => {
        const rawUnit = String(x.unit ?? '').toLowerCase();
        const unit: Unit = (UNIT_OPTIONS as string[]).includes(rawUnit) ? (rawUnit as Unit) : 'pcs';

        return {
          id: x.localId,
          serverId: x.serverId,
          termId: x.termId ?? null,
          name: x.text,
          quantity: x.qty,
          unit,
          category: (x.category as any) ?? null,
          checked: x.checked,
          extras: (x.extra as any) ?? undefined,
        };
      }),
    [localItems],
  );

  // quick add visibility
  const [showQuickAdd, setShowQuickAdd] = React.useState(true);

  // filters
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [selectedCategories, setSelectedCategories] = React.useState<ShoppingCategory[]>([]);
  const [groupByCategory, setGroupByCategory] = React.useState(false);

  // extra filters
  const [hideChecked, setHideChecked] = React.useState(false);
  const [onlyWithPrice, setOnlyWithPrice] = React.useState(false);
  const [priceMinText, setPriceMinText] = React.useState('');
  const [priceMaxText, setPriceMaxText] = React.useState('');

  const priceMin = React.useMemo(() => toNumberOrNull(priceMinText), [priceMinText]);
  const priceMax = React.useMemo(() => toNumberOrNull(priceMaxText), [priceMaxText]);

  // quick add fields
  const [name, setName] = React.useState('');
  const [qty, setQty] = React.useState(String(DEFAULT_QTY));
  const [unit, setUnit] = React.useState<Unit>(DEFAULT_UNIT);
  const [category, setCategory] = React.useState<ShoppingCategory | null>(null);
  const [selectedTermId, setSelectedTermId] = React.useState<string | null>(null);

  // extras (quick add)
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [extras, setExtras] = React.useState<Record<string, string>>({});
  const [extraKeys, setExtraKeys] = React.useState<ExtraKey[]>([]);

  // item modal
  const [itemOpen, setItemOpen] = React.useState(false);
  const [activeItem, setActiveItem] = React.useState<Item | null>(null);

  // edit fields (modal)
  const [editName, setEditName] = React.useState('');
  const [editQty, setEditQty] = React.useState(String(DEFAULT_QTY));
  const [editUnit, setEditUnit] = React.useState<Unit>(DEFAULT_UNIT);
  const [editCategory, setEditCategory] = React.useState<ShoppingCategory | null>(null);
  const [editExtras, setEditExtras] = React.useState<Record<string, string>>({});
  const [editExtraKeys, setEditExtraKeys] = React.useState<ExtraKey[]>([]);

  /* =======================
     Quick Add expand/collapse (drag)
  ======================= */

  const [quickAddExpanded, setQuickAddExpanded] = React.useState(false);

  const extraH = React.useRef(new Animated.Value(0)).current;
  const extraMaxHRef = React.useRef(0);
  const panRef = React.useRef({ startH: 0 }).current;

  const setExpandedFromHeight = React.useCallback((h: number) => {
    const max = extraMaxHRef.current || 1;
    setQuickAddExpanded(h > max * 0.18);
  }, []);

  const snapExtraTo = React.useCallback(
    (open: boolean) => {
      const max = extraMaxHRef.current || 0;
      setQuickAddExpanded(open);
      Animated.spring(extraH, {
        toValue: open ? max : 0,
        useNativeDriver: false,
        bounciness: 0,
        speed: 18,
      }).start();
    },
    [extraH],
  );

  const grabberPan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
        onMoveShouldSetPanResponderCapture: (_e, g) => Math.abs(g.dy) > 2,

        onPanResponderGrant: () => {
          extraH.stopAnimation((val: number) => {
            panRef.startH = val;
          });
        },

        onPanResponderMove: (_e, g) => {
          const next = clamp(panRef.startH + g.dy, 0, extraMaxHRef.current);
          extraH.setValue(next);
          setExpandedFromHeight(next);
        },

        onPanResponderRelease: (_e, g) => {
          extraH.stopAnimation((val: number) => {
            const max = extraMaxHRef.current || 1;
            const shouldOpen = g.vy < -0.7 || val > max * 0.5;
            snapExtraTo(shouldOpen);
          });
        },

        onPanResponderTerminate: () => {
          extraH.stopAnimation((val: number) => {
            const max = extraMaxHRef.current || 1;
            snapExtraTo(val > max * 0.5);
          });
        },
      }),
    [extraH, panRef, setExpandedFromHeight, snapExtraTo],
  );

  // web pointer support (drag handle only)
  const webDrag = React.useRef({ dragging: false, startY: 0, startH: 0 }).current;

  const webHandlers = React.useMemo(() => {
    if (Platform.OS !== 'web') return {};

    const onDown = (clientY: number) => {
      webDrag.dragging = true;
      webDrag.startY = clientY;
      extraH.stopAnimation((val: number) => {
        webDrag.startH = val;
      });
    };

    return {
      onPointerDown: (e: any) => {
        e.preventDefault?.();
        onDown(e.clientY);
      },
      onMouseDown: (e: any) => {
        e.preventDefault?.();
        onDown(e.clientY);
      },
      onTouchStart: (e: any) => {
        const t = e?.touches?.[0];
        if (!t) return;
        e.preventDefault?.();
        onDown(t.clientY);
      },
    };
  }, [extraH, webDrag]);

  React.useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onMove = (clientY: number, ev: any) => {
      if (!webDrag.dragging) return;
      ev.preventDefault?.();
      const dy = clientY - webDrag.startY;
      const next = clamp(webDrag.startH + dy, 0, extraMaxHRef.current);
      extraH.setValue(next);
      setExpandedFromHeight(next);
    };

    const onUp = (_clientY: number, ev: any) => {
      if (!webDrag.dragging) return;
      ev.preventDefault?.();
      webDrag.dragging = false;

      extraH.stopAnimation((val: number) => {
        const max = extraMaxHRef.current || 1;
        const shouldOpen = val > max * 0.5;
        snapExtraTo(shouldOpen);
      });
    };

    const pm = (e: PointerEvent) => onMove(e.clientY, e);
    const pu = (e: PointerEvent) => onUp(e.clientY, e);
    const tm = (e: TouchEvent) => {
      const t = e.touches?.[0];
      if (t) onMove(t.clientY, e);
    };
    const te = (e: TouchEvent) => onUp(e.changedTouches?.[0]?.clientY ?? webDrag.startY, e);

    window.addEventListener('pointermove', pm, { passive: false });
    window.addEventListener('pointerup', pu, { passive: false });
    window.addEventListener('touchmove', tm, { passive: false });
    window.addEventListener('touchend', te, { passive: false });

    return () => {
      window.removeEventListener('pointermove', pm as any);
      window.removeEventListener('pointerup', pu as any);
      window.removeEventListener('touchmove', tm as any);
      window.removeEventListener('touchend', te as any);
    };
  }, [extraH, setExpandedFromHeight, snapExtraTo, webDrag]);

  /* =======================
     Extras helpers
  ======================= */

  const resetExtras = React.useCallback(() => {
    setExtras({});
    setExtraKeys([]);
  }, []);

  const addExtraKey = React.useCallback((key: ExtraKey) => {
    setExtraKeys((s) => (s.includes(key) ? s : [...s, key]));
    setExtras((e) => ({ ...e, [key]: e[key] ?? '' }));
  }, []);

  const removeExtraKey = React.useCallback((key: ExtraKey) => {
    setExtraKeys((s) => s.filter((x) => x !== key));
    setExtras((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
  }, []);

  /* =======================
     Load (SQLite)
  ======================= */

  const load = React.useCallback(async () => {
    await refreshLists();
    await refreshItems(listLocalId);
    void trySync();
  }, [refreshLists, refreshItems, listLocalId, trySync]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load]),
  );

  /* =======================
     Derived
  ======================= */

  const allCategories = React.useMemo(() => {
    const s = new Set<ShoppingCategory>();
    for (const it of items) if (it.category) s.add(it.category);
    return Array.from(s).sort((a, b) => String(a).localeCompare(String(b)));
  }, [items]);

  const priceStats = React.useMemo(() => {
    const nums = items.map((it) => parsePrice(it.extras)).filter((x): x is number => x != null);
    if (!nums.length) return { min: 0, max: 0, has: false };
    return { min: Math.min(...nums), max: Math.max(...nums), has: true };
  }, [items]);

  const canSaveDetails = React.useMemo(() => {
    if (extraKeys.length === 0) return true;
    return extraKeys.every((k) => (extras[k] ?? '').trim().length > 0);
  }, [extraKeys, extras]);

  const filteredItems = React.useMemo(() => {
    let out = [...items].sort(sortUncheckedFirst);

    if (selectedCategories.length > 0) {
      out = out.filter((x) => x.category && selectedCategories.includes(x.category));
    }

    if (hideChecked) out = out.filter((x) => !x.checked);
    if (onlyWithPrice) out = out.filter((x) => parsePrice(x.extras) != null);

    if (priceMin != null || priceMax != null) {
      out = out.filter((it) => {
        const p = parsePrice(it.extras);
        if (p == null) return false;
        if (priceMin != null && p < priceMin) return false;
        if (priceMax != null && p > priceMax) return false;
        return true;
      });
    }

    return out;
  }, [items, selectedCategories, hideChecked, onlyWithPrice, priceMin, priceMax]);

  const rows: Row[] = React.useMemo(() => {
    if (!groupByCategory) return filteredItems.map((it) => ({ kind: 'item', id: it.id, item: it }));

    const groups = new Map<string, Item[]>();
    const uncategorized: Item[] = [];

    for (const it of filteredItems) {
      if (!it.category) uncategorized.push(it);
      else {
        const key = String(it.category);
        const arr = groups.get(key) ?? [];
        arr.push(it);
        groups.set(key, arr);
      }
    }

    for (const arr of groups.values()) arr.sort(sortUncheckedFirst);
    uncategorized.sort(sortUncheckedFirst);

    const out: Row[] = [];
    const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

    for (const c of keys) {
      const title = SHOPPING_CATEGORY_LABELS_HE[c as ShoppingCategory] ?? c;
      out.push({ kind: 'header', id: `h:${c}`, title });
      for (const it of groups.get(c)!) out.push({ kind: 'item', id: it.id, item: it });
    }

    if (uncategorized.length) {
      out.push({ kind: 'header', id: 'h:__uncat', title: 'ללא קטגוריה' });
      for (const it of uncategorized) out.push({ kind: 'item', id: it.id, item: it });
    }

    return out;
  }, [filteredItems, groupByCategory]);

  const toggleCategory = React.useCallback((c: ShoppingCategory) => {
    setSelectedCategories((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));
  }, []);

  const counts = React.useMemo(() => {
    const total = items.length;
    const checked = items.filter((x) => x.checked).length;
    const visible = filteredItems.length;
    return { total, checked, visible };
  }, [items, filteredItems]);

  /* =======================
     Duplicate guard
  ======================= */

  const wouldDuplicate = React.useCallback(
    (nextText: string, nextTermId?: string | null) => {
      if (nextTermId) {
        return items.some((it) => it.termId && String(it.termId) === String(nextTermId));
      }
      const nt = normText(nextText);
      return items.some((it) => normText(it.name) === nt);
    },
    [items],
  );

  /* =======================
     Add (SQLite-first)
  ======================= */

  const onAdd = React.useCallback(async () => {
    if (!list) return;

    const text = name.trim();
    if (!text || saving) return;

    if (!canSaveDetails) {
      setDetailsOpen(true);
      return;
    }

    if (wouldDuplicate(text, selectedTermId)) return;
    console.log('[onAdd] unit=', unit, 'qty=', qty, 'name=', name);

    await addItem(list, {
      text,
      termId: selectedTermId ?? null,
      qty: safeQty(qty),
      unit,
      category,
      extra: Object.keys(extras).length ? extras : null,
    });

    setName('');
    setQty(String(DEFAULT_QTY));
    setUnit(DEFAULT_UNIT);
    setCategory(null);
    setSelectedTermId(null);
    resetExtras();
    setDetailsOpen(false);
    snapExtraTo(false);
  }, [
    list,
    name,
    saving,
    canSaveDetails,
    wouldDuplicate,
    selectedTermId,
    qty,
    unit,
    category,
    extras,
    addItem,
    resetExtras,
    snapExtraTo,
  ]);

  /* =======================
     Autocomplete (server optional)
  ======================= */

  const onPick = React.useCallback((p: PickPayload) => {
    setName(p.text);
    setSelectedTermId(p.kind === 'term' ? p.termId : null);
  }, []);

  const fetchSuggest = React.useCallback(
    async (q: string, lang: string): Promise<SuggestTerm[]> => {
      const query = q.trim();
      if (!query) return [];
      try {
        const res = await authedFetch(
          `/terms/suggest?lang=${encodeURIComponent(lang)}&q=${encodeURIComponent(query)}&limit=10`,
          { method: 'GET' },
        );
        if (!res.ok) return [];
        const json = (await res.json()) as any;
        const arr = Array.isArray(json?.data) ? json.data : [];
        return (arr as any[]).map((x) => ({
          termId: String(x.termId ?? x.id),
          text: String(x.text ?? x.name ?? ''),
          status: (x.status ?? 'PENDING') as SuggestTerm['status'],
          upCount: Number(x.upCount ?? 0),
          downCount: Number(x.downCount ?? 0),
          myVote: (x.myVote ?? null) as SuggestTerm['myVote'],
        })) as SuggestTerm[];
      } catch {
        return [];
      }
    },
    [],
  );

  const onCreateNew = React.useCallback(async (text: string, lang: string) => {
    const v = text.trim();
    if (!v) return;
    try {
      await authedFetch('/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: v, lang }),
      });
    } catch {
      /* empty */
    }
  }, []);

  const onVote = React.useCallback(async (termId: string, vote: 'UP' | 'DOWN') => {
    try {
      await authedFetch(`/terms/${encodeURIComponent(termId)}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote }),
      });
    } catch {
      /* empty */
    }
  }, []);

  /* =======================
     Item ops (SQLite-first)
  ======================= */

  const deleteOne = React.useCallback(
    async (itemLocalId: string) => {
      if (!list) return;
      const it = localItems.find((x) => x.localId === itemLocalId);
      if (!it) return;
      await deleteItem(list, it as any);
    },
    [list, localItems, deleteItem],
  );

  const setChecked = React.useCallback(
    async (itemLocalId: string, checked: boolean) => {
      if (!list) return;
      const it = localItems.find((x) => x.localId === itemLocalId);
      if (!it) return;
      await updateItem(list, it as any, { checked });
    },
    [list, localItems, updateItem],
  );

  const openItem = React.useCallback((it: Item) => {
    setActiveItem(it);
    setItemOpen(true);

    setEditName(it.name ?? '');
    setEditQty(String(it.quantity ?? DEFAULT_QTY));
    setEditUnit(it.unit ?? DEFAULT_UNIT);
    setEditCategory((it.category as any) ?? null);

    const ex = it.extras ?? {};
    setEditExtras(ex);

    const keys = Object.keys(ex) as ExtraKey[];
    setEditExtraKeys(keys.filter((k) => ['brand', 'note', 'priority', 'price'].includes(k)));
  }, []);

  const closeItem = React.useCallback(() => {
    setItemOpen(false);
    setActiveItem(null);
  }, []);
  const listRef = React.useRef<FlatList<any>>(null);
  const [showBackToAdd, setShowBackToAdd] = React.useState(false);

  const canSaveEditDetails = React.useMemo(() => {
    if (editExtraKeys.length === 0) return true;
    return editExtraKeys.every((k) => (editExtras[k] ?? '').trim().length > 0);
  }, [editExtraKeys, editExtras]);

  const saveActiveEdits = React.useCallback(async () => {
    if (!list || !activeItem || saving) return;

    const nextText = editName.trim();
    if (!nextText) return;

    const otherItems = items.filter((x) => x.id !== activeItem.id);
    const dup =
      (activeItem.termId
        ? otherItems.some((it) => it.termId && String(it.termId) === String(activeItem.termId))
        : otherItems.some((it) => normText(it.name) === normText(nextText))) ||
      otherItems.some((it) => normText(it.name) === normText(nextText));

    if (dup) return;

    const it = localItems.find((x) => x.localId === activeItem.id);
    if (!it) return;

    await updateItem(list, it as any, {
      text: nextText,
      qty: safeQty(editQty),
      unit: editUnit,
      category: editCategory ?? null,
      extra: Object.keys(editExtras).length ? editExtras : null,
    });

    closeItem();
  }, [
    list,
    activeItem,
    saving,
    editName,
    editQty,
    editUnit,
    editCategory,
    editExtras,
    items,
    localItems,
    updateItem,
    closeItem,
  ]);

  /* =======================
     Filters actions
  ======================= */
  const [overlayActive, setOverlayActive] = React.useState(false);

  const resetAllFilters = React.useCallback(() => {
    setSelectedCategories([]);
    setGroupByCategory(false);
    setHideChecked(false);
    setOnlyWithPrice(false);
    setPriceMinText('');
    setPriceMaxText('');
  }, []);

  const filtersActive =
    selectedCategories.length > 0 ||
    groupByCategory ||
    hideChecked ||
    onlyWithPrice ||
    priceMin != null ||
    priceMax != null;

  /* =======================
     Filters Bottom Sheet
  ======================= */

  const { sheetH, translateY } = useBottomSheet(filtersOpen);
  const closeFilters = React.useCallback(() => setFiltersOpen(false), []);

  const sheetPan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
        onPanResponderMove: (_e, g) => {
          const y = clamp(g.dy, 0, sheetH);
          translateY.setValue(y);
        },
        onPanResponderRelease: (_e, g) => {
          const shouldClose = g.vy > 0.9 || g.dy > sheetH * 0.25;
          Animated.timing(translateY, {
            toValue: shouldClose ? sheetH : 0,
            duration: 170,
            useNativeDriver: true,
          }).start(() => {
            if (shouldClose) closeFilters();
          });
        },
      }),
    [closeFilters, sheetH, translateY],
  );

  const ExtraContent = React.useCallback(
    ({ measureOnly }: { measureOnly?: boolean }) => (
      <>
        <View style={styles.sectionBlock}>
          <CategoryDropdown
            measureOnly={measureOnly}
            isRTL={isRTL}
            value={category}
            onChange={setCategory}
            onOpenChange={(isOpen) => {
              setOverlayActive(isOpen);
              snapExtraTo(false);
            }}
            label="קטגוריה"
          />
        </View>

        <View style={styles.sectionBlock}>
          <AppText
            tone="muted"
            style={[styles.sectionLabel, isRTL ? styles.textRTL : styles.textLTR]}
          >
            יחידה
          </AppText>
          <UnitChips value={unit} onChange={setUnit} />
        </View>

        <View style={styles.sectionBlock}>
          <AppText
            tone="muted"
            style={[styles.sectionLabel, isRTL ? styles.textRTL : styles.textLTR]}
          >
            כמות
          </AppText>
          <TextInput
            value={qty}
            onChangeText={setQty}
            keyboardType="numeric"
            placeholder="כמות"
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, isRTL ? styles.textInputRTL : styles.textInputLTR]}
          />
        </View>

        <View style={[styles.rowGap, { marginTop: 6, marginBottom: 6 }]}>
          <Pressable
            onPress={() => setDetailsOpen(true)}
            style={({ pressed }) => [styles.moreDetailsBtn, pressed && { opacity: 0.9 }]}
          >
            <AppText style={styles.moreDetailsText}>פרטים נוספים</AppText>
            {extraKeys.length > 0 ? <View style={styles.moreDetailsDot} /> : null}
          </Pressable>
        </View>

        {name.trim() && wouldDuplicate(name.trim(), selectedTermId) ? (
          <View style={styles.dupNotice}>
            <AppText tone="muted" style={{ fontWeight: '800' }}>
              הפריט כבר קיים ברשימה (לא נוסיף כפול)
            </AppText>
          </View>
        ) : null}
      </>
    ),
    [category, unit, qty, isRTL, extraKeys.length, name, wouldDuplicate, selectedTermId],
  );

  const ListHeader = React.useMemo(() => {
    return (
      <View style={[styles.headerWrap]}>
        {lastError ? (
          <View style={{ paddingBottom: 10 }}>
            <AppText tone="muted" style={{ fontWeight: '900' }}>
              {lastError}
            </AppText>
          </View>
        ) : null}

        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <AppText style={[styles.title, isRTL ? styles.textRTL : styles.textLTR]}>
              {list?.name ?? listName ?? 'רשימת קניות'}
            </AppText>
            <AppText
              tone="muted"
              style={[styles.subTitle, isRTL ? styles.textRTL : styles.textLTR]}
            >
              • {t('total', { total: counts.total })} •{' '}
              {t('purchased', { checked: counts.checked })}
            </AppText>
          </View>

          <View style={[styles.headerActions, isRTL && styles.headerActionsRTL]}>
            <OnlineBadge compact />
            <Pressable onPress={() => setFiltersOpen(true)} style={styles.headerBtn}>
              <AppText style={styles.headerBtnText}>
                {<Filter size={18} color={theme.colors.text} />}
              </AppText>
            </Pressable>

            <Pressable onPress={load} style={styles.headerBtnGhost}>
              <AppText style={styles.headerBtnText}>
                {<RefreshCw size={18} color={theme.colors.text} />}
              </AppText>
            </Pressable>
          </View>
        </View>

        <View style={[styles.topControls, isRTL && styles.topControlsRTL]}>
          <Pressable
            onPress={() => setShowQuickAdd((x) => !x)}
            style={({ pressed }) => [styles.toggleQuickAdd, pressed && { opacity: 0.88 }]}
          >
            <AppText style={styles.toggleQuickAddText}>
              {showQuickAdd ? t('listOnly') : t('addToList')}
            </AppText>
          </Pressable>
        </View>

        {showQuickAdd ? (
          <Card style={[styles.cardTop, styles.quickAddCardFix]}>
            <View
              style={[styles.quickAddHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
              <AppText style={[styles.cardTitle, { flex: 1, textAlign: isRTL ? 'right' : 'left' }]}>
                {t('quickAddTitle')}
              </AppText>

              <Pressable
                onPress={() => snapExtraTo(!quickAddExpanded)}
                style={[styles.expandBtn, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
              >
                <AppText style={styles.expandBtnText}>
                  {quickAddExpanded ? t('collapse') : t('expand')}
                </AppText>
                <AppText style={styles.expandChevron}>
                  {quickAddExpanded ? (
                    <ChevronUp size={18} color={theme.colors.text} />
                  ) : (
                    <ChevronDown size={18} color={theme.colors.text} />
                  )}
                </AppText>
              </Pressable>
            </View>

            <View style={[styles.formGap, styles.autocompleteLayer]}>
              <View style={[styles.nameRow, isRTL && styles.nameRowRTL]}>
                <View style={styles.addBtnWrap}>
                  <AppButton
                    title={saving ? (t('adding') ?? 'מוסיף') + '...' : (t('add') ?? 'הוסף')}
                    onPress={onAdd}
                    disabled={
                      !name.trim() || saving || wouldDuplicate(name.trim(), selectedTermId) || !list
                    }
                  />
                </View>
                <View style={{ flex: 2, minWidth: 0 }}>
                  <NameAutocompleteField
                    label={t('itemName')}
                    existingNames={items.map((x) => x.name)}
                    value={name}
                    overlayActive={overlayActive}
                    onChangeText={(txt) => {
                      setName(txt);
                      setSelectedTermId(null);
                    }}
                    placeholder={t('exampleCucumber')}
                    minChars={2}
                    lang={lang}
                    isRTL={isRTL}
                    fetchSuggest={fetchSuggest}
                    onCreateNew={onCreateNew}
                    onVote={onVote}
                    onPick={onPick}
                  />
                </View>
              </View>

              <View
                pointerEvents="none"
                style={styles.extraMeasureBox}
                onLayout={(e) => {
                  const h = Math.ceil(e.nativeEvent.layout.height);
                  if (h > 0 && h !== extraMaxHRef.current) {
                    extraMaxHRef.current = h;
                    extraH.stopAnimation((val: number) => {
                      if (val > 0.01) extraH.setValue(h);
                    });
                  }
                }}
              >
                <ExtraContent measureOnly />
              </View>

              <Animated.View style={[styles.extraArea, { height: extraH }]}>
                <View style={{ paddingTop: 6 }}>
                  <ExtraContent />
                </View>
              </Animated.View>
            </View>

            <View
              style={[styles.grabberBottomWrap, Platform.OS === 'web' && styles.grabberWebNoScroll]}
              {...(Platform.OS === 'web' ? (webHandlers as any) : grabberPan.panHandlers)}
            >
              <View style={styles.grabber} />
              <AppText tone="muted" style={styles.grabberHint}>
                {t('dragTo')} {quickAddExpanded ? t('collapseVerb') : t('expandVerb')}
              </AppText>
            </View>
          </Card>
        ) : null}

        {loading ? (
          <View style={{ marginTop: theme.space.lg, alignItems: 'center' }}>
            <ActivityIndicator />
            <AppText tone="muted" style={{ marginTop: 8 }}>
              טוען…
            </AppText>
          </View>
        ) : null}

        <View style={{ height: 12 }} />
      </View>
    );
  }, [
    lastError,
    isRTL,
    list,
    listName,
    counts.total,
    counts.checked,
    load,
    showQuickAdd,
    quickAddExpanded,
    saving,
    onAdd,
    name,
    wouldDuplicate,
    selectedTermId,
    items,
    overlayActive,
    lang,
    fetchSuggest,
    onCreateNew,
    onVote,
    onPick,
    ExtraContent,
    extraH,
    webHandlers,
    grabberPan.panHandlers,
    loading,
    snapExtraTo,
  ]);

  return (
    <SafeAreaView style={styles.safe}>
      <View
        style={[
          styles.screen,
          Platform.OS === 'web' && ({ direction: isRTL ? 'rtl' : 'ltr' } as any),
        ]}
      >
        <FlatList
          style={styles.list} // להסיר את overflow:auto
          contentContainerStyle={styles.listContent}
          data={rows}
          ref={listRef}
          onScroll={(e) => {
            const y = e.nativeEvent.contentOffset.y;
            setShowBackToAdd(y > 220); // אפשר לשחק עם הערך
          }}
          scrollEventThrottle={16}
          keyExtractor={(x) => x.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={ListHeader}
          ListHeaderComponentStyle={styles.listHeaderOver}
          CellRendererComponent={({ children, style, ...rest }: any) => (
            <View {...rest} style={[style, styles.listCellUnderHeader]}>
              {children}
            </View>
          )}
          removeClippedSubviews={false}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.emptyBox}>
                <AppText style={{ fontWeight: '900' }}>{t('noItems') ?? 'אין פריטים'}</AppText>
                <AppText tone="muted" style={{ marginTop: 6, textAlign: 'center' }}>
                  {t('clearFilterMessage') ?? 'אם הפילטרים מסתירים הכל — נקה פילטרים'}
                </AppText>
                {filtersActive ? (
                  <View style={{ marginTop: 12 }}>
                    <AppButton
                      title={t('cleanFilters') ?? 'נקה פילטרים'}
                      variant="ghost"
                      onPress={resetAllFilters}
                    />
                  </View>
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item: row }) => {
            if (row.kind === 'header') {
              return (
                <View style={styles.groupHeader}>
                  <AppText style={styles.groupHeaderText}>{row.title}</AppText>
                </View>
              );
            }

            return (
              <ItemRow
                item={row.item}
                onOpen={openItem}
                onToggleChecked={setChecked}
                onDelete={deleteOne}
              />
            );
          }}
        />
        {showBackToAdd && showQuickAdd && (
          <Pressable
            onPress={() => {
              listRef.current?.scrollToOffset({ offset: 0, animated: true });
              setShowQuickAdd(true);
              snapExtraTo(false); // או true אם אתה רוצה שייפתח
            }}
            style={({ pressed }) => [styles.backToAddBtn, pressed && { opacity: 0.85 }]}
          >
            <ChevronUp size={18} color="#fff" />
            <AppText style={styles.backToAddText}>{t('addItem')}</AppText>
          </Pressable>
        )}

        {/* Filters Bottom Sheet */}
        <Modal
          visible={filtersOpen}
          transparent
          animationType="none"
          onRequestClose={closeFilters}
          presentationStyle="overFullScreen"
        >
          <View style={styles.sheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeFilters} />

            <Animated.View
              style={[styles.sheet, { height: sheetH, transform: [{ translateY }] }]}
              {...sheetPan.panHandlers}
            >
              <View style={styles.sheetHandleWrap}>
                <View style={styles.sheetHandle} />
              </View>

              <View style={styles.sheetHeader}>
                <AppText style={styles.sheetTitle}>
                  {<Filter size={18} color={theme.colors.text} />}
                </AppText>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={resetAllFilters}
                    style={({ pressed }) => [styles.sheetHeaderBtn, pressed && { opacity: 0.85 }]}
                  >
                    <AppText style={{ fontWeight: '900' }}>{t('reset')}</AppText>
                  </Pressable>

                  <Pressable
                    onPress={closeFilters}
                    style={({ pressed }) => [styles.sheetHeaderBtn, pressed && { opacity: 0.85 }]}
                  >
                    <AppText style={{ fontWeight: '900' }}>{t('close')}</AppText>
                  </Pressable>
                </View>
              </View>

              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
              >
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.sheetSection}>
                    <AppText tone="muted" style={styles.sectionTitle}>
                      {t('general')}
                    </AppText>

                    <View style={styles.rowGap}>
                      <AppButton
                        title={
                          groupByCategory
                            ? (t('groupByCategory') ?? 'קבץ לפי קטגוריה') + '✓'
                            : (t('groupByCategory') ?? 'קבץ לפי קטגוריה')
                        }
                        variant="ghost"
                        onPress={() => setGroupByCategory((x) => !x)}
                      />
                      <AppButton
                        title={
                          hideChecked
                            ? (t('hidePurchased') ?? 'הסתר נרכש') + '✓'
                            : (t('hidePurchased') ?? 'הסתר נרכש')
                        }
                        variant="ghost"
                        onPress={() => setHideChecked((x) => !x)}
                      />
                    </View>

                    <View style={[styles.rowGap, { marginTop: 10 }]}>
                      <AppButton
                        title={
                          onlyWithPrice
                            ? (t('onlyWithAPrice') ?? 'רק עם מחיר') + '✓'
                            : (t('onlyWithAPrice') ?? 'רק עם מחיר')
                        }
                        variant="ghost"
                        onPress={() => setOnlyWithPrice((x) => !x)}
                      />
                    </View>
                  </View>

                  <View style={styles.sheetSection}>
                    <AppText tone="muted" style={styles.sectionTitle}>
                      {t('price')}
                      {priceStats.has
                        ? ` (${t('exist')}: ${priceStats.min}–${priceStats.max})`
                        : ` ${t('noProductsWithPricesMessage')}`}
                    </AppText>
                    <View style={[styles.rowGap, { marginTop: 8 }]}>
                      <TextInput
                        value={priceMinText}
                        onChangeText={setPriceMinText}
                        keyboardType="numeric"
                        placeholder={t('minimum')}
                        placeholderTextColor={theme.colors.muted}
                        style={[
                          styles.input,
                          isRTL ? styles.textInputRTL : styles.textInputLTR,
                          { flex: 1 },
                        ]}
                      />
                      <TextInput
                        value={priceMaxText}
                        onChangeText={setPriceMaxText}
                        keyboardType="numeric"
                        placeholder={t('maximum')}
                        placeholderTextColor={theme.colors.muted}
                        style={[
                          styles.input,
                          isRTL ? styles.textInputRTL : styles.textInputLTR,
                          { flex: 1 },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.sheetSection}>
                    <AppText tone="muted" style={styles.sectionTitle}>
                      {t('categories')}
                    </AppText>

                    <View style={styles.categoryWrap}>
                      {allCategories.length === 0 ? (
                        <AppText tone="muted">{t('noCategoriesMessage')}</AppText>
                      ) : (
                        allCategories.map((c) => {
                          const on = selectedCategories.includes(c);
                          const label = SHOPPING_CATEGORY_LABELS_HE[c] ?? c;
                          return (
                            <SmallPill
                              key={c}
                              label={on ? `${label} ✓` : label}
                              active={on}
                              onPress={() => toggleCategory(c)}
                            />
                          );
                        })
                      )}
                    </View>
                  </View>

                  <View style={[styles.rowGap, { marginTop: 14 }]}>
                    <AppButton
                      title={t('cleanFilters')}
                      variant="ghost"
                      onPress={resetAllFilters}
                    />
                    <AppButton title={t('applied')} onPress={() => setFiltersOpen(false)} />
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </Animated.View>
          </View>
        </Modal>

        {/* Details modal (extras for quick-add) */}
        <Modal
          visible={detailsOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setDetailsOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={styles.modalCard}>
              <AppText style={[styles.modalTitle, isRTL ? styles.textRTL : styles.textLTR]}>
                {t('moreDetails')}
              </AppText>

              <AppText tone="muted" style={[styles.mt10, isRTL ? styles.textRTL : styles.textLTR]}>
                הוסף שדות (לחיצה אחת):
              </AppText>

              <View style={[styles.extraChipsRow, isRTL ? styles.textRTL : styles.textLTR]}>
                <ExtraChip
                  label="מותג"
                  disabled={extraKeys.includes('brand')}
                  onPress={() => addExtraKey('brand')}
                />
                <ExtraChip
                  label="הערה"
                  disabled={extraKeys.includes('note')}
                  onPress={() => addExtraKey('note')}
                />
                <ExtraChip
                  label="עדיפות"
                  disabled={extraKeys.includes('priority')}
                  onPress={() => addExtraKey('priority')}
                />
                <ExtraChip
                  label="מחיר"
                  disabled={extraKeys.includes('price')}
                  onPress={() => addExtraKey('price')}
                />
              </View>

              <View style={styles.extraFieldsWrap}>
                {extraKeys.length === 0 ? (
                  <AppText style={[isRTL ? styles.textRTL : styles.textLTR]} tone="muted">
                    לא נבחרו שדות עדיין
                  </AppText>
                ) : (
                  extraKeys.map((k) => (
                    <View key={k} style={styles.extraFieldRow}>
                      <View style={styles.extraLabelCol}>
                        <AppText
                          style={[styles.extraKeyText, isRTL ? styles.textRTL : styles.textLTR]}
                        >
                          {heExtraLabel(k)}
                        </AppText>
                      </View>

                      <TextInput
                        value={extras[k] ?? ''}
                        onChangeText={(txt) => setExtras((e) => ({ ...e, [k]: txt }))}
                        placeholder={`הכנס ${heExtraLabel(k)}`}
                        placeholderTextColor={theme.colors.muted}
                        style={[
                          styles.input,
                          isRTL ? styles.textInputRTL : styles.textInputLTR,
                          styles.extraInput,
                        ]}
                      />

                      <Pressable
                        onPress={() => removeExtraKey(k)}
                        style={({ pressed }) => [
                          styles.removeBtn,
                          pressed && styles.removeBtnPressed,
                        ]}
                      >
                        <AppText style={styles.removeBtnText}>✕</AppText>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>

              <View style={[styles.rowGap, styles.mtLg]}>
                <AppButton title="סגור" variant="ghost" onPress={() => setDetailsOpen(false)} />
                <AppButton
                  title="שמור"
                  onPress={() => {
                    if (!canSaveDetails) return;
                    setDetailsOpen(false);
                  }}
                  disabled={saving || !canSaveDetails}
                />
              </View>
            </Card>
          </View>
        </Modal>

        {/* Item modal */}
        <Modal visible={itemOpen} transparent animationType="fade" onRequestClose={closeItem}>
          <View style={styles.modalBackdrop}>
            <Card style={styles.modalCard}>
              <View style={styles.modalTopRow}>
                <AppText style={styles.modalTitle}>עריכת פריט</AppText>
                <Pressable onPress={closeItem} style={{ padding: 8 }}>
                  <AppText style={{ fontWeight: '900' }}>✕</AppText>
                </Pressable>
              </View>

              {activeItem ? (
                <ScrollView
                  style={{ marginTop: 10, maxHeight: 540 }}
                  contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <AppText tone="muted">שם</AppText>
                  <TextInput
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="שם פריט"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, isRTL ? styles.textInputRTL : styles.textInputLTR]}
                  />

                  <CategoryDropdown
                    value={editCategory}
                    onChange={setEditCategory}
                    label="קטגוריה"
                  />

                  <AppText tone="muted">יחידה</AppText>
                  <UnitChips value={editUnit} onChange={setEditUnit} />

                  <AppText tone="muted">כמות</AppText>
                  <TextInput
                    value={editQty}
                    onChangeText={setEditQty}
                    keyboardType="numeric"
                    placeholder="כמות"
                    placeholderTextColor={theme.colors.muted}
                    style={[styles.input, isRTL ? styles.textInputRTL : styles.textInputLTR]}
                  />

                  <AppText tone="muted" style={{ marginTop: 6 }}>
                    פרטים נוספים
                  </AppText>

                  <View style={styles.extraChipsRow}>
                    <ExtraChip
                      label="מותג"
                      disabled={editExtraKeys.includes('brand')}
                      onPress={() => {
                        setEditExtraKeys((s) => (s.includes('brand') ? s : [...s, 'brand']));
                        setEditExtras((e) => ({ ...e, brand: e.brand ?? '' }));
                      }}
                    />
                    <ExtraChip
                      label="הערה"
                      disabled={editExtraKeys.includes('note')}
                      onPress={() => {
                        setEditExtraKeys((s) => (s.includes('note') ? s : [...s, 'note']));
                        setEditExtras((e) => ({ ...e, note: e.note ?? '' }));
                      }}
                    />
                    <ExtraChip
                      label="עדיפות"
                      disabled={editExtraKeys.includes('priority')}
                      onPress={() => {
                        setEditExtraKeys((s) => (s.includes('priority') ? s : [...s, 'priority']));
                        setEditExtras((e) => ({ ...e, priority: e.priority ?? '' }));
                      }}
                    />
                    <ExtraChip
                      label="מחיר"
                      disabled={editExtraKeys.includes('price')}
                      onPress={() => {
                        setEditExtraKeys((s) => (s.includes('price') ? s : [...s, 'price']));
                        setEditExtras((e) => ({ ...e, price: e.price ?? '' }));
                      }}
                    />
                  </View>

                  <View style={styles.extraFieldsWrap}>
                    {editExtraKeys.length === 0 ? (
                      <AppText tone="muted">אין פרטים נוספים</AppText>
                    ) : (
                      editExtraKeys.map((k) => (
                        <View key={k} style={styles.extraFieldRow}>
                          <View style={styles.extraLabelCol}>
                            <AppText style={styles.extraKeyText}>{heExtraLabel(k)}</AppText>
                          </View>

                          <TextInput
                            value={editExtras[k] ?? ''}
                            onChangeText={(txt) => setEditExtras((e) => ({ ...e, [k]: txt }))}
                            placeholder={`הכנס ${heExtraLabel(k)}`}
                            placeholderTextColor={theme.colors.muted}
                            style={[
                              styles.input,
                              isRTL ? styles.textInputRTL : styles.textInputLTR,
                              styles.extraInput,
                            ]}
                          />

                          <Pressable
                            onPress={() => {
                              setEditExtraKeys((s) => s.filter((x) => x !== k));
                              setEditExtras((e) => {
                                const n = { ...e };
                                delete n[k];
                                return n;
                              });
                            }}
                            style={({ pressed }) => [
                              styles.removeBtn,
                              pressed && styles.removeBtnPressed,
                            ]}
                          >
                            <AppText style={styles.removeBtnText}>✕</AppText>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>

                  {editExtraKeys.length > 0 && !canSaveEditDetails ? (
                    <View style={styles.validationNotice}>
                      <AppText tone="muted" style={{ fontWeight: '900' }}>
                        אי אפשר לשמור: יש שדה שנבחר אבל נשאר ריק
                      </AppText>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.rowGap,
                      { marginTop: 10, alignItems: 'center', justifyContent: 'space-between' },
                    ]}
                  >
                    <View style={[styles.rowGap]}>
                      <AppButton
                        title={saving ? 'שומר…' : 'שמור'}
                        onPress={saveActiveEdits}
                        disabled={!editName.trim() || saving || !canSaveEditDetails}
                      ></AppButton>
                      <AppText
                        onPress={() => {
                          const next = !activeItem.checked;
                          void setChecked(activeItem.id, next);
                          setActiveItem((prev) => (prev ? { ...prev, checked: next } : prev));
                        }}
                      >
                        {activeItem.checked ? (
                          <CheckCircle2 size={40} color={theme.colors.text} />
                        ) : (
                          <Undo2 size={25} color={theme.colors.text} />
                        )}
                      </AppText>
                    </View>

                    <View style={[styles.rowGap, styles.mtLg]}>
                      <AppText
                        onPress={() => {
                          void deleteOne(activeItem.id);
                          closeItem();
                        }}
                      >
                        {<Trash size={25} color={theme.colors.text} />}
                      </AppText>
                    </View>
                  </View>
                </ScrollView>
              ) : null}
            </Card>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

/* =======================
   Styles (כמו אצלך)
======================= */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg } as ViewStyle,

  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
  } as ViewStyle,

  headerWrap: {} as ViewStyle,

  title: { fontSize: 22, fontWeight: '900', letterSpacing: 0.2 } as TextStyle,
  subTitle: { marginTop: 4, opacity: 0.85, fontWeight: '800' } as TextStyle,

  headerBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  } as ViewStyle,

  headerBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,

  headerBtnText: { fontWeight: '900' } as TextStyle,

  topControls: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  } as ViewStyle,
  topControlsRTL: { justifyContent: 'flex-end' } as ViewStyle,

  toggleQuickAdd: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,
  toggleQuickAddText: { fontWeight: '900', opacity: 0.95 } as TextStyle,

  cardTop: { marginTop: 10 } as ViewStyle,
  cardTitle: { fontWeight: '900', fontSize: 16 } as TextStyle,

  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,
  expandBtnText: { fontWeight: '900' } as TextStyle,
  expandChevron: { fontWeight: '900', opacity: 0.85 } as TextStyle,

  formGap: { marginTop: theme.space.md, gap: 10 } as ViewStyle,
  rowGap: { flexDirection: 'row', gap: 10 } as ViewStyle,

  sectionBlock: { marginTop: 6 } as ViewStyle,
  sectionLabel: { marginBottom: 6, fontWeight: '800' } as TextStyle,

  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: '#0F172A',
  } as any,

  extraArea: { overflow: 'hidden', marginTop: 8 } as ViewStyle,

  dupNotice: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
    backgroundColor: 'rgba(245,158,11,0.08)',
  } as ViewStyle,

  list: { flex: 1 } as ViewStyle,
  listContent: { gap: theme.space.md, paddingBottom: 40 } as any,

  groupHeader: { paddingTop: 10, paddingBottom: 6, paddingHorizontal: 2 } as ViewStyle,
  groupHeaderText: { fontWeight: '900', opacity: 0.92, fontSize: 14 } as TextStyle,

  itemNameChecked: { opacity: 0.55, textDecorationLine: 'line-through' } as any,

  qtyBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,
  qtyBadgeText: { fontWeight: '900', opacity: 0.95 } as TextStyle,

  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,
  iconBtnPressed: { backgroundColor: 'rgba(255,255,255,0.06)' } as ViewStyle,
  iconBtnText: { fontWeight: '900' } as TextStyle,

  emptyBox: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
  } as ViewStyle,

  unitRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 } as ViewStyle,
  unitChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  } as ViewStyle,
  unitChipActive: {
    backgroundColor: 'rgba(29,78,216,0.6)',
    borderColor: 'rgba(29,78,216,1)',
  } as ViewStyle,
  unitChipText: { fontWeight: '900', opacity: 0.95 } as TextStyle,

  pill: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,
  pillActive: {
    backgroundColor: 'rgba(29,78,216,0.55)',
    borderColor: 'rgba(29,78,216,1)',
  } as ViewStyle,
  pillText: { fontWeight: '900', opacity: 0.95 } as TextStyle,

  mt10: { marginTop: 10 } as ViewStyle,
  mtLg: { marginTop: theme.space.lg } as ViewStyle,

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  } as ViewStyle,
  modalCard: { width: '92%', maxWidth: 560 } as ViewStyle,
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  modalTitle: { fontSize: 18, fontWeight: '900' } as TextStyle,

  extraChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 } as ViewStyle,
  extraChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  } as ViewStyle,
  extraChipPressed: { backgroundColor: 'rgba(255,255,255,0.06)' } as ViewStyle,
  extraChipDisabled: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    opacity: 0.55,
  } as ViewStyle,
  extraChipText: { fontWeight: '900' } as TextStyle,

  extraFieldsWrap: { marginTop: 14, gap: 10 } as ViewStyle,
  extraFieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 } as ViewStyle,
  extraLabelCol: { width: 90 } as ViewStyle,
  extraKeyText: { fontWeight: '900' } as TextStyle,
  extraInput: { flex: 1 } as ViewStyle,

  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,
  removeBtnPressed: { backgroundColor: 'rgba(255,255,255,0.06)' } as ViewStyle,
  removeBtnText: { fontWeight: '900' } as TextStyle,

  quickAddCardFix: { overflow: 'visible', zIndex: 0, elevation: 0 } as any,
  autocompleteLayer: { position: 'relative', zIndex: 2, elevation: 2 } as any,

  grabberWebNoScroll: { cursor: 'grab', touchAction: 'none', userSelect: 'none' } as any,
  grabberBottomWrap: {
    alignSelf: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
    gap: 6,
  } as ViewStyle,
  grabber: {
    width: 72,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  } as ViewStyle,
  grabberHint: { fontSize: 12, fontWeight: '800', opacity: 0.85 } as TextStyle,

  extraMeasureBox: { position: 'absolute', left: -9999, top: -9999, opacity: 0 } as ViewStyle,

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  } as ViewStyle,
  sheet: {
    backgroundColor: theme.colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingTop: 10,
  } as ViewStyle,
  sheetHandleWrap: { alignItems: 'center', paddingVertical: 8 } as ViewStyle,
  sheetHandle: {
    width: 56,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.22)',
  } as ViewStyle,
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  } as ViewStyle,
  sheetTitle: { fontSize: 18, fontWeight: '900' } as TextStyle,
  sheetHeaderBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,
  sheetSection: { paddingTop: 14 } as ViewStyle,
  sectionTitle: { fontWeight: '900', marginBottom: 10 } as TextStyle,

  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 } as ViewStyle,

  moreDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,
  moreDetailsText: { fontWeight: '900' } as TextStyle,
  moreDetailsDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ef4444',
    marginLeft: 2,
  } as ViewStyle,

  validationNotice: {
    marginTop: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  } as ViewStyle,

  textRTL: { textAlign: 'right', writingDirection: 'rtl' } as any,
  textLTR: { textAlign: 'left', writingDirection: 'ltr' } as any,
  textInputRTL: { textAlign: 'right', writingDirection: 'rtl' } as any,
  textInputLTR: { textAlign: 'left', writingDirection: 'ltr' } as any,

  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  } as ViewStyle,
  textCol: { flex: 1, minWidth: 0 } as ViewStyle,
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 } as ViewStyle,
  controlsRowRTL: { flexDirection: 'row-reverse' } as ViewStyle,

  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  } as ViewStyle,
  headerTextCol: { flex: 1, minWidth: 0 } as ViewStyle,
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    marginLeft: 12,
  } as ViewStyle,
  headerActionsRTL: { flexDirection: 'row-reverse', marginLeft: 0, marginRight: 12 } as ViewStyle,

  quickAddHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 } as ViewStyle,

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10 } as ViewStyle,
  nameRowRTL: { flexDirection: 'row-reverse' } as ViewStyle,
  addBtnWrap: { width: 92, alignSelf: 'flex-end' } as ViewStyle,

  listHeaderOver: { position: 'relative', zIndex: 9999, elevation: 9999 } as any,
  listCellUnderHeader: { position: 'relative', zIndex: 0, elevation: 0 } as any,

  itemNameInline: { fontWeight: '900', fontSize: 16 } as TextStyle,
  itemMetaInline: { fontWeight: '800', opacity: 0.85 } as TextStyle,
  backToAddBtn: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(29,78,216,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 9999,
    elevation: 10,
  },

  backToAddText: {
    fontWeight: '900',
    color: '#fff',
  },
});
