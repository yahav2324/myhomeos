import * as React from 'react';
import { View, TextInput, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useCreateHousehold } from '../hooks/useCreateHousehold';
import { AppButton } from '../../../shared/ui/AppButton';
import { AppText } from '../../../shared/ui/AppText';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateHousehold'>;

export function CreateHouseholdScreen({ navigation }: Props) {
  const [name, setName] = React.useState('בית');
  const { run, loading, error } = useCreateHousehold();

  const onCreate = async () => {
    const n = name.trim();
    if (!n) {
      Alert.alert('חסר שם', 'תן שם לבית');
      return;
    }
    await run(n);

    // אחרי יצירה: קופצים לאפליקציה
    navigation.reset({
      index: 0,
      routes: [{ name: 'Tabs' }],
    });
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: 'center', gap: 12 }}>
      <AppText style={{ fontSize: 22, fontWeight: '700' }}>נשאר שלב אחד</AppText>
      <AppText>צור בית ראשון כדי להתחיל להשתמש בקופסאות וברשימות קניות.</AppText>

      <AppText style={{ marginTop: 12 }}>שם הבית</AppText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="למשל: בית זמיר"
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 16,
        }}
        autoCapitalize="none"
      />

      {!!error && <AppText style={{ color: 'crimson' }}>{error}</AppText>}

      <AppButton title={loading ? 'יוצר...' : 'צור בית'} onPress={onCreate} disabled={loading} />
    </View>
  );
}
