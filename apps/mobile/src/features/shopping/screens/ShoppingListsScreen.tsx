import * as React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useShallow } from 'zustand/react/shallow';

import { theme } from '../../../shared/theme/theme';
import { AppText } from '../../../shared/ui/AppText';
import { Lang, t } from '../../../shared/i18n/i18n';
import { RefreshCw, ListPlus, MoreVertical, AlignJustify } from 'lucide-react-native';
import { useLangStore } from '../../../shared/i18n/lang.store';

import { useShoppingStore } from '../store/shopping.store';
import { OnlineBadge } from '../../../shared/ui/OnlineBadge';

type ShoppingListUI = {
  localId: string;
  name: string;
  updatedAt: number;
};

export function formatWhenHe(dateInput: string | number | Date) {
  const d = new Date(dateInput);
  const now = new Date();

  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const time = d.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return `${t('todayAt')} ${time}`;
  }

  const date = d.toLocaleDateString('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return `${date} ${t('atHour')} ${time}`;
}

export function ShoppingListsScreen(props: any) {
  const navigation = props?.navigation;

  const lang = useLangStore((s) => s.lang as Lang);
  const isRTL = lang === 'he';

  const {
    lists,
    loading,
    saving,
    lastError,
    refreshLists,
    trySync,
    createList,
    renameList,
    deleteList,
  } = useShoppingStore(
    useShallow((s) => ({
      lists: s.lists,
      loading: s.loading,
      saving: s.saving,
      lastError: s.lastError,
      refreshLists: s.refreshLists,
      trySync: s.trySync,
      createList: s.createList,
      renameList: s.renameList,
      deleteList: s.deleteList,
    })),
  );

  const loadLists = React.useCallback(async () => {
    await refreshLists();
    if (Platform.OS !== 'web') void trySync();
  }, [refreshLists, trySync]);

  React.useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const [name, setName] = React.useState('');
  const [editLocalId, setEditLocalId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');

  const openCreate = React.useCallback(() => {
    setName('');
    setCreateOpen(true);
  }, []);

  const closeCreate = React.useCallback(() => {
    setCreateOpen(false);
  }, []);

  const onCreateList = React.useCallback(async () => {
    const n = name.trim();
    if (!n || saving) return;

    await createList(n);
    closeCreate();
  }, [name, saving, createList, closeCreate]);

  const openEdit = React.useCallback((l: ShoppingListUI) => {
    setEditLocalId(l.localId);
    setEditName(l.name);
    setEditOpen(true);
  }, []);

  const closeEdit = React.useCallback(() => {
    setEditOpen(false);
    setEditLocalId(null);
  }, []);

  const saveEdit = React.useCallback(async () => {
    const n = editName.trim();
    if (!editLocalId || !n || saving) return;

    const list = lists.find((x) => x.localId === editLocalId);
    if (!list) return;

    await renameList(list, n);
    closeEdit();
  }, [editName, editLocalId, saving, lists, renameList, closeEdit]);

  const onDeleteList = React.useCallback(async () => {
    if (!editLocalId || saving) return;

    const list = lists.find((x) => x.localId === editLocalId);
    if (!list) return;

    await deleteList(list);
    closeEdit();
  }, [editLocalId, saving, lists, deleteList, closeEdit]);

  const openList = React.useCallback(
    (l: ShoppingListUI) => {
      navigation?.navigate?.('ShoppingList', { listLocalId: l.localId, listName: l.name });
    },
    [navigation],
  );

  const uiLists: ShoppingListUI[] = React.useMemo(
    () =>
      lists.map((x) => ({
        localId: x.localId,
        name: x.name,
        updatedAt: x.updatedAt,
      })),
    [lists],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <OnlineBadge compact />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={loadLists}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.9 }]}
          >
            <AppText style={{ fontWeight: '900' }}>
              <RefreshCw size={18} color={theme.colors.text} />
            </AppText>
          </Pressable>

          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.9 }]}
          >
            <AppText style={{ fontWeight: '900' }}>
              <ListPlus size={18} color={theme.colors.text} />
            </AppText>
          </Pressable>
        </View>
      </View>

      {lastError ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <AppText tone="muted" style={{ fontWeight: '900' }}>
            {lastError}
          </AppText>
        </View>
      ) : null}

      {loading ? (
        <View style={{ padding: 16, alignItems: 'center', gap: 8 }}>
          <ActivityIndicator />
          <AppText style={[isRTL ? styles.textRTL : styles.textLTR]} tone="muted">
            {t('loading')}
          </AppText>
        </View>
      ) : null}

      <FlatList
        data={uiLists}
        keyExtractor={(x) => x.localId}
        contentContainerStyle={[{ padding: 16, paddingBottom: 120, gap: 10 }]}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openList(item)}
            style={({ pressed }) => [
              styles.card,
              pressed && { opacity: 0.95 },
              lang === 'he' ? styles.rowRTL : styles.rowLTR,
            ]}
          >
            <View>
              <AppText
                style={[
                  lang === 'he' ? styles.textRTL : styles.textLTR,
                  { fontWeight: '900', fontSize: 16 },
                ]}
              >
                {item.name}
              </AppText>
              <AppText
                tone="muted"
                style={[
                  lang === 'he' ? styles.textRTL : styles.textLTR,
                  { fontWeight: '800', marginTop: 6 },
                ]}
              >
                {t('lastUpdated', {
                  when: formatWhenHe(item.updatedAt),
                })}
              </AppText>
            </View>

            <Pressable
              onPress={(e: any) => {
                e?.stopPropagation?.();
                openEdit(item);
              }}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.9 }]}
            >
              <AppText style={{ fontWeight: '900' }}>
                <MoreVertical size={18} color={theme.colors.text} />
              </AppText>
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <AppText style={{ fontWeight: '900' }}>{t('noLists') ?? 'אין רשימות'}</AppText>
              <AppText tone="muted">{t('createFirstListHint') ?? 'לחץ על “+” כדי ליצור'}</AppText>
            </View>
          )
        }
      />

      {/* Create modal */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={closeCreate}>
        <Pressable style={styles.backdrop} onPress={closeCreate} />
        <View style={styles.modalCard}>
          <AppText style={styles.modalTitle}>{t('createList') ?? 'יצירת רשימה'}</AppText>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('list_name') ? t('list_name') + '…' : 'שם רשימה…'}
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, lang === 'he' ? styles.textRTL : styles.textLTR]}
            returnKeyType="done"
            onSubmitEditing={onCreateList}
          />

          <View style={styles.modalActions}>
            <Pressable onPress={closeCreate} style={styles.secondaryBtn}>
              <AppText style={styles.btnText}>{t('cancel') ?? 'ביטול'}</AppText>
            </Pressable>
            <Pressable
              onPress={onCreateList}
              disabled={!name.trim() || saving}
              style={[styles.primaryBtn, (!name.trim() || saving) && { opacity: 0.45 }]}
            >
              <AppText style={styles.btnText}>
                {saving ? (t('saving') ?? 'יוצר…') : (t('create') ?? 'צור')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={closeEdit}>
        <Pressable style={styles.backdrop} onPress={closeEdit} />
        <View style={styles.modalCard}>
          <AppText style={styles.modalTitle}>{t('edit_list') ?? 'עריכת רשימה'}</AppText>

          <TextInput
            value={editName}
            onChangeText={setEditName}
            placeholder={(t('list_name') ?? 'שם רשימה') + '…'}
            placeholderTextColor={theme.colors.muted}
            style={[styles.input, isRTL ? { textAlign: 'right' } : { textAlign: 'left' }]}
            returnKeyType="done"
            onSubmitEditing={saveEdit}
          />

          <View style={styles.modalActions}>
            <Pressable
              onPress={onDeleteList}
              disabled={saving}
              style={[styles.dangerBtn, saving && { opacity: 0.6 }]}
            >
              <AppText style={styles.btnText}>{t('delete') ?? 'מחק'}</AppText>
            </Pressable>

            <Pressable onPress={closeEdit} style={styles.secondaryBtn}>
              <AppText style={styles.btnText}>{t('cancel') ?? 'ביטול'}</AppText>
            </Pressable>

            <Pressable
              onPress={saveEdit}
              disabled={!editName.trim() || saving}
              style={[styles.primaryBtn, (!editName.trim() || saving) && { opacity: 0.45 }]}
            >
              <AppText style={styles.btnText}>
                {saving ? (t('saving') ?? 'שומר…') : (t('save') ?? 'שמור')}
              </AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.colors.bg },

  header: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  textRTL: { textAlign: 'right', writingDirection: 'rtl' } as any,
  textLTR: { textAlign: 'left', writingDirection: 'ltr' } as any,
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  empty: { padding: 24, alignItems: 'center', gap: 6, opacity: 0.85 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },

  modalCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: Platform.OS === 'web' ? 120 : '22%',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: '#0B1220',
    padding: 14,
  },

  modalTitle: { fontSize: 18, fontWeight: '900' },

  input: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    backgroundColor: '#0F172A',
  },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },

  primaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(59,130,246,0.90)',
  },
  secondaryBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  rowRTL: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  rowLTR: { flexDirection: 'row', justifyContent: 'space-between' },
  dangerBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(239,68,68,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },

  btnText: { fontWeight: '900' },
});
