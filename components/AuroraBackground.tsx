import { useEffect, useRef } from 'react';
import { View, Animated, Easing, StyleSheet, Dimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

const { width: W, height: H } = Dimensions.get('window');

// Build a perfectly smooth sine/cosine curve over N steps.
// Using integer multiples of 2π guarantees continuity at the loop boundary —
// sin(n·2π) == sin(0), so there is no jump when the animation restarts.
const N = 80;
const STEPS = Array.from({ length: N + 1 }, (_, i) => i / N);

function sinCurve(freq: number, amp: number, phase = 0): number[] {
  return STEPS.map(s => Math.sin(s * 2 * Math.PI * freq + phase) * amp);
}
function cosCurve(freq: number, amp: number, phase = 0): number[] {
  return STEPS.map(s => Math.cos(s * 2 * Math.PI * freq + phase) * amp);
}

function RadialOrb({
  color, w, h, inner, mid,
}: { color: string; w: number; h: number; inner: number; mid: number }) {
  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <RadialGradient id={`orb-${color.replace('#','')}`} cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor={color} stopOpacity={inner} />
          <Stop offset="50%"  stopColor={color} stopOpacity={mid} />
          <Stop offset="100%" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={w/2} cy={h/2} rx={w/2} ry={h/2}
        fill={`url(#orb-${color.replace('#','')})`} />
    </Svg>
  );
}

export function AuroraBackground() {
  // One shared linear time value 0→1. All curves are derived from this
  // single loop so they stay perfectly in sync and never jump.
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Cyan orb — freq 1 on X, freq 2 on Y → smooth figure-eight-ish path
  const cyanX = t.interpolate({ inputRange: STEPS, outputRange: sinCurve(1, W * 0.10) });
  const cyanY = t.interpolate({ inputRange: STEPS, outputRange: cosCurve(2, H * 0.07) });

  // Violet orb — opposite phase on X (π offset), freq 3 on Y → independent motion
  const violetX = t.interpolate({ inputRange: STEPS, outputRange: sinCurve(1, W * 0.09, Math.PI) });
  const violetY = t.interpolate({ inputRange: STEPS, outputRange: sinCurve(3, H * 0.05) });

  const cW = W * 1.4, cH = H * 0.70;
  const vW = W * 1.1, vH = H * 0.50;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#030A0C' }]} />
      <Animated.View style={[styles.orb, { top: -cH * 0.28, left: -cW * 0.32, width: cW, height: cH },
        { transform: [{ translateX: cyanX }, { translateY: cyanY }] }]}>
        <RadialOrb color="#00BCD4" w={cW} h={cH} inner={0.20} mid={0.07} />
      </Animated.View>
      <Animated.View style={[styles.orb, { bottom: -vH * 0.22, right: -vW * 0.28, width: vW, height: vH },
        { transform: [{ translateX: violetX }, { translateY: violetY }] }]}>
        <RadialOrb color="#9C88B8" w={vW} h={vH} inner={0.16} mid={0.05} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  orb: { position: 'absolute', overflow: 'hidden' },
});
