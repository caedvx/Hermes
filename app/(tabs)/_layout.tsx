import { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Image, Platform, Animated, Easing, Dimensions, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/auth';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const { width: W } = Dimensions.get('window');

const ICON_MAP: Record<string, [string, string, number]> = {
  index:      ['home',            'home-outline',     23],
  record:     ['radio-button-on', 'radio-button-off', 24],
  activities: ['list',            'list-outline',     23],
  social:     ['people',          'people-outline',   23],
  heatmap:    ['flame',           'flame-outline',    23],
  profile:    ['person',          'person-outline',   23],
};

const TAB_COUNT   = 6;
const BAR_MARGIN  = 18;   // screen edge → bar edge
const BAR_H       = 58;   // outer bar height
const BAR_PADDING = 6;    // inner horizontal padding
const PILL_INSET  = 4;    // each side: how much narrower the pill is vs. a tab slot
const PILL_V      = 5;    // vertical inset from bar edge

// Pre-compute sizes from screen width so no onLayout needed
const BAR_INNER_W = W - BAR_MARGIN * 2 - BAR_PADDING * 2;
const TAB_W       = BAR_INNER_W / TAB_COUNT;
const PILL_W      = PILL_H; // circle: width === height
const PILL_H      = BAR_H - PILL_V * 2;

function GlassTabBar({ state, navigation }: BottomTabBarProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  // Sliding pill — spring animation, native driver
  const slideAnim = useRef(new Animated.Value(state.index)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: state.index,
      tension: 72,
      friction: 13,
      useNativeDriver: true,
    }).start();
  }, [state.index]);

  // translateX: pill starts at BAR_PADDING + index * TAB_W + PILL_INSET
  const translateX = slideAnim.interpolate({
    inputRange:  state.routes.map((_, i) => i),
    // Centre the circle within each tab slot
    outputRange: state.routes.map((_, i) => BAR_PADDING + i * TAB_W + (TAB_W - PILL_W) / 2),
  });

  const bottomOffset = Math.max(insets.bottom, 8) + 10;

  return (
    <View
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 0 }}
      pointerEvents="box-none"
    >
      <View
        style={{ position: 'absolute', bottom: bottomOffset, left: BAR_MARGIN, right: BAR_MARGIN }}
        pointerEvents="box-none"
      >
        {/* ── Outer bar shadow (iOS only — Android elevation below) ── */}
        <View style={[styles.shadowWrap, Platform.OS !== 'ios' && { shadowOpacity: 0 }]}>

          {/* ── 1px gradient border ring ── */}
          <LinearGradient
            colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.06)', 'rgba(0,188,212,0.18)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.borderRing}
          >
            {/* ── Glass body ── */}
            {Platform.OS === 'ios' ? (
              <BlurView intensity={60} tint="dark" style={styles.glassBody}>
                <BarContent
                  state={state} navigation={navigation}
                  profile={profile} C={C}
                  translateX={translateX}
                />
              </BlurView>
            ) : (
              <View style={[styles.glassBody, styles.androidBody, { elevation: 20 }]}>
                <BarContent
                  state={state} navigation={navigation}
                  profile={profile} C={C}
                  translateX={translateX}
                />
              </View>
            )}
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

function BarContent({
  state, navigation, profile, C, translateX,
}: {
  state: BottomTabBarProps['state'];
  navigation: BottomTabBarProps['navigation'];
  profile: any;
  C: ReturnType<typeof useColors>;
  translateX: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <View style={styles.row}>
      {/* ── Sliding glass bubble ── */}
      <Animated.View
        style={[styles.pill, { transform: [{ translateX }] }]}
        pointerEvents="none"
      >
        {/* Outer gradient border ring */}
        <LinearGradient
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.pillBorder}
        >
          {/* Glass body — bright fill with specular gradient */}
          <LinearGradient
            colors={['rgba(255,255,255,0.42)', 'rgba(255,255,255,0.16)', 'rgba(255,255,255,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.pillInner}
          >
            {/* Top specular rim via RadialGradient */}
            <View style={styles.pillRimWrap} pointerEvents="none">
              <Svg width="100%" height="2">
                <Defs>
                  <RadialGradient id="pr" cx="50%" cy="0%" r="60%" fx="50%" fy="0%">
                    <Stop offset="0%"   stopColor="#FFFFFF" stopOpacity={0.95} />
                    <Stop offset="50%"  stopColor="#FFFFFF" stopOpacity={0.50} />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="2" fill="url(#pr)" />
              </Svg>
            </View>
          </LinearGradient>
        </LinearGradient>
      </Animated.View>

      {/* ── Tab icons ── */}
      {state.routes.map((route, index) => {
        const focused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        const [activeIcon, inactiveIcon, iconSize] = ICON_MAP[route.name] ?? ['ellipse', 'ellipse-outline', 23];

        const icon = route.name === 'profile' && profile?.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={{
              width: 24, height: 24, borderRadius: 12,
              borderWidth: focused ? 1.5 : 0,
              borderColor: focused ? '#fff' : 'transparent',
              opacity: focused ? 1 : 0.38,
            }}
          />
        ) : (
          <Ionicons
            name={(focused ? activeIcon : inactiveIcon) as never}
            size={iconSize}
            color={focused ? '#ffffff' : 'rgba(255,255,255,0.32)'}
          />
        );

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            activeOpacity={0.7}
          >
            {icon}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: BAR_H / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
  },
  borderRing: {
    borderRadius: BAR_H / 2,
    padding: 1,
  },
  glassBody: {
    borderRadius: (BAR_H - 2) / 2,
    height: BAR_H - 2,
    overflow: 'hidden',
    // very subtle tint — the bar should be nearly transparent like the reference
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  androidBody: {
    backgroundColor: 'rgba(8,20,28,0.90)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    paddingHorizontal: BAR_PADDING,
  },
  tab: {
    width: TAB_W,
    height: BAR_H - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pill is absolutely positioned, driven by translateX animation
  pill: {
    position: 'absolute',
    top: PILL_V,
    left: 0,   // translateX handles horizontal position
    width: PILL_W,
    height: PILL_H,
  },
  pillBorder: {
    flex: 1,
    borderRadius: PILL_H / 2,
    padding: 1,
  },
  pillInner: {
    flex: 1,
    borderRadius: (PILL_H - 2) / 2,
    overflow: 'hidden',
  },
  pillRimWrap: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 2,
  },
});

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 },
      }}
    >
      <Tabs.Screen name="index"      options={{ title: 'Feed' }} />
      <Tabs.Screen name="record"     options={{ title: 'Record' }} />
      <Tabs.Screen name="activities" options={{ title: 'Activities' }} />
      <Tabs.Screen name="social"     options={{ title: 'Social' }} />
      <Tabs.Screen name="heatmap"    options={{ title: 'Heatmap' }} />
      <Tabs.Screen name="profile"    options={{ title: 'Profile' }} />
    </Tabs>
  );
}
