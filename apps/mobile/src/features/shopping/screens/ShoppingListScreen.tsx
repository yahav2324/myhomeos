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
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

import { Card } from '../../../shared/ui/Card';
import { AppText } from '../../../shared/ui/AppText';
import { AppButton } from '../../../shared/ui/AppButton';
import { theme } from '../../../shared/theme/theme';
import type { ShoppingStackParamList } from '../navigation/shopping.stack';

import { NameAutocompleteField } from '../../../shared/components';
import type { PickPayload, SuggestTerm } from '../../../shared/components/NameAutocompleteField';
import { authedFetch } from '../../auth/api/auth.api';
import { ShoppingCategory } from '@smart-kitchen/contracts';
import { SHOPPING_CATEGORY_LABELS_HE } from '../categories';
import { CategoryDropdown } from '../../../shared/components/categoryDropdown';

/* =======================
   Types
======================= */

type Props = NativeStackScreenProps<ShoppingStackParamList, 'ShoppingList'>;

type Unit = 'pcs' | 'g' | 'ml';
type ApiUnit = 'PCS' | 'G' | 'KG' | 'ML' | 'L';

type ExtraKey = 'brand' | 'note' | 'priority' | 'price';

type Item = {
  id: string;
  termId?: string | null;
  name: string;
  quantity: number;
  unit: Unit;
  category?: ShoppingCategory;
  checked?: boolean;
  extras?: Record<string, string>;
};

type Row = { kind: 'header'; id: string; title: string } | { kind: 'item'; id: string; item: Item };

const DEFAULT_QTY = 1;
const DEFAULT_UNIT: Unit = 'pcs';
const UNIT_OPTIONS: Unit[] = ['pcs', 'g', 'ml'];

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

function unitToApi(u: Unit): ApiUnit {
  if (u === 'g') return 'G';
  if (u === 'ml') return 'ML';
  return 'PCS';
}

function mapApiItemToUi(x: any): Item {
  const apiUnit = String(x.unit ?? 'PCS');
  const uiUnit: Unit = apiUnit === 'G' ? 'g' : apiUnit === 'ML' ? 'ml' : 'pcs';

  const cat = x.category ? (String(x.category) as ShoppingCategory) : undefined;

  return {
    id: String(x.id ?? `${Date.now()}-${Math.random()}`),
    termId: x.termId ? String(x.termId) : null,
    name: String(x.text ?? x.name ?? ''),
    quantity: Number(x.qty ?? x.quantity ?? 1),
    unit: uiUnit,
    category: cat,
    checked: Boolean(x.checked ?? false),
    extras: (x.extra ?? x.extras) || undefined,
  };
}

