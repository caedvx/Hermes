import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import { Activity, Group, GroupMember, GroupRole, Profile } from '@/lib/types';
import ActivityCard from '@/components/ActivityCard';
import AthleteRow from '@/components/AthleteRow';
import AvatarView from '@/components/AvatarView';
import SegmentedControl from '@/components/SegmentedControl';

export default function GroupDetailScreen() {
  const C = useColors();
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [myRole, setMyRole] = useState<GroupRole | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tabIndex, setTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Invite modal state
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<Profile[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const memberIds = new Set(members.map((m) => m.user_id));

  const load = useCallback(async () => {
    if (!user || !id) return;

    // Fetch group (with my membership if applicable)
    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .eq('id', id)
      .single();

    if (!groupData) { setNotFound(true); setLoading(false); return; }
    setGroup(groupData as Group);

    // My role
    const { data: myMembership } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', id)
      .eq('user_id', user.id)
      .single();
    setMyRole(myMembership ? (myMembership as { role: GroupRole }).role : null);

    // Members
    const { data: memberData } = await supabase
      .from('group_members')
      .select('group_id, user_id, role, joined_at, profiles(id,username,full_name,avatar_url)')
      .eq('group_id', id)
      .order('role')
      .order('joined_at');
    const memberList = (memberData ?? []) as GroupMember[];
    setMembers(memberList);

    // Activities from all group members
    const mIds = memberList.map((m) => m.user_id);
    if (mIds.length > 0) {
      const { data: actData } = await supabase
        .from('activities')
        .select('*, profiles(id,username,full_name,avatar_url)')
        .in('user_id', mIds)
        .in('status', ['public', 'followers_only'])
        .order('start_at', { ascending: false })
        .limit(30);
      setActivities((actData ?? []) as Activity[]);
    } else {
      setActivities([]);
    }
  }, [user, id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useEffect(() => {
    if (group) {
      navigation.setOptions({ title: group.name });
    }
  }, [group, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleLeave = () => {
    Alert.alert('Leave Group', 'Are you sure you want to leave this group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('group_members')
            .delete()
            .eq('group_id', id)
            .eq('user_id', user!.id);
          router.back();
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete Group', 'This will permanently delete the group and all its data. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('groups').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  };

  const handleInviteSearch = async (text: string) => {
    setInviteSearch(text);
    if (!text.trim()) { setInviteResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id,username,full_name,avatar_url')
      .or(`username.ilike.%${text.trim()}%,full_name.ilike.%${text.trim()}%`)
      .neq('id', user!.id)
      .limit(10);
    setInviteResults((data ?? []) as Profile[]);
  };

  const handleInvite = async (profile: Profile) => {
    if (memberIds.has(profile.id)) return;
    setInvitingId(profile.id);
    await supabase.from('group_members').insert([
      { group_id: id, user_id: profile.id, role: 'member' },
    ] as never[]);
    setInvitingId(null);
    await load();
    setInviteVisible(false);
    setInviteSearch('');
    setInviteResults([]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background }}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  if (notFound || !group) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.background, padding: 32 }}>
        <Ionicons name="lock-closed-outline" size={48} color={C.textMuted} />
        <Text style={{ color: C.text, fontSize: 18, fontWeight: '700', marginTop: 16 }}>Group not found</Text>
        <Text style={{ color: C.textMuted, textAlign: 'center', marginTop: 8 }}>
          This group is private or does not exist.
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.background }} edges={['bottom']}>
      {/* Group header */}
      <View
        style={{
          backgroundColor: C.surface,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: C.border,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <AvatarView uri={group.avatar_url} name={group.name} size={52} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>{group.name}</Text>
              {group.privacy === 'private' && (
                <Ionicons name="lock-closed" size={14} color={C.textMuted} />
              )}
            </View>
            <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 2 }}>
              {group.member_count} {group.member_count === 1 ? 'member' : 'members'}
              {group.sport_type ? ` · ${group.sport_type}` : ''}
            </Text>
          </View>
          {myRole === 'admin' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setInviteVisible(true)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: C.primary,
                  backgroundColor: C.primary,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Invite</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={{ padding: 6 }}>
                <Ionicons name="trash-outline" size={20} color={C.danger} />
              </TouchableOpacity>
            </View>
          ) : myRole === 'member' ? (
            <TouchableOpacity
              onPress={handleLeave}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: C.border,
              }}
            >
              <Text style={{ color: C.textSecondary, fontSize: 13 }}>Leave</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {group.description ? (
          <Text style={{ color: C.textSecondary, fontSize: 14 }}>{group.description}</Text>
        ) : null}
      </View>

      <SegmentedControl
        options={['Feed', 'Members']}
        selectedIndex={tabIndex}
        onChange={setTabIndex}
      />

      {tabIndex === 0 ? (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ActivityCard activity={item} showAuthor />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 }}>
              <Ionicons name="barbell-outline" size={48} color={C.textMuted} />
              <Text style={{ color: C.textMuted, marginTop: 12, textAlign: 'center', fontSize: 15 }}>
                No activities from group members yet.
              </Text>
            </View>
          }
          contentContainerStyle={activities.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />
          }
          renderItem={({ item }) =>
            item.profiles ? (
              <AthleteRow
                profile={item.profiles}
                onPress={() => router.push(`/athlete/${item.profiles!.username}`)}
                rightElement={
                  item.role === 'admin' ? (
                    <Text
                      style={{
                        color: C.primary,
                        fontSize: 11,
                        fontWeight: '700',
                        borderWidth: 1,
                        borderColor: C.primary,
                        borderRadius: 4,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                      }}
                    >
                      ADMIN
                    </Text>
                  ) : (
                    <View />
                  )
                }
              />
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Text style={{ color: C.textMuted, fontSize: 15 }}>No members</Text>
            </View>
          }
        />
      )}

      {/* Invite modal */}
      <Modal
        visible={inviteVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setInviteVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: C.background }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}
          >
            <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>Invite Member</Text>
            <TouchableOpacity onPress={() => { setInviteVisible(false); setInviteSearch(''); setInviteResults([]); }}>
              <Ionicons name="close" size={24} color={C.text} />
            </TouchableOpacity>
          </View>

          <View
            style={{
              margin: 12,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: C.surfaceAlt,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Ionicons name="search" size={18} color={C.textMuted} />
            <TextInput
              value={inviteSearch}
              onChangeText={handleInviteSearch}
              placeholder="Search athletes..."
              placeholderTextColor={C.textMuted}
              style={{ flex: 1, color: C.text, fontSize: 15 }}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <FlatList
            data={inviteResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const alreadyMember = memberIds.has(item.id);
              return (
                <AthleteRow
                  profile={item}
                  actionLabel={alreadyMember ? 'Member' : 'Invite'}
                  actionVariant={alreadyMember ? 'outline' : 'primary'}
                  onAction={alreadyMember ? undefined : () => handleInvite(item)}
                  isLoading={invitingId === item.id}
                />
              );
            }}
            ListEmptyComponent={
              inviteSearch.length > 0 ? (
                <View style={{ alignItems: 'center', paddingTop: 40 }}>
                  <Text style={{ color: C.textMuted }}>No athletes found</Text>
                </View>
              ) : null
            }
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
