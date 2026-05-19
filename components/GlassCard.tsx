import React from 'react';
import { View, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

export type GlassVariant = 'cyan' | 'violet';

interface GlassCardProps {
  children: React.ReactNode;
  variant?: GlassVariant;
  style?: ViewStyle;
  innerStyle?: ViewStyle;
  padding?: number;
  radius?: number;
  blur?: number;
}

// Border gradient — stronger so it's clearly visible against the void background
const BORDER: Record<GlassVariant, readonly [string, string, string]> = {
  cyan:   ['rgba(0,188,212,0.55)', 'rgba(0,188,212,0.18)', 'rgba(206,147,216,0.22)'],
  violet: ['rgba(206,147,216,0.50)', 'rgba(206,147,216,0.16)', 'rgba(0,188,212,0.18)'],
};

// iOS blur tint
const TINT: Record<GlassVariant, string> = {
  cyan:   'rgba(0,188,212,0.08)',
  violet: 'rgba(206,147,216,0.08)',
};

// Android: simulate the blurred aurora behind the card with a dark-teal body.
// These are tuned to look close to blur(32px) over the #030A0C + aurora orbs.
const ANDROID_BG: Record<GlassVariant, string> = {
  cyan:   'rgba(0,52,68,0.88)',
  violet: 'rgba(22,8,42,0.88)',
};

// Specular sweep — diagonal highlight matching reference
const SPECULAR: Record<GlassVariant, readonly [string, string, string]> = {
  cyan:   ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)', 'rgba(0,188,212,0.07)'],
  violet: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.00)', 'rgba(206,147,216,0.07)'],
};

export function GlassCard({
  children,
  variant = 'cyan',
  style,
  innerStyle,
  padding = 14,
  radius = 20,
  blur = 32,
}: GlassCardProps) {
  const r = radius - 1;

  const decorators = (
    <>
      {/* Specular sweep — diagonal highlight top-left → transparent → tint bottom-right */}
      <LinearGradient
        colors={SPECULAR[variant]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: r }}
        pointerEvents="none"
      />

      {/* Top rim — RadialGradient so it's bright in the centre and fades at both ends */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1.5 }} pointerEvents="none">
        <Svg width="100%" height="1.5">
          <Defs>
            <RadialGradient id={`rim_${variant}`} cx="50%" cy="0%" r="60%" fx="50%" fy="0%">
              <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity={0.38} />
              <Stop offset="50%"  stopColor="#FFFFFF" stopOpacity={0.14} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="1.5" fill={`url(#rim_${variant})`} />
        </Svg>
      </View>

      {/* Bottom rim */}
      <View style={{
        position: 'absolute', bottom: 0, left: 8, right: 8, height: 1,
        backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 1,
      }} pointerEvents="none" />
    </>
  );

  const inner = (
    <View style={[{ padding }, innerStyle]}>
      {children}
    </View>
  );

  return (
    <LinearGradient
      colors={BORDER[variant]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radius, padding: 1 }, style]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={blur}
          tint="dark"
          style={{ borderRadius: r, backgroundColor: TINT[variant], overflow: 'hidden' }}
        >
          {decorators}
          {inner}
        </BlurView>
      ) : (
        <View style={{ borderRadius: r, backgroundColor: ANDROID_BG[variant], overflow: 'hidden' }}>
          {decorators}
          {inner}
        </View>
      )}
    </LinearGradient>
  );
}