function shortId(id: string, size = 10): string {
  const s = String(id ?? '');
  if (s.length <= size) return s;
  // UUID -> show start..end
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

/* =======================
   UI helpers
======================= */

function UnitChips(props: { value: Unit; onChange: (u: Unit) => void }) {
  const { value, onChange } = props;
  return (
    <View style={styles.unitRow}>
      {UNIT_OPTIONS.map((u) => (
        <Pressable
          key={u}
          onPress={() => onChange(u)}
          style={({ pressed }) => [
            styles.unitChip,
            value === u && styles.unitChipActive,
            pressed && { opacity: 0.8 },
          ]}
        >
          <AppText style={{ fontWeight: '900' }}>{u}</AppText>
        </Pressable>
      ))}
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
   Bottom Sheet (Filters)
   - Works on Android (phone) reliably
======================= */

function useBottomSheet(open: boolean) {
  const { height: H } = Dimensions.get('window');
  const sheetH = Math.min(640, Math.floor(H * 0.82));
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
   Screen
======================= */

export function ShoppingListScreen({ route }: Props) {
  const { listId, listName } = route.params;

  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // ✅ show/hide quick add
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

  // quick add
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
     Quick Add drag expand/collapse
======================= */

  const [quickAddExpanded, setQuickAddExpanded] = React.useState(false);

  const extraH = React.useRef(new Animated.Value(0)).current;
  const extraMaxHRef = React.useRef(0);
  const panRef = React.useRef({ startH: 0 }).current;

  const setExpandedFromHeight = React.useCallback((h: number) => {
    const max = extraMaxHRef.current || 1;
    setQuickAddExpanded(h > max * 0.15);
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
            // dy positive = drag down -> close ; dy negative = drag up -> open
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

  // web pointer support
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

    const onUp = (clientY: number, ev: any) => {
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
    const te = (e: TouchEvent) => {
      const t = e.changedTouches?.[0];
      onUp(t?.clientY ?? webDrag.startY, e);
    };

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
     Load
======================= */

  const loadItems = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`/shopping/lists/${encodeURIComponent(listId)}/items`, {
        method: 'GET',
      });

      if (!res.ok) {
        console.log('loadItems failed', res.status, await res.text().catch(() => ''));
        return;
      }

      const json = await res.json();
      const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setItems(arr.map(mapApiItemToUi));
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useFocusEffect(
    React.useCallback(() => {
      loadItems();
    }, [loadItems]),
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
     Add (ONLY by button)
======================= */

  const onAdd = React.useCallback(async () => {
    const text = name.trim();
    if (!text || saving) return;

    if (wouldDuplicate(text, selectedTermId)) return;

    setSaving(true);
    try {
      const res = await authedFetch(`/shopping/lists/${encodeURIComponent(listId)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          termId: selectedTermId ?? undefined,
          qty: safeQty(qty),
          unit: unitToApi(unit),
          category: category ?? undefined,
          extra: Object.keys(extras).length ? extras : undefined,
        }),
      });

      if (!res.ok) {
        console.log('addItem failed', res.status, await res.text().catch(() => ''));
        return;
      }

      setName('');
      setQty(String(DEFAULT_QTY));
      setUnit(DEFAULT_UNIT);
      setCategory(null);
      setSelectedTermId(null);
      resetExtras();
      setDetailsOpen(false);

      snapExtraTo(false);
      await loadItems();
    } finally {
      setSaving(false);
    }
  }, [
    name,
    saving,
    wouldDuplicate,
    selectedTermId,
    listId,
    qty,
    unit,
    category,
    extras,
    resetExtras,
    loadItems,
    snapExtraTo,
  ]);

  /* =======================
     Autocomplete (NO add)
======================= */

  const onPick = React.useCallback((p: PickPayload) => {
    setName(p.text);
    setSelectedTermId(p.kind === 'term' ? p.termId : null);
  }, []);

  const fetchSuggest = React.useCallback(
    async (q: string, lang: string): Promise<SuggestTerm[]> => {
      const query = q.trim();
      if (!query) return [];

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
    },
    [],
  );

  const onCreateNew = React.useCallback(async (text: string, lang: string) => {
    const t = text.trim();
    if (!t) return;

    await authedFetch(`/terms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: t, lang }),
    }).catch(() => {});
  }, []);

  const onVote = React.useCallback(async (termId: string, vote: 'UP' | 'DOWN') => {
    await authedFetch(`/terms/${encodeURIComponent(termId)}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vote }),
    }).catch(() => {});
  }, []);

  /* =======================
     Item ops
======================= */

  const deleteItem = React.useCallback(
    async (itemId: string) => {
      let prev: Item[] = [];
      setItems((curr) => {
        prev = curr;
        return curr.filter((x) => x.id !== itemId);
      });

      try {
        const res = await authedFetch(
          `/shopping/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}`,
          { method: 'DELETE' },
        );

        if (!res.ok) {
          console.log('deleteItem failed', res.status, await res.text().catch(() => ''));
          setItems(prev);
          return;
        }

        await loadItems();
      } catch (e) {
        console.log('deleteItem error', e);
        setItems(prev);
      }
    },
    [listId, loadItems],
  );

  const setChecked = React.useCallback(
    async (itemId: string, checked: boolean) => {
      let prev: Item[] = [];
      setItems((curr) => {
        prev = curr;
        return curr.map((x) => (x.id === itemId ? { ...x, checked } : x));
      });

      try {
        const res = await authedFetch(
          `/shopping/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}/checked`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checked }),
          },
        );

        if (!res.ok) {
          console.log('setChecked failed', res.status, await res.text().catch(() => ''));
          setItems(prev);
          return;
        }

        await loadItems();
      } catch (e) {
        console.log('setChecked error', e);
        setItems(prev);
      }
    },
    [listId, loadItems],
  );

  const openItem = React.useCallback((it: Item) => {
    setActiveItem(it);
    setItemOpen(true);

    setEditName(it.name ?? '');
    setEditQty(String(it.quantity ?? DEFAULT_QTY));
    setEditUnit(it.unit ?? DEFAULT_UNIT);
    setEditCategory(it.category ?? null);

    const ex = it.extras ?? {};
    setEditExtras(ex);

    const keys = Object.keys(ex) as ExtraKey[];
    setEditExtraKeys(keys.filter((k) => ['brand', 'note', 'priority', 'price'].includes(k)));
  }, []);

  const closeItem = React.useCallback(() => {
    setItemOpen(false);
    setActiveItem(null);
  }, []);

  const saveActiveEdits = React.useCallback(async () => {
    if (!activeItem || saving) return;

    const nextText = editName.trim();
    if (!nextText) return;

    const otherItems = items.filter((x) => x.id !== activeItem.id);
    const dup =
      (activeItem.termId
        ? otherItems.some((it) => it.termId && String(it.termId) === String(activeItem.termId))
        : otherItems.some((it) => normText(it.name) === normText(nextText))) ||
      otherItems.some((it) => normText(it.name) === normText(nextText));

    if (dup) return;

    setSaving(true);
    try {
      const payload: any = {
        text: nextText,
        qty: safeQty(editQty),
        unit: unitToApi(editUnit),
        category: editCategory ?? null,
        extra: Object.keys(editExtras).length ? editExtras : null,
      };

      const res = await authedFetch(
        `/shopping/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(activeItem.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        console.log('updateItem failed', res.status, await res.text().catch(() => ''));
        return;
      }

      await loadItems();
      closeItem();
    } finally {
      setSaving(false);
    }
  }, [
    activeItem,
    saving,
    listId,
    editName,
    editQty,
    editUnit,
    editCategory,
    editExtras,
    loadItems,
    closeItem,
    items,
  ]);

  /* =======================
     Filters actions
======================= */

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
     Filters Bottom Sheet impl
======================= */

  const { sheetH, translateY } = useBottomSheet(filtersOpen);

  const closeFilters = React.useCallback(() => setFiltersOpen(false), []);

  const sheetPan = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6,
        onPanResponderMove: (_e, g) => {
          // drag down to close
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
    () => (
      <>
        <CategoryDropdown value={category} onChange={setCategory} label="קטגוריה" />

        <AppText tone="muted" style={{ marginTop: 8 }}>
          יחידה
        </AppText>
        <UnitChips value={unit} onChange={setUnit} />

        <TextInput
          value={qty}
          onChangeText={setQty}
          keyboardType="numeric"
          placeholder="כמות"
          placeholderTextColor={theme.colors.muted}
          style={styles.input}
        />

        <View style={styles.rowGap}>
          <AppButton title="פרטים נוספים" variant="ghost" onPress={() => setDetailsOpen(true)} />
        </View>

        {name.trim() && wouldDuplicate(name.trim(), selectedTermId) ? (
          <AppText tone="muted" style={{ marginTop: 6 }}>
            הפריט כבר קיים ברשימה (לא נוסיף כפול)
          </AppText>
        ) : null}
      </>
    ),
    [
      category,
      setCategory,
      unit,
      setUnit,
      qty,
      setQty,
      setDetailsOpen,
      name,
      wouldDuplicate,
      selectedTermId,
    ],
  );

  /* =======================
     Render
======================= */

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <AppText tone="muted" style={styles.subTitle}>
            {shortId(listId, 5)}
            {listName ? ` — ${listName}` : ''}
          </AppText>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <AppButton
            title={showQuickAdd ? 'רק רשימה' : 'הצג הוספה'}
            variant="ghost"
            onPress={() => setShowQuickAdd((x) => !x)}
          />
        </View>
      </View>

      {/* Compact control bar (mobile friendly) */}
      <View style={styles.controlBar}>
        <Pressable
          onPress={() => setFiltersOpen(true)}
          style={({ pressed }) => [styles.controlBtn, pressed && { opacity: 0.85 }]}
        >
          <AppText style={styles.controlBtnText}>{filtersActive ? 'פילטרים ✓' : 'פילטרים'}</AppText>
        </Pressable>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* <SmallPill
            label={groupByCategory ? 'קיבוץ ✓' : 'קיבוץ'}
            active={groupByCategory}
            onPress={() => setGroupByCategory((x) => !x)}
          />
          <SmallPill
            label={hideChecked ? 'הסתר ✓' : 'הסתר'}
            active={hideChecked}
            onPress={() => setHideChecked((x) => !x)}
          /> */}
          <Pressable
            onPress={loadItems}
            style={({ pressed }) => [styles.controlBtnGhost, pressed && { opacity: 0.85 }]}
          >
            <AppText style={styles.controlBtnText}>רענן</AppText>
          </Pressable>
        </View>
      </View>

      {/* Quick add */}
      {showQuickAdd ? (
        <Card style={[styles.cardTop, styles.quickAddCardFix]}>
          <AppText style={styles.cardTitle}>הוספה מהירה</AppText>

          <View style={[styles.formGap, styles.autocompleteLayer]}>
            <NameAutocompleteField
              label="שם פריט"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setSelectedTermId(null);
              }}
              placeholder="למשל: מלפפון"
              minChars={2}
              lang="he"
              fetchSuggest={fetchSuggest}
              onCreateNew={onCreateNew}
              onVote={onVote}
              onPick={onPick}
            />

            {/* Buttons always visible */}
            <View style={[styles.rowGap, { marginTop: 12 }]}>
              <AppButton
                title={quickAddExpanded ? 'צמצם' : 'הרחב'}
                variant="ghost"
                onPress={() => snapExtraTo(!quickAddExpanded)}
              />
              <AppButton
                title={saving ? 'מוסיף…' : 'הוסף'}
                onPress={onAdd}
                disabled={!name.trim() || saving || wouldDuplicate(name.trim(), selectedTermId)}
              />
            </View>

            {/* Extra section */}
            {/* Extra section (measure + visible) */}

            {/* 1) hidden measure OUTSIDE the animated container */}
            <View
              pointerEvents="none"
              style={styles.extraMeasureBox}
              onLayout={(e) => {
                const h = Math.ceil(e.nativeEvent.layout.height);
                if (h > 0 && h !== extraMaxHRef.current) {
                  extraMaxHRef.current = h;

                  // אם כבר פתוח — לסנכרן לגובה החדש
                  extraH.stopAnimation((val: number) => {
                    if (val > 0.01) extraH.setValue(h);
                  });
                }
              }}
            >
              <ExtraContent />
            </View>

            {/* 2) visible animated container */}
            <Animated.View style={{ height: extraH, overflow: 'hidden', marginTop: 10 }}>
              <View>
                <ExtraContent />
              </View>
            </Animated.View>
          </View>

          {/* Grabber */}
          <View
            style={[styles.grabberBottomWrap, Platform.OS === 'web' && styles.grabberWebNoScroll]}
            {...(Platform.OS === 'web' ? (webHandlers as any) : grabberPan.panHandlers)}
          >
            <View style={styles.grabber} />
          </View>
        </Card>
      ) : null}

      {/* Loading */}
      {loading ? (
        <View style={{ marginTop: theme.space.lg, alignItems: 'center' }}>
          <ActivityIndicator />
          <AppText tone="muted" style={{ marginTop: 8 }}>
            טוען…
          </AppText>
        </View>
      ) : null}

      {/* List */}
      <FlatList
        style={styles.list}
        data={rows}
        keyExtractor={(x) => x.id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: row }) => {
          if (row.kind === 'header') {
            return (
              <View style={styles.groupHeader}>
                <AppText style={styles.groupHeaderText}>{row.title}</AppText>
              </View>
            );
          }

          const item = row.item;
          const isChecked = Boolean(item.checked);

          return (
            <Pressable onPress={() => openItem(item)}>
              <Card>
                <View style={styles.itemTopRow}>
                  <AppText style={[styles.itemName, isChecked && { opacity: 0.6 }]}>
                    {item.name}
                  </AppText>
                  <AppText tone="muted">
                    {item.quantity} {item.unit}
                  </AppText>
                </View>

                <View style={styles.itemMetaRow}>
                  <View style={{ flex: 1, gap: 4 }}>
                    {item.category ? (
                      <AppText tone="muted">
                        קטגוריה: {SHOPPING_CATEGORY_LABELS_HE[item.category] ?? item.category}
                      </AppText>
                    ) : (
                      <AppText tone="muted">קטגוריה: ללא</AppText>
                    )}

                    <AppText tone="muted" numberOfLines={1}>
                      {item.extras
                        ? `פרטים: ${Object.keys(item.extras).length}`
                        : 'אין פרטים נוספים'}
                    </AppText>

                    {parsePrice(item.extras) != null ? (
                      <AppText tone="muted">מחיר: {parsePrice(item.extras)}</AppText>
                    ) : null}
                  </View>

                  <View style={styles.itemActionsInline}>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        setChecked(item.id, !isChecked);
                      }}
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                    >
                      <AppText style={styles.iconBtnText}>{isChecked ? '↩' : '✓'}</AppText>
                    </Pressable>

                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteItem(item.id);
                      }}
                      style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
                    >
                      <AppText style={styles.iconBtnText}>🗑</AppText>
                    </Pressable>
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />

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
              <AppText style={styles.sheetTitle}>פילטרים</AppText>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => {
                    resetAllFilters();
                  }}
                  style={({ pressed }) => [styles.sheetHeaderBtn, pressed && { opacity: 0.85 }]}
                >
                  <AppText style={{ fontWeight: '900' }}>איפוס</AppText>
                </Pressable>

                <Pressable
                  onPress={closeFilters}
                  style={({ pressed }) => [styles.sheetHeaderBtn, pressed && { opacity: 0.85 }]}
                >
                  <AppText style={{ fontWeight: '900' }}>סגור</AppText>
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
                    כללי
                  </AppText>

                  <View style={styles.rowGap}>
                    <AppButton
                      title={groupByCategory ? 'קיבוץ לפי קטגוריה ✓' : 'קיבוץ לפי קטגוריה'}
                      variant="ghost"
                      onPress={() => setGroupByCategory((x) => !x)}
                    />
                    <AppButton
                      title={hideChecked ? 'הסתר נרכשו ✓' : 'הסתר נרכשו'}
                      variant="ghost"
                      onPress={() => setHideChecked((x) => !x)}
                    />
                  </View>

                  <View style={[styles.rowGap, { marginTop: 10 }]}>
                    <AppButton
                      title={onlyWithPrice ? 'רק עם מחיר ✓' : 'רק עם מחיר'}
                      variant="ghost"
                      onPress={() => setOnlyWithPrice((x) => !x)}
                    />
                  </View>
                </View>

                <View style={styles.sheetSection}>
                  <AppText tone="muted" style={styles.sectionTitle}>
                    מחיר
                    {priceStats.has
                      ? ` (קיים: ${priceStats.min}–${priceStats.max})`
                      : ' (אין עדיין מחירים)'}
                  </AppText>

                  <View style={[styles.rowGap, { marginTop: 8 }]}>
                    <TextInput
                      value={priceMinText}
                      onChangeText={setPriceMinText}
                      keyboardType="numeric"
                      placeholder="מינימום"
                      placeholderTextColor={theme.colors.muted}
                      style={[styles.input, { flex: 1 }]}
                    />
                    <TextInput
                      value={priceMaxText}
                      onChangeText={setPriceMaxText}
                      keyboardType="numeric"
                      placeholder="מקסימום"
                      placeholderTextColor={theme.colors.muted}
                      style={[styles.input, { flex: 1 }]}
                    />
                  </View>
                </View>

                <View style={styles.sheetSection}>
                  <AppText tone="muted" style={styles.sectionTitle}>
                    קטגוריות
                  </AppText>

                  <View style={styles.categoryWrap}>
                    {allCategories.length === 0 ? (
                      <AppText tone="muted">אין עדיין קטגוריות ברשימה</AppText>
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
                    title="נקה פילטרים"
                    variant="ghost"
                    onPress={() => {
                      resetAllFilters();
                    }}
                  />
                  <AppButton title="החל" onPress={() => setFiltersOpen(false)} />
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
            <AppText style={styles.modalTitle}>פרטים נוספים</AppText>

            <AppText tone="muted" style={styles.mt10}>
              הוסף שדות (לחיצה אחת):
            </AppText>

            <View style={styles.extraChipsRow}>
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
                <AppText tone="muted">לא נבחרו שדות עדיין</AppText>
              ) : (
                extraKeys.map((k) => (
                  <View key={k} style={styles.extraFieldRow}>
                    <View style={styles.extraLabelCol}>
                      <AppText style={styles.extraKeyText}>{heExtraLabel(k)}</AppText>
                    </View>

                    <TextInput
                      value={extras[k] ?? ''}
                      onChangeText={(t) => setExtras((e) => ({ ...e, [k]: t }))}
                      placeholder={`הכנס ${heExtraLabel(k)}`}
                      placeholderTextColor={theme.colors.muted}
                      style={[styles.input, styles.extraInput]}
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
              <AppButton title="שמור" onPress={() => setDetailsOpen(false)} disabled={saving} />
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
                style={{ marginTop: 10, maxHeight: 520 }}
                contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                <AppText tone="muted">שם</AppText>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="שם פריט"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />

                <CategoryDropdown value={editCategory} onChange={setEditCategory} label="קטגוריה" />

                <AppText tone="muted">יחידה</AppText>
                <UnitChips value={editUnit} onChange={setEditUnit} />

                <AppText tone="muted">כמות</AppText>
                <TextInput
                  value={editQty}
                  onChangeText={setEditQty}
                  keyboardType="numeric"
                  placeholder="כמות"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                />

                <AppText tone="muted" style={{ marginTop: 6 }}>
                  פרטים נוספים (ברמת הרשימה)
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
                          onChangeText={(t) => setEditExtras((e) => ({ ...e, [k]: t }))}
                          placeholder={`הכנס ${heExtraLabel(k)}`}
                          placeholderTextColor={theme.colors.muted}
                          style={[styles.input, styles.extraInput]}
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

                <View style={[styles.rowGap, styles.mtLg]}>
                  <AppButton
                    title={activeItem.checked ? 'החזר' : 'בוצע'}
                    variant="ghost"
                    onPress={() => {
                      const next = !activeItem.checked;
                      setChecked(activeItem.id, next);
                      setActiveItem((prev) => (prev ? { ...prev, checked: next } : prev));
                    }}
                  />
                  <AppButton
                    title="מחק"
                    variant="ghost"
                    onPress={() => {
                      deleteItem(activeItem.id);
                      closeItem();
                    }}
                  />
                </View>

                <View style={[styles.rowGap, { marginTop: 10 }]}>
                  <AppButton title="סגור" variant="ghost" onPress={closeItem} />
                  <AppButton
                    title={saving ? 'שומר…' : 'שמור'}
                    onPress={saveActiveEdits}
                    disabled={!editName.trim() || saving}
                  />
                </View>
              </ScrollView>
            ) : null}
          </Card>
        </View>
      </Modal>
    </View>
  );
}

