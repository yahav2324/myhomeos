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
import { theme } from '../../../shared/theme/theme';
import { AppText } from '../../../shared/ui/AppText';
import { authedFetch } from '../../auth/api/auth.api';

type ShoppingList = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export function ShoppingListsScreen(props: any) {
  const navigation = props?.navigation;

  const [lists, setLists] = React.useState<ShoppingList[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);

  const [name, setName] = React.useState('');
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');

  const loadLists = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch(`/shopping/lists`, { method: 'GET' });
      if (!res.ok) {
        console.log('loadLists failed', res.status, await res.text().catch(() => ''));
        return;
      }

      const json = await res.json().catch(() => ({}) as any);
      const arr = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setLists(
        (arr as any[]).map((x) => ({
          id: String(x.id),
          name: String(x.name ?? x.title ?? 'רשימה'),
          createdAt: String(x.createdAt ?? new Date().toISOString()),
          updatedAt: String(x.updatedAt ?? new Date().toISOString()),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadLists();
  }, [loadLists]);

  const openCreate = React.useCallback(() => {
    setName('');
    setCreateOpen(true);
  }, []);

  const closeCreate = React.useCallback(() => {
    setCreateOpen(false);
  }, []);

  const createList = React.useCallback(async () => {
    const n = name.trim();
    if (!n || saving) return;

    setSaving(true);
    try {
      const res = await authedFetch(`/shopping/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n }),
      });

      if (!res.ok) {
        console.log('createList failed', res.status, await res.text().catch(() => ''));
        return;
      }

      closeCreate();
      await loadLists();
    } finally {
      setSaving(false);
    }
  }, [name, saving, closeCreate, loadLists]);

  const openEdit = React.useCallback((l: ShoppingList) => {
    setEditId(l.id);
    setEditName(l.name);
    setEditOpen(true);
  }, []);

  const closeEdit = React.useCallback(() => {
    setEditOpen(false);
    setEditId(null);
  }, []);

  const saveEdit = React.useCallback(async () => {
    const n = editName.trim();
    if (!editId || !n || saving) return;

    setSaving(true);
    try {
      const res = await authedFetch(`/shopping/lists/${encodeURIComponent(editId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: n }),
      });

      if (!res.ok) {
        console.log('saveEdit failed', res.status, await res.text().catch(() => ''));
        return;
      }

      closeEdit();
      await loadLists();
    } finally {
      setSaving(false);
    }
  }, [editId, editName, saving, closeEdit, loadLists]);

  const deleteList = React.useCallback(async () => {
    if (!editId || saving) return;

    setSaving(true);
    try {
      const res = await authedFetch(`/shopping/lists/${encodeURIComponent(editId)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        console.log('deleteList failed', res.status, await res.text().catch(() => ''));
        return;
      }

      closeEdit();
      await loadLists();
    } finally {
      setSaving(false);
    }
  }, [editId, saving, closeEdit, loadLists]);

  const openList = React.useCallback(
    (l: ShoppingList) => {
      // ✅ תואם לשם המסך שלך: ShoppingList
      navigation?.navigate?.('ShoppingList', { listId: l.id, listName: l.name });
    },
    [navigation],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText style={styles.title}>רשימות קניות</AppText>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={loadLists}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.9 }]}
          >
            <AppText style={{ fontWeight: '900' }}>רענן</AppText>
          </Pressable>

          <Pressable
            onPress={openCreate}
            style={({ pressed }) => [styles.headerBtn, pressed && { opacity: 0.9 }]}
          >
            <AppText style={{ fontWeight: '900' }}>+ רשימה</AppText>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 16, alignItems: 'center', gap: 8 }}>
          <ActivityIndicator />
          <AppText tone="muted">טוען…</AppText>
        </View>
      ) : null}

      <FlatList
        data={lists}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 10 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openList(item)}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.95 }]}
          >
            <View style={{ flex: 1 }}>
              <AppText style={{ fontWeight: '900', fontSize: 16 }}>{item.name}</AppText>
              <AppText tone="muted" style={{ fontWeight: '800', marginTop: 6 }}>
                עודכן: {new Date(item.updatedAt).toLocaleDateString('he-IL')}
              </AppText>
            </View>

            <Pressable
              onPress={(e: any) => {
                e?.stopPropagation?.();
                openEdit(item);
              }}
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.9 }]}
            >
              <AppText style={{ fontWeight: '900' }}>⋯</AppText>
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText style={{ fontWeight: '900' }}>אין רשימות</AppText>
            <AppText tone="muted">לחץ על “+ רשימה” כדי ליצור</AppText>
          </View>
        }
      />

      {/* Create modal */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={closeCreate}>
        <Pressable style={styles.backdrop} onPress={closeCreate} />
        <View style={styles.modalCard}>
          <AppText style={styles.modalTitle}>יצירת רשימה</AppText>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="שם רשימה…"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={createList}
          />

          <View style={styles.modalActions}>
            <Pressable onPress={closeCreate} style={styles.secondaryBtn}>
              <AppText style={styles.btnText}>ביטול</AppText>
            </Pressable>
            <Pressable
              onPress={createList}
              disabled={!name.trim() || saving}
              style={[styles.primaryBtn, (!name.trim() || saving) && { opacity: 0.45 }]}
            >
              <AppText style={styles.btnText}>{saving ? 'יוצר…' : 'צור'}</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={editOpen} transparent animationType="fade" onRequestClose={closeEdit}>
        <Pressable style={styles.backdrop} onPress={closeEdit} />
        <View style={styles.modalCard}>
          <AppText style={styles.modalTitle}>עריכת רשימה</AppText>

          <TextInput
            value={editName}
            onChangeText={setEditName}
            placeholder="שם רשימה…"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={saveEdit}
          />

          <View style={styles.modalActions}>
            <Pressable
              onPress={deleteList}
              disabled={saving}
              style={[styles.dangerBtn, saving && { opacity: 0.6 }]}
            >
              <AppText style={styles.btnText}>מחק</AppText>
            </Pressable>

            <Pressable onPress={closeEdit} style={styles.secondaryBtn}>
              <AppText style={styles.btnText}>ביטול</AppText>
            </Pressable>

            <Pressable
              onPress={saveEdit}
              disabled={!editName.trim() || saving}
              style={[styles.primaryBtn, (!editName.trim() || saving) && { opacity: 0.45 }]}
            >
              <AppText style={styles.btnText}>{saving ? 'שומר…' : 'שמור'}</AppText>
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

  title: { fontSize: 20, fontWeight: '900' },

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
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

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
