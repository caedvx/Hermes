import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

// Smooth pendulum animation using two alternating Animated.timing calls
function pendulum(val: Animated.Value, a: number, b: number, dur: number): Animated.CompositeAnimation {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(val, { toValue: b, duration: dur * 0.55, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(val, { toValue: a, duration: dur * 0.45, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])
  );
}

export function AuroraBackground() {
  const cx = useRef(new Animated.Value(0)).current;
  const cy = useRef(new Animated.Value(0)).current;
  const vx = useRef(new Animated.Value(0)).current;
  const vy = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anims = [
      pendulum(cx, -W * 0.12, W * 0.12, 11000),
      pendulum(cy, -H * 0.08, H * 0.10, 9500),
      pendulum(vx,  W * 0.10, -W * 0.08, 8000),
      pendulum(vy, -H * 0.12, H * 0.08, 10500),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Void gradient base */}
      <View style={styles.bg} />
      {/* Cyan aurora orb — upper-left area */}
      <Animated.View
        style={[styles.orb, styles.cyanOrb, { transform: [{ translateX: cx }, { translateY: cy }] }]}
      />
      {/* Violet aurora orb — lower-right area */}
      <Animated.View
        style={[styles.orb, styles.violetOrb, { transform: [{ translateX: vx }, { translateY: vy }] }]}
      />
    </View>
  );
}

const ORB = W * 1.4;

const styles = StyleSheet.create({
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#030A0C',
  },
  orb: {
    position: 'absolute',
    width: ORB,
    height: ORB,
    borderRadius: ORB / 2,
  },
  cyanOrb: {
    top: -ORB * 0.25,
    left: -ORB * 0.35,
    backgroundColor: 'rgba(0,188,212,0.14)',
  },
  violetOrb: {
    bottom: -ORB * 0.20,
    right: -ORB * 0.30,
    backgroundColor: 'rgba(156,136,184,0.11)',
  },
});