/* =======================
   Styles
======================= */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    // במובייל padding xl זה “ענק” -> זה אחד הדברים שעשו את זה מכוער
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  } as ViewStyle,

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  } as ViewStyle,

  title: {
    fontSize: 20,
    fontWeight: '900',
  } as TextStyle,

  subTitle: {
    marginTop: 2,
    opacity: 0.8,
    fontWeight: '800',
  } as TextStyle,

  controlBar: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  } as ViewStyle,

  controlBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  } as ViewStyle,

  controlBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,

  controlBtnText: {
    fontWeight: '900',
  } as TextStyle,

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

  pillText: {
    fontWeight: '900',
    opacity: 0.95,
  } as TextStyle,

  cardTop: {
    marginTop: 14,
  } as ViewStyle,

  cardTitle: {
    fontWeight: '900',
  } as TextStyle,

  formGap: {
    marginTop: theme.space.md,
    gap: 10,
  } as ViewStyle,

  rowGap: {
    flexDirection: 'row',
    gap: 10,
  } as ViewStyle,

  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: '#0F172A',
  } as any,

  list: { marginTop: 14 } as ViewStyle,
  listContent: { gap: theme.space.md, paddingBottom: 40 } as ViewStyle,

  groupHeader: { paddingVertical: 8, paddingHorizontal: 2 } as ViewStyle,
  groupHeaderText: { fontWeight: '900', opacity: 0.9 } as TextStyle,

  itemTopRow: { flexDirection: 'row', justifyContent: 'space-between' } as ViewStyle,
  itemName: { fontWeight: '900' } as TextStyle,

  mt10: { marginTop: 10 } as ViewStyle,
  mtLg: { marginTop: theme.space.lg } as ViewStyle,

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  } as ViewStyle,

  modalCard: { width: '92%', maxWidth: 520 } as ViewStyle,

  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  modalTitle: { fontSize: 18, fontWeight: '900' } as TextStyle,

  unitRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 6,
  } as ViewStyle,

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

  extraChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 10,
  } as ViewStyle,

  extraChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(255,255,255,0.04)',
  } as ViewStyle,

  extraChipPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  } as ViewStyle,

  extraChipDisabled: {
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    opacity: 0.55,
  } as ViewStyle,

  extraChipText: {
    fontWeight: '900',
  } as TextStyle,

  extraFieldsWrap: {
    marginTop: 14,
    gap: 10,
  } as ViewStyle,

  extraFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  } as ViewStyle,

  extraLabelCol: {
    width: 90,
  } as ViewStyle,

  extraKeyText: {
    fontWeight: '900',
  } as TextStyle,

  extraInput: {
    flex: 1,
  } as ViewStyle,

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

  removeBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  } as ViewStyle,

  removeBtnText: {
    fontWeight: '900',
  } as TextStyle,

  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  } as ViewStyle,

  itemActionsInline: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  } as ViewStyle,

  quickAddCardFix: {
    overflow: 'visible',
    zIndex: 20,
  } as ViewStyle,

  grabberWebNoScroll: {
    cursor: 'grab',
    touchAction: 'none',
    userSelect: 'none',
  } as any,

  grabberBottomWrap: {
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 10,
  } as ViewStyle,

  grabber: {
    width: 72,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.25)',
  } as ViewStyle,

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

  iconBtnPressed: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  } as ViewStyle,

  iconBtnText: {
    fontWeight: '900',
  } as TextStyle,

  autocompleteLayer: {
    position: 'relative',
    zIndex: 999,
    elevation: 999,
  } as ViewStyle,

  /* ===== Bottom Sheet styles ===== */

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

  sheetHandleWrap: {
    alignItems: 'center',
    paddingVertical: 8,
  } as ViewStyle,

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

  sheetTitle: {
    fontSize: 18,
    fontWeight: '900',
  } as TextStyle,

  sheetHeaderBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  } as ViewStyle,

  sheetSection: {
    paddingTop: 14,
  } as ViewStyle,

  sectionTitle: {
    fontWeight: '900',
    marginBottom: 10,
  } as TextStyle,

  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  } as ViewStyle,
  extraMeasureBox: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
  } as ViewStyle,
});
