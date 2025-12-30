import * as React from 'react';
import { View, StyleSheet, ViewStyle, LayoutChangeEvent, Animated, Easing } from 'react-native';
import { AccessibilityInfo } from 'react-native';

export function ShimmerBlock({
  style,
  baseColor = '#0F172A',
  highlightColor = 'rgba(255,255,255,0.06)',
  durationMs = 1200,
}: {
  style?: ViewStyle;
  baseColor?: string;
  highlightColor?: string;
  durationMs?: number;
}) {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const widthRef = React.useRef(200);
  const [ready, setReady] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width;
      if (w > 0 && w !== widthRef.current) {
        widthRef.current = w;
        setReady(true);
      } else if (w > 0 && !ready) {
        setReady(true);
      }
    },
    [ready],
  );

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((v) => {
      if (alive) setReduceMotion(!!v);
    });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!ready || reduceMotion) return;

    translateX.setValue(-widthRef.current);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: widthRef.current,
        duration: durationMs,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );

    anim.start();
    return () => anim.stop();
  }, [ready, durationMs, translateX, reduceMotion]);

  const shimmerWidth = Math.max(60, Math.floor(widthRef.current * 0.35));

  return (
    <View onLayout={onLayout} style={[styles.base, { backgroundColor: baseColor }, style]}>
      {/* highlight */}
      {ready && !reduceMotion ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              width: shimmerWidth,
              backgroundColor: highlightColor,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 12,
  },
});
