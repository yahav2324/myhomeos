import React, { useState } from 'react';
import { View, TextInput, Text, Pressable } from 'react-native';
import { otpRequest } from '../api/auth.api';

export function AuthPhoneScreen({ navigation }: any) {
  const [phone, setPhone] = useState('+972');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSend = async () => {
    setErr(null);
    setLoading(true);
    try {
      const res = await otpRequest(phone.trim());
      navigation.navigate('AuthOtp', { phoneE164: phone.trim(), challengeId: res.challengeId });
    } catch (e: any) {
      setErr(e.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '600' }}>התחברות</Text>
      <Text>הכנס מספר טלפון (E.164)</Text>
      <TextInput
        value={phone}
        onChangeText={setPhone}
        autoCapitalize="none"
        keyboardType="phone-pad"
        placeholder="+9725..."
        style={{ borderWidth: 1, padding: 12, borderRadius: 10 }}
      />

      {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}

      <Pressable
        onPress={onSend}
        disabled={loading}
        style={{ padding: 14, borderRadius: 12, borderWidth: 1, opacity: loading ? 0.6 : 1 }}
      >
        <Text style={{ textAlign: 'center' }}>{loading ? 'שולח...' : 'שלח קוד'}</Text>
      </Pressable>
    </View>
  );
}
