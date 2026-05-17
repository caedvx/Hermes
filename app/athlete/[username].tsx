import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';
import type { Profile, Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { formatDistance, formatDuration, sportIoniconName } from '@/lib/utils';

export default function AthleteScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  useEffect(() => {
    if (!username) return;
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username!)
        .single();
      if (!data) return;
      const profileData = data as Profile;
      setProfile(profileData);
      const [actsRes, followRes] = await Promise.all([
        supabase
          .from('activities')
          .select('*')
          .eq('user_id', profileData.id)
          .in('status', ['public'])
          .order('start_at', { ascending: false })
          .limit(10),
        user
          ? supabase
              .from('follows')
              .select('follower_id')
              .eq('follower_id', user.id)
              .eq('following_id', profileData.id)
              .single()
          : Promise.resolve({ data: null }),
      ]);
      setActivities((actsRes.data as Activity[]) ?? []);
      setIsFollowing(!!followRes.data);
    }
    load().finally(() => setLoading(false));
  }, [username, user]);

  async function toggleFollow() {
    if (!user || !profile) return;
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', profile.id);
      setIsFollowing(false);
    } else {
      await supabase.from('follows').insert([{ follower_id: user.id, following_id: profile.id }] as never[]);
      setIsFollowing(true);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Athlete not found</Text>
      </View>
    );
  }

  const isOwnProfile = user?.id === profile.id;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.headerSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(profile.username[0] ?? '?').toUpperCase()}</Text>
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.full_name && <Text style={styles.fullName}>{profile.full_name}</Text>}
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
          {(profile.city || profile.country) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Ionicons name="location-outline" size={13} color={C.textMuted} />
              <Text style={styles.location}>
                {[profile.city, profile.country].filter(Boolean).join(', ')}
              </Text>
            </View>
          )}

          {!isOwnProfile && (
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={toggleFollow}
            >
              <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.activitiesSection}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          {activities.length === 0 ? (
            <Text style={styles.emptyText}>No public activities</Text>
          ) : (
            activities.map((act) => (
              <View key={act.id} style={styles.actRow}>
                <Ionicons name={sportIoniconName(act.sport_type) as never} size={22} color={C.textSecondary} />
                <View style={styles.actBody}>
                  <Text style={styles.actTitle} numberOfLines={1}>{act.title}</Text>
                  <Text style={styles.actStats}>
                    {formatDistance(act.distance)} · {formatDuration(act.elapsed_time)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.background },
    errorText: { fontSize: 16, color: C.textMuted },
    headerSection: {
      backgroundColor: C.surface,
      alignItems: 'center',
      padding: 24,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '700' },
    username: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 },
    fullName: { fontSize: 15, color: C.textSecondary, marginBottom: 4 },
    bio: { fontSize: 14, color: C.textMuted, textAlign: 'center', marginBottom: 4, paddingHorizontal: 16 },
    location: { fontSize: 13, color: C.textMuted, marginBottom: 16 },
    followButton: {
      paddingHorizontal: 32,
      paddingVertical: 10,
      borderRadius: 20,
      backgroundColor: C.primary,
      marginTop: 8,
    },
    followingButton: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: C.primary,
    },
    followButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    followingButtonText: { color: C.primary },
    activitiesSection: { backgroundColor: C.surface, marginTop: 8, padding: 16 },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 12 },
    emptyText: { fontSize: 14, color: C.textMuted, textAlign: 'center', paddingVertical: 16 },
    actRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: C.border,
      gap: 12,
    },
    actBody: { flex: 1 },
    actTitle: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 2 },
    actStats: { fontSize: 13, color: C.textMuted },
  });
}
