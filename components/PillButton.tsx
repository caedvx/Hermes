import { useEffect, useRef } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View, Animated, Easing, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface PillButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
  style?: ViewStyle;
  glow?: boolean; // heartbeat glow animation
}

export function PillButton({
  label, onPress, loading, disabled, variant = 'primary', style, glow = false,
}: PillButtonProps) {
  const glowOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!glow) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.3, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [glow]);

  const isDisabled = disabled || loading;

  if (variant === 'outline') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.75}
        style={[styles.pill, styles.outline, isDisabled && styles.disabled, style]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
        ) : (
          <Text style={styles.outlineText}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  }

  if (variant === 'danger') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.75}
        style={[styles.pill, styles.dangerPill, isDisabled && styles.disabled, style]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.dangerText}>{label}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[{ position: 'relative' }, style]}>
      {glow && (
        // Heartbeat glow ring — animates opacity, runs on native thread
        <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />
      )}
      <LinearGradient
        colors={['rgba(0,221,235,0.45)', 'rgba(0,188,212,0.15)', 'rgba(156,136,184,0.22)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <TouchableOpacity
          onPress={onPress}
          disabled={isDisabled}
          activeOpacity={0.8}
          style={[styles.pill, styles.primary, isDisabled && styles.disabled]}
        >
          {/* Top specular highlight */}
          <View style={styles.specular} pointerEvents="none" />
          {loading ? (
            <ActivityIndicator size="small" color="#030A0C" />
          ) : (
            <Text style={styles.primaryText}>{label}</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 50,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientBorder: {
    borderRadius: 50,
    padding: 1,
  },
  primary: {
    backgroundColor: 'rgba(0,188,212,0.18)',
    borderRadius: 50,
  },
  primaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  outline: {
    borderWidth: 1,
    borderColor: 'rgba(0,188,212,0.30)',
    backgroundColor: 'transparent',
  },
  outlineText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '400',
  },
  dangerPill: {
    borderWidth: 1,
    borderColor: '#FF453A',
    backgroundColor: 'transparent',
  },
  dangerText: {
    color: '#FF453A',
    fontSize: 14,
    fontWeight: '500',
  },
  disabled: { opacity: 0.45 },
  specular: {
    position: 'absolute',
    top: 0, left: 10, right: 10, height: 1,
    backgroundColor: 'rgba(255,255,255,0.50)',
    borderRadius: 1,
  },
  glowRing: {
    position: 'absolute',
    top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 56,
    backgroundColor: 'rgba(0,188,212,0.28)',
  },
});
