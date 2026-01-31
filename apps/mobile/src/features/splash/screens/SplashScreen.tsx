import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';

export function SplashScreen({ navigation, route }: any) {
  const next = route?.params?.next ?? 'AuthGoogle';
  const ref = React.useRef<Video>(null);

  // ✅ Fallback שלא תיתקע לעולם (גם אם ווב לא מעדכן סטטוס)
  React.useEffect(() => {
    const t = setTimeout(() => navigation.replace(next), 3500);
    return () => clearTimeout(t);
  }, [navigation, next]);

  return (
    <View style={styles.root}>
      <Video
        ref={ref}
        source={require('../../../assets/smart_home_splash.mp4')}
        resizeMode={ResizeMode.CONTAIN}
        style={styles.video}
        shouldPlay
        // ✅ חשוב לווב: לאפשר autoplay
        isMuted
        volume={0}
        // ✅ תן עדכונים קצת יותר צפופים
        progressUpdateIntervalMillis={100}
        onLoad={() => {
          // ✅ בחלק מהמקרים shouldPlay לא מפעיל בפועל
          ref.current?.playAsync().catch(() => {
            /* empty */
          });
        }}
        onPlaybackStatusUpdate={(s: AVPlaybackStatus) => {
          if (!s.isLoaded) return;
          if (s.didJustFinish) navigation.replace(next);
        }}
        onError={(e) => {
          console.log('Splash video error', e);
          navigation.replace(next);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070A12', alignItems: 'center', justifyContent: 'center' },
  video: { width: 360, height: 360 },
});
