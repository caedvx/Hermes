import React from 'react';
import { View, Platform, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

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

// Border gradient colors — 1px gradient ring, never a flat line
const BORDER: Record<GlassVariant, readonly [string, string, string]> = {
  cyan:   ['rgba(0,188,212,0.32)', 'rgba(0,188,212,0.04)', 'rgba(206,147,216,0.14)'],
  violet: ['rgba(206,147,216,0.28)', 'rgba(206,147,216,0.04)', 'rgba(0,188,212,0.10)'],
};
// Card tint
const TINT: Record<GlassVariant, string> = {
  cyan:   'rgba(0,188,212,0.07)',
  violet: 'rgba(206,147,216,0.07)',
};
// Android solid bg (no blur support over native surfaces)
const ANDROID_BG: Record<GlassVariant, string> = {
  cyan:   'rgba(4,12,18,0.96)',
  violet: 'rgba(8,4,14,0.96)',
};

export function GlassCard({
  children,
  variant = 'cyan',
  style,
  innerStyle,
  padding = 14,
  radius = 20,
  blur = 28,
}: GlassCardProps) {
  const content = (
    <View style={{ padding, ...innerStyle as object }}>
      {children}
    </View>
  );

  const decorators = (
    <>
      {/* Specular sweep — diagonal white-to-transparent highlight, top-left corner */}
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)', 'rgba(0,188,212,0.06)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius - 1 }}
        pointerEvents="none"
      />
      {/* Top rim — catches light */}
      <View style={{
        position: 'absolute', top: 0, left: 8, right: 8, height: 1,
        backgroundColor: 'rgba(255,255,255,0.30)', borderRadius: 1,
      }} pointerEvents="none" />
      {/* Bottom rim — ground shadow */}
      <View style={{
        position: 'absolute', bottom: 0, left: 8, right: 8, height: 1,
        backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 1,
      }} pointerEvents="none" />
    </>
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
          style={{ borderRadius: radius - 1, backgroundColor: TINT[variant], overflow: 'hidden' }}
        >
          {decorators}
          {content}
        </BlurView>
      ) : (
        <View style={{ borderRadius: radius - 1, backgroundColor: ANDROID_BG[variant], overflow: 'hidden' }}>
          {decorators}
          {content}
        </View>
      )}
    </LinearGradient>
  );
}
