import { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Image, Switch, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import type { Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/theme';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance, formatDuration, sportIoniconName } from '@/lib/utils';
import { GlassCard } from '@/components/GlassCard';
import { AuroraBackground } from '@/components/AuroraBackground';
import { PillButton } from '@/components/PillButton';

interface ProfileStats {
  totalActivities: number; totalDistance: number;
  totalTime: number; totalElevation: number;
  followers: number; following: number;
}

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const C = useColors();
  const { isDark, setMode } = useTheme();

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('activities').select('distance, elapsed_time, elevation_gain').eq('user_id', user.id),
      supabase.from('activities').select('id, title, sport_type, distance, elapsed_time, start_at').eq('user_id', user.id).order('start_at', { ascending: false }).limit(5),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
    ]).then(([actsRes, recentRes, followersRes, followingRes]) => {
      type S = { distance: number; elapsed_time: number; elevation_gain: number | null };
      const acts = (actsRes.data as S[] | null) ?? [];
      setStats({
        totalActivities: acts.length,
        totalDistance: acts.reduce((s, a) => s + (a.distance ?? 0), 0),
        totalTime: acts.reduce((s, a) => s + (a.elapsed_time ?? 0), 0),
        totalElevation: acts.reduce((s, a) => s + (a.elevation_gain ?? 0), 0),
        followers: followersRes.data?.length ?? 0,
        following: followingRes.data?.length ?? 0,
      });
      setRecentActivities((recentRes.data as Activity[]) ?? []);
    }).finally(() => setLoading(false));
  }, [user]);

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]?.base64) await uploadAvatar(result.assets[0].base64);
  }

  async function uploadAvatar(base64: string) {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const filePath = `${user.id}/avatar.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(filePath, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', user.id);
      await refreshProfile();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally { setUploadingAvatar(false); }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#030A0C' }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030A0C' }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Header with aurora */}
        <View style={{ overflow: 'hidden', paddingTop: 32, paddingBottom: 28, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)' }}>
          <AuroraBackground />
          <TouchableOpacity onPress={handlePickImage} disabled={uploadingAvatar} style={{ alignItems: 'center', marginBottom: 16 }}>
            {uploadingAvatar ? (
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,188,212,0.12)', borderWidth: 1, borderColor: 'rgba(0,188,212,0.35)', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} />
              </View>
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: 'rgba(0,188,212,0.35)' }} />
            ) : (
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,188,212,0.10)', borderWidth: 1, borderColor: 'rgba(0,188,212,0.35)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: C.primary, fontSize: 30, fontWeight: '500' }}>
                  {(profile?.username?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={{ color: C.primary, fontSize: 11, marginTop: 6, opacity: 0.7 }}>Edit photo</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 17, fontWeight: '500', color: C.text, letterSpacing: -0.3 }}>@{profile?.username ?? 'athlete'}</Text>
          {profile?.full_name && <Text style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{profile.full_name}</Text>}
          {profile?.bio && <Text style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', marginTop: 4, paddingHorizontal: 32 }}>{profile.bio}</Text>}
          {(profile?.city || profile?.country) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={11} color={C.textMuted} />
              <Text style={{ fontSize: 11, color: C.textMuted }}>{[profile.city, profile.country].filter(Boolean).join(', ')}</Text>
            </View>
          )}
        </View>

        {/* Follow counts */}
        <View style={{ flexDirection: 'row', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)' }}>
          {[
            { value: stats?.followers ?? 0, label: 'Followers' },
            { value: stats?.following ?? 0, label: 'Following' },
            { value: stats?.totalActivities ?? 0, label: 'Activities' },
          ].map((item, i, arr) => (
            <View key={item.label} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < arr.length - 1 ? 1 : 0, borderRightColor: 'rgba(0,188,212,0.12)' }}>
              <Text style={{ fontSize: 22, fontWeight: '500', color: C.text, letterSpacing: -0.5 }}>{item.value}</Text>
              <Text style={{ fontSize: 10, color: C.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 }}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Stats grid */}
        {stats && (
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: '500', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>ALL-TIME STATS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                { label: 'Distance', value: formatDistance(stats.totalDistance), accent: false },
                { label: 'Time', value: formatDuration(stats.totalTime), accent: false },
                { label: 'Elevation', value: `${Math.round(stats.totalElevation)} m`, accent: true },
                { label: 'Activities', value: String(stats.totalActivities), accent: false },
              ].map(({ label, value, accent }) => (
                <GlassCard key={label} variant={accent ? 'violet' : 'cyan'} style={{ width: '48%' }} padding={14}>
                  <Text style={{ fontSize: 20, fontWeight: '500', color: accent ? C.secondary : C.primary, letterSpacing: -0.5, marginBottom: 4 }}>{value}</Text>
                  <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
                </GlassCard>
              ))}
            </View>
          </View>
        )}

        {/* Recent activities */}
        {recentActivities.length > 0 && (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: '500', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>RECENT</Text>
            <GlassCard padding={0}>
              {recentActivities.map((act, i) => (
                <View key={act.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: 'rgba(0,188,212,0.10)' }}>
                  <Ionicons name={sportIoniconName(act.sport_type) as never} size={18} color={C.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: C.text, letterSpacing: -0.2 }} numberOfLines={1}>{act.title}</Text>
                    <Text style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>
                      {formatDistance(act.distance)} · {formatDuration(act.elapsed_time)}
                    </Text>
                  </View>
                </View>
              ))}
            </GlassCard>
          </View>
        )}

        {/* Settings */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <Text style={{ fontSize: 10, fontWeight: '500', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>SETTINGS</Text>
          <GlassCard padding={16}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: C.text, fontWeight: '400' }}>Dark Mode</Text>
              <Switch value={isDark} onValueChange={(v) => setMode(v ? 'dark' : 'light')} trackColor={{ false: 'rgba(0,188,212,0.15)', true: 'rgba(0,188,212,0.35)' }} thumbColor={isDark ? C.primary : C.textMuted} />
            </View>
          </GlassCard>
        </View>

        {/* Footer actions */}
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://caedvx.github.io/Hermes-Privacy-Policy/')}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10 }}
          >
            <Ionicons name="shield-checkmark-outline" size={13} color={C.textMuted} />
            <Text style={{ color: C.textMuted, fontSize: 12 }}>Privacy Policy</Text>
          </TouchableOpacity>
          <PillButton label="Sign Out" onPress={() => Alert.alert('Sign Out', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign Out', style: 'destructive', onPress: signOut }])} variant="danger" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
