import { View, TouchableOpacity, Image, useColorScheme, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/auth';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ICON_MAP: Record<string, [string, string, number]> = {
  index:      ['home',            'home-outline',     24],
  record:     ['radio-button-on', 'radio-button-off', 26],
  activities: ['list',            'list-outline',     24],
  social:     ['people',          'people-outline',   24],
  heatmap:    ['flame',           'flame-outline',    24],
  profile:    ['person',          'person-outline',   24],
};

function TabItems({ state, navigation, isDark, C, profile }: {
  state: BottomTabBarProps['state'];
  navigation: BottomTabBarProps['navigation'];
  isDark: boolean;
  C: ReturnType<typeof useColors>;
  profile: any;
}) {
  return (
    <>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const iconColor = focused
          ? C.primary
          : isDark ? 'rgba(255,255,255,0.36)' : 'rgba(0,0,0,0.32)';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        const [activeIcon, inactiveIcon, iconSize] = ICON_MAP[route.name] ?? ['ellipse', 'ellipse-outline', 24];

        const icon =
          route.name === 'profile' && profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{
              width: 26, height: 26, borderRadius: 13,
              borderWidth: focused ? 2 : 0,
              borderColor: C.primary,
              opacity: focused ? 1 : 0.38,
            }} />
          ) : (
            <Ionicons name={(focused ? activeIcon : inactiveIcon) as never} size={iconSize} color={iconColor} />
          );

        return (
          <TouchableOpacity
            key={route.key}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
            onPress={onPress}
            activeOpacity={0.65}
          >
            {focused && (
              <View style={{
                position: 'absolute',
                width: 52, height: 46, borderRadius: 14,
                backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.55)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.80)',
                overflow: 'hidden',
              }}>
                <View style={{
                  position: 'absolute', top: 0, left: 6, right: 6, height: 1,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.90)',
                  borderRadius: 1,
                }} />
              </View>
            )}
            {icon}
          </TouchableOpacity>
        );
      })}
    </>
  );
}

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const isDark = useColorScheme() === 'dark';

  const barBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.65)';
  const bottomOffset = Math.max(insets.bottom, 8) + 10;

  const items = <TabItems state={state} navigation={navigation} isDark={isDark} C={C} profile={profile} />;

  return (
    <View
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 0 }}
      pointerEvents="box-none"
    >
      <View
        style={{ position: 'absolute', bottom: bottomOffset, left: 18, right: 18 }}
        pointerEvents="box-none"
      >
        {Platform.OS === 'ios' ? (
          // iOS: real blur via BlurView
          <View style={{
            borderRadius: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.5 : 0.13,
            shadowRadius: 28,
          }}>
            <View style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: barBorder }}>
              <BlurView
                intensity={isDark ? 78 : 65}
                tint={isDark ? 'dark' : 'light'}
                style={{ height: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}
              >
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: isDark ? 'rgba(8,8,10,0.35)' : 'rgba(255,255,255,0.25)',
                }} />
                {items}
              </BlurView>
            </View>
          </View>
        ) : (
          // Android: solid dark bg — BlurView can't composite over MapLibre's GPU surface
          <View style={{
            borderRadius: 24,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: barBorder,
            elevation: 18,
            backgroundColor: isDark ? 'rgba(18,18,20,0.97)' : 'rgba(244,244,246,0.97)',
          }}>
            <View style={{ height: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 }}>
              {items}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

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
