import { useEffect, useRef } from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator,
  View, Animated, Easing, StyleSheet, ViewStyle, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  style?: ViewStyle;
  glow?: boolean;
}

export function PillButton({
  label, onPress, loading, disabled, variant = 'primary', style, glow = false,
}: PillButtonProps) {
  const glowOpacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (!glow) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.28, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [glow]);

  const isDisabled = disabled || loading;

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress} disabled={isDisabled} activeOpacity={0.75}
        style={[styles.pill, styles.outline, isDisabled && styles.disabled, style]}
      >
        {loading
          ? <ActivityIndicator size="small" color="rgba(0,188,212,0.6)" />
          : <Text style={styles.outlineText}>{label}</Text>}
      </TouchableOpacity>
    );
  }

  if (variant === 'danger') {
    return (
      <TouchableOpacity
        onPress={onPress} disabled={isDisabled} activeOpacity={0.75}
        style={[styles.pill, styles.dangerPill, isDisabled && styles.disabled, style]}
      >
        {loading
          ? <ActivityIndicator size="small" color="#FF453A" />
          : <Text style={styles.dangerText}>{label}</Text>}
      </TouchableOpacity>
    );
  }

  // ── Primary pill ──────────────────────────────────────────────────────────
  return (
    <View style={[styles.wrapper, isDisabled && styles.disabled, style]}>

      {/* Radial glow ring — SVG RadialGradient so it fades to transparent
          at the edges rather than having a hard circle boundary */}
      {glow && (
        <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id="btnGlow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%"   stopColor="#00BCD4" stopOpacity={0.55} />
                <Stop offset="45%"  stopColor="#00BCD4" stopOpacity={0.22} />
                <Stop offset="100%" stopColor="#00BCD4" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            {/* rx matches glowRing borderRadius so it mirrors the pill shape */}
            <Rect x="0" y="0" width="100%" height="100%" rx={58} ry={58} fill="url(#btnGlow)" />
          </Svg>
        </Animated.View>
      )}

      {/* 1px gradient border ring */}
      <LinearGradient
        colors={['rgba(0,221,235,0.55)', 'rgba(0,188,212,0.18)', 'rgba(156,136,184,0.30)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <TouchableOpacity
          onPress={onPress}
          disabled={isDisabled}
          activeOpacity={0.82}
          style={styles.innerPill}
        >
          {/* Glass fill */}
          {Platform.OS === 'ios' ? (
            <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.androidFill]} />
          )}

          {/* Specular sweep */}
          <LinearGradient
            colors={['rgba(255,255,255,0.38)', 'rgba(255,255,255,0.00)', 'rgba(0,188,212,0.12)']}
            locations={[0, 0.38, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Top specular rim — RadialGradient centred on the button so it
              fades from bright white in the middle to transparent at both ends,
              like a single light source directly overhead */}
          <View style={styles.topRimWrapper} pointerEvents="none">
            <Svg width="100%" height="2">
              <Defs>
                <RadialGradient id="rimGrad" cx="50%" cy="0%" r="60%" fx="50%" fy="0%">
                  <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity={0.72} />
                  <Stop offset="55%"  stopColor="#FFFFFF" stopOpacity={0.25} />
                  <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="2" fill="url(#rimGrad)" />
            </Svg>
          </View>

          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.primaryText}>{label}</Text>}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  gradientBorder: {
    borderRadius: 50,
    padding: 1,
  },
  innerPill: {
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,188,212,0.22)',
    minHeight: 52,
  },
  androidFill: {
    backgroundColor: 'rgba(0,55,70,0.96)',
    borderRadius: 50,
  },
  topRimWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  outline: {
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,188,212,0.32)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineText: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 13,
    fontWeight: '400',
  },
  dangerPill: {
    borderRadius: 50,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#FF453A',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '500',
  },
  disabled: { opacity: 0.45 },
  pill: {},
  glowRing: {
    position: 'absolute',
    top: -10, left: -10, right: -10, bottom: -10,
    borderRadius: 60,
  },
});
