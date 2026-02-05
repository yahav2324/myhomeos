// import React, { useState } from 'react';
// import { View, TextInput, Text, Pressable } from 'react-native';
// import { otpVerify } from '../api/auth.api';
// import { useAuthStore } from '../store/auth.store';

// export function AuthOtpScreen({ route, navigation }: any) {
//   const challengeId = route.params?.challengeId as string | undefined;

//   const [code, setCode] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [err, setErr] = useState<string | null>(null);
//   const setSession = useAuthStore((s) => s.setSession);

//   const onVerify = async () => {
//     setErr(null);

//     const trimmed = code.trim();
//     if (!challengeId) {
//       setErr('אין בקשת קוד פעילה. חזור למסך הטלפון ושלח קוד מחדש.');
//       return;
//     }
//     if (trimmed.length !== 6) return;

//     setLoading(true);
//     try {
//       const res = await otpVerify(challengeId, trimmed);
//       await setSession(res.accessToken, res.refreshToken, username, Boolean(res.needsOnboarding));

//       if (res.needsOnboarding) {
//         navigation.reset({ index: 0, routes: [{ name: 'CreateHousehold' }] });
//       } else {
//         // ✅ זה המסך של האפליקציה אצלך
//         navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
//       }
//     } catch (e: any) {
//       setErr(e?.message ?? 'Failed');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <View style={{ padding: 16, gap: 12 }}>
//       <Text style={{ fontSize: 20, fontWeight: '600' }}>הכנס קוד</Text>

//       <TextInput
//         value={code}
//         onChangeText={setCode}
//         keyboardType="number-pad"
//         placeholder="6 ספרות"
//         maxLength={6}
//         style={{ borderWidth: 1, padding: 12, borderRadius: 10, letterSpacing: 6 }}
//       />

//       {err ? <Text style={{ color: 'red' }}>{err}</Text> : null}

//       <Pressable
//         onPress={onVerify}
//         disabled={loading || code.trim().length !== 6}
//         style={{ padding: 14, borderRadius: 12, borderWidth: 1, opacity: loading ? 0.6 : 1 }}
//       >
//         <Text style={{ textAlign: 'center' }}>{loading ? 'מאמת...' : 'אמת'}</Text>
//       </Pressable>
//     </View>
//   );
// }
