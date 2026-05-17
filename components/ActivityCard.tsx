import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Activity } from '@/lib/types';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/constants/colors';
import {
  formatDistance,
  formatDuration,
  formatDate,
  formatPace,
  sportIoniconName,
  sportLabel,
} from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth';

interface Props {
  activity: Activity;
  showAuthor?: boolean;
}

export function ActivityCard({ activity, showAuthor = true }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const [kudoCount, setKudoCount] = useState(0);
  const [hasKudo, setHasKudo] = useState(false);
  const C = useColors();
  const styles = useMemo(() => makeStyles(C), [C]);

  async function toggleKudo() {
    if (!user) return;
    if (hasKudo) {
      await supabase.from('kudos').delete().eq('activity_id', activity.id).eq('user_id', user.id);
      setHasKudo(false);
      setKudoCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('kudos').insert([{ activity_id: activity.id, user_id: user.id }] as never[]);
      setHasKudo(true);
      setKudoCount((c) => c + 1);
    }
  }

  const profile = activity.profiles;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/activity/${activity.id}`)}
      activeOpacity={0.95}
    >
      {showAuthor && profile && (
        <View style={styles.authorRow}>
          <View style={styles.authorAvatar}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {(profile.username?.[0] ?? '?').toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{profile.full_name ?? profile.username}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Ionicons name={sportIoniconName(activity.sport_type) as never} size={12} color={C.textMuted} />
              <Text style={styles.authorMeta}>
                {sportLabel(activity.sport_type)} · {formatDate(activity.start_at)}
              </Text>
            </View>
          </View>
        </View>
      )}

      <Text style={styles.title}>{activity.title}</Text>

      <View style={styles.statsRow}>
        <Stat label="Distance" value={formatDistance(activity.distance)} />
        <Stat label="Duration" value={formatDuration(activity.elapsed_time)} />
        {activity.avg_speed && (
          <Stat label="Pace" value={formatPace(activity.avg_speed, activity.sport_type)} />
        )}
        {activity.elevation_gain != null && (
          <Stat label="Elev" value={`${Math.round(activity.elevation_gain)}m`} />
        )}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={toggleKudo}>
          <Ionicons
            name={hasKudo ? 'thumbs-up' : 'thumbs-up-outline'}
            size={16}
            color={hasKudo ? C.primary : C.textSecondary}
          />
          <Text style={[styles.actionText, hasKudo && styles.actionTextActive]}>
            {kudoCount > 0 ? String(kudoCount) : 'Kudo'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push(`/activity/${activity.id}`)}
        >
          <Ionicons name="chatbubble-outline" size={16} color={C.textSecondary} />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const C = useColors();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: C.text }}>{value}</Text>
      <Text style={{ fontSize: 10, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '600', marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function makeStyles(C: Colors) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.surface,
      padding: 16,
      borderRadius: 0,
    },
    authorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 10,
    },
    authorAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: C.primary,
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
    },
    avatarImage: {
      width: 40,
      height: 40,
    },
    avatarText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
    authorInfo: {
      flex: 1,
    },
    authorName: {
      fontSize: 15,
      fontWeight: '700',
      color: C.text,
    },
    authorMeta: {
      fontSize: 12,
      color: C.textMuted,
      marginTop: 1,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: C.text,
      marginBottom: 12,
    },
    statsRow: {
      flexDirection: 'row',
      marginBottom: 14,
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: 12,
    },
    actionsRow: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: 12,
      gap: 4,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: C.background,
      borderWidth: 1,
      borderColor: C.border,
    },
    actionText: {
      fontSize: 13,
      color: C.textSecondary,
      fontWeight: '600',
    },
    actionTextActive: {
      color: C.primary,
    },
  });
}
