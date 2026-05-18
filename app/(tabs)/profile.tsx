import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import type { Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/contexts/theme';
import type { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance, formatDuration, sportIoniconName } from '@/lib/utils';

interface ProfileStats {
  totalActivities: number;
  totalDistance: number;
  totalTime: number;
  totalElevation: number;
  followers: number;
  following: number;
}

export default function ProfileScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const C = useColors();
  const { isDark, setMode } = useTheme();
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from('activities').select('distance, elapsed_time, elevation_gain, sport_type').eq('user_id', user.id),
      supabase.from('activities').select('id, title, sport_type, distance, elapsed_time, start_at').eq('user_id', user.id).order('start_at', { ascending: false }).limit(5),
      supabase.from('follows').select('follower_id').eq('following_id', user.id),
      supabase.from('follows').select('following_id').eq('follower_id', user.id),
    ]).then(([activitiesRes, recentRes, followersRes, followingRes]) => {
      type ActivitySummary = { distance: number; elapsed_time: number; elevation_gain: number | null };
      const acts = (activitiesRes.data as ActivitySummary[] | null) ?? [];
      setStats({
        totalActivities: acts.length,
        totalDistance: acts.reduce((sum, a) => sum + (a.distance ?? 0), 0),
        totalTime: acts.reduce((sum, a) => sum + (a.elapsed_time ?? 0), 0),
        totalElevation: acts.reduce((sum, a) => sum + (a.elevation_gain ?? 0), 0),
        followers: followersRes.data?.length ?? 0,
        following: followingRes.data?.length ?? 0,
      });
      setRecentActivities((recentRes.data as Activity[]) ?? []);
    }).finally(() => setLoading(false));
  }, [user]);

  async function handlePickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      await uploadAvatar(result.assets[0].base64);
    }
  }

  async function uploadAvatar(base64: string) {
    if (!user) return;
    setUploadingAvatar(true);
    try {
      // atob + Uint8Array avoids fetch(file://) which fails in RN
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const filePath = `${user.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, bytes, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await supabase.from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user.id);

      await refreshProfile();
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setUploadingAvatar(false);
    }
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={handlePickImage} disabled={uploadingAvatar} style={styles.avatarWrapper}>
            {uploadingAvatar ? (
              <View style={styles.avatar}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.username?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraLabel}>
              <Text style={styles.cameraLabelText}>Edit</Text>
            </View>
          </TouchableOpacity>

          <Text style={styles.username}>@{profile?.username ?? 'athlete'}</Text>
          {profile?.full_name && (
            <Text style={styles.fullName}>{profile.full_name}</Text>
          )}
          {profile?.bio && (
            <Text style={styles.bio}>{profile.bio}</Text>
          )}
          {(profile?.city || profile?.country) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={13} color={C.textMuted} />
              <Text style={styles.location}>
                {[profile.city, profile.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.followRow}>
          <View style={styles.followItem}>
            <Text style={styles.followCount}>{stats?.followers ?? 0}</Text>
            <Text style={styles.followLabel}>Followers</Text>
          </View>
          <View style={styles.followDivider} />
          <View style={styles.followItem}>
            <Text style={styles.followCount}>{stats?.following ?? 0}</Text>
            <Text style={styles.followLabel}>Following</Text>
          </View>
          <View style={styles.followDivider} />
          <View style={styles.followItem}>
            <Text style={styles.followCount}>{stats?.totalActivities ?? 0}</Text>
            <Text style={styles.followLabel}>Activities</Text>
          </View>
        </View>

        {stats && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>All-Time Stats</Text>
            <View style={styles.statsGrid}>
              <StatTile label="Total Distance" value={formatDistance(stats.totalDistance)} />
              <StatTile label="Total Time" value={formatDuration(stats.totalTime)} />
              <StatTile label="Total Elevation" value={`${Math.round(stats.totalElevation)} m`} />
              <StatTile label="Activities" value={String(stats.totalActivities)} />
            </View>
          </View>
        )}

        {recentActivities.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            {recentActivities.map((act) => (
              <View key={act.id} style={styles.recentRow}>
                <Ionicons name={sportIoniconName(act.sport_type) as never} size={22} color={C.textSecondary} />
                <View style={styles.recentBody}>
                  <Text style={styles.recentTitle} numberOfLines={1}>{act.title}</Text>
                  <Text style={styles.recentStats}>
                    {formatDistance(act.distance)} · {formatDuration(act.elapsed_time)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.appearanceRow}>
          <Text style={styles.appearanceLabel}>Dark Mode</Text>
          <Switch
            value={isDark}
            onValueChange={(val) => setMode(val ? 'dark' : 'light')}
            trackColor={{ false: C.border, true: C.primary }}
            thumbColor="#ffffff"
          />
        </View>

        <TouchableOpacity
          style={styles.privacyButton}
          onPress={() => Linking.openURL('https://caedvx.github.io/Hermes-Privacy-Policy/')}
        >
          <Ionicons name="shield-checkmark-outline" size={16} color={C.textMuted} />
          <Text style={styles.privacyText}>Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const C = useColors();
  return (
    <View style={{
      width: '48%',
      backgroundColor: C.surfaceAlt,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: C.border,
    }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.primary, marginBottom: 4 }}>{value}</Text>
      <Text style={{ fontSize: 11, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: C.background,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: C.background,
    },
    profileHeader: {
      backgroundColor: C.surface,
      alignItems: 'center',
      padding: 24,
      paddingTop: 32,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    avatarWrapper: {
      alignItems: 'center',
      marginBottom: 12,
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarImage: {
      width: 84,
      height: 84,
      borderRadius: 42,
    },
    avatarText: {
      color: '#fff',
      fontSize: 34,
      fontWeight: '700',
    },
    cameraLabel: {
      marginTop: 6,
    },
    cameraLabelText: {
      fontSize: 13,
      color: C.primary,
      fontWeight: '600',
    },
    username: {
      fontSize: 20,
      fontWeight: '800',
      color: C.text,
      marginBottom: 4,
    },
    fullName: {
      fontSize: 16,
      color: C.textSecondary,
      marginBottom: 4,
    },
    bio: {
      fontSize: 14,
      color: C.textMuted,
      textAlign: 'center',
      marginBottom: 4,
      paddingHorizontal: 16,
    },
    location: {
      fontSize: 13,
      color: C.textMuted,
    },
    followRow: {
      flexDirection: 'row',
      backgroundColor: C.surface,
      paddingVertical: 16,
      marginTop: 8,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    followItem: {
      flex: 1,
      alignItems: 'center',
    },
    followCount: {
      fontSize: 22,
      fontWeight: '800',
      color: C.text,
    },
    followLabel: {
      fontSize: 12,
      color: C.textMuted,
      marginTop: 2,
    },
    followDivider: {
      width: 1,
      backgroundColor: C.border,
    },
    statsSection: {
      backgroundColor: C.surface,
      marginTop: 8,
      padding: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: C.text,
      marginBottom: 12,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    recentSection: {
      backgroundColor: C.surface,
      marginTop: 8,
      padding: 16,
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
      gap: 12,
    },
    recentBody: {
      flex: 1,
    },
    recentTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: C.text,
      marginBottom: 2,
    },
    recentStats: {
      fontSize: 13,
      color: C.textMuted,
    },
    appearanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.surface,
      marginTop: 8,
      marginHorizontal: 20,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: C.border,
    },
    appearanceLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: C.text,
    },
    privacyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginHorizontal: 20,
      marginTop: 8,
      paddingVertical: 12,
    },
    privacyText: {
      color: C.textMuted,
      fontSize: 14,
      textDecorationLine: 'underline',
    },
    signOutButton: {
      margin: 20,
      marginTop: 8,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: C.danger,
      alignItems: 'center',
    },
    signOutText: {
      color: C.danger,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
