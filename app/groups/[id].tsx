import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { GlassCard } from '@/components/GlassCard';

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
  const [inviteVisible, setInviteVisible] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<Profile[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const memberIds = new Set(members.map((m) => m.user_id));

  const load = useCallback(async () => {
    if (!user || !id) return;
    const { data: groupData } = await supabase.from('groups').select('*').eq('id', id).single();
    if (!groupData) { setNotFound(true); setLoading(false); return; }
    setGroup(groupData as Group);
    const { data: myMembership } = await supabase.from('group_members').select('role').eq('group_id', id).eq('user_id', user.id).single();
    setMyRole(myMembership ? (myMembership as { role: GroupRole }).role : null);
    const { data: memberData } = await supabase.from('group_members').select('group_id, user_id, role, joined_at, profiles(id,username,full_name,avatar_url)').eq('group_id', id).order('role').order('joined_at');
    const memberList = (memberData ?? []) as GroupMember[];
    setMembers(memberList);
    const mIds = memberList.map((m) => m.user_id);
    if (mIds.length > 0) {
      const { data: actData } = await supabase.from('activities').select('*, profiles(id,username,full_name,avatar_url)').in('user_id', mIds).in('status', ['public', 'followers_only']).order('start_at', { ascending: false }).limit(30);
      setActivities((actData ?? []) as Activity[]);
    } else { setActivities([]); }
  }, [user, id]);

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false); })(); }, [load]);
  useEffect(() => { if (group) navigation.setOptions({ title: group.name }); }, [group, navigation]);

  const onRefresh = useCallback(async () => { setRefreshing(true); await load(); setRefreshing(false); }, [load]);

  const handleLeave = () => Alert.alert('Leave Group', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: async () => { await supabase.from('group_members').delete().eq('group_id', id).eq('user_id', user!.id); router.back(); } },
  ]);

  const handleDelete = () => Alert.alert('Delete Group', 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('groups').delete().eq('id', id); router.back(); } },
  ]);

  const handleInviteSearch = async (text: string) => {
    setInviteSearch(text);
    if (!text.trim()) { setInviteResults([]); return; }
    const { data } = await supabase.from('profiles').select('id,username,full_name,avatar_url').or(`username.ilike.%${text.trim()}%,full_name.ilike.%${text.trim()}%`).neq('id', user!.id).limit(10);
    setInviteResults((data ?? []) as Profile[]);
  };

  const handleInvite = async (profile: Profile) => {
    if (memberIds.has(profile.id)) return;
    setInvitingId(profile.id);
    await supabase.from('group_members').insert([{ group_id: id, user_id: profile.id, role: 'member' }] as never[]);
    setInvitingId(null);
    await load();
    setInviteVisible(false); setInviteSearch(''); setInviteResults([]);
  };

  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#030A0C' }}><ActivityIndicator color={C.primary} /></View>;
  if (notFound || !group) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#030A0C', padding: 32, gap: 10 }}>
      <Ionicons name="lock-closed-outline" size={44} color={C.textMuted} />
      <Text style={{ color: C.text, fontSize: 17, fontWeight: '500' }}>Group not found</Text>
      <Text style={{ color: C.textMuted, textAlign: 'center', fontSize: 13 }}>This group is private or does not exist.</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#030A0C' }} edges={['bottom']}>
      {/* Group header */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)' }}>
        <GlassCard padding={14}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <AvatarView uri={group.avatar_url} name={group.name} size={50} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <Text style={{ color: C.text, fontSize: 16, fontWeight: '500', letterSpacing: -0.3 }}>{group.name}</Text>
                {group.privacy === 'private' && <Ionicons name="lock-closed" size={12} color={C.textMuted} />}
              </View>
              <Text style={{ color: C.textMuted, fontSize: 12 }}>
                {group.member_count} {group.member_count === 1 ? 'member' : 'members'}{group.sport_type ? ` · ${group.sport_type}` : ''}
              </Text>
              {group.description ? <Text style={{ color: C.textSecondary, fontSize: 12, marginTop: 3 }}>{group.description}</Text> : null}
            </View>
            {myRole === 'admin' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setInviteVisible(true)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1, borderColor: C.primary, backgroundColor: C.primary }}>
                  <Text style={{ color: '#030A0C', fontSize: 12, fontWeight: '500' }}>Invite</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={18} color={C.danger} />
                </TouchableOpacity>
              </View>
            ) : myRole === 'member' ? (
              <TouchableOpacity onPress={handleLeave} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(0,188,212,0.25)' }}>
                <Text style={{ color: C.textSecondary, fontSize: 12 }}>Leave</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </GlassCard>
      </View>

      <SegmentedControl options={['Feed', 'Members']} selectedIndex={tabIndex} onChange={setTabIndex} />

      {tabIndex === 0 ? (
        <FlatList
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ActivityCard activity={item} showAuthor />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 10 }}>
              <Ionicons name="barbell-outline" size={44} color={C.textMuted} />
              <Text style={{ color: C.textMuted, textAlign: 'center', fontSize: 14 }}>No activities from group members yet.</Text>
            </View>
          }
          contentContainerStyle={activities.length === 0 ? { flex: 1 } : { paddingVertical: 8, paddingBottom: 100 }}
        />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.user_id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
          renderItem={({ item }) => item.profiles ? (
            <AthleteRow
              profile={item.profiles}
              onPress={() => router.push(`/athlete/${item.profiles!.username}`)}
              rightElement={item.role === 'admin' ? (
                <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,188,212,0.35)', backgroundColor: 'rgba(0,188,212,0.10)' }}>
                  <Text style={{ color: C.primary, fontSize: 10, fontWeight: '500' }}>ADMIN</Text>
                </View>
              ) : <View />}
            />
          ) : null}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      {/* Invite modal */}
      <Modal visible={inviteVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInviteVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#030A0C' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,188,212,0.12)' }}>
            <Text style={{ color: C.text, fontSize: 17, fontWeight: '500' }}>Invite Member</Text>
            <TouchableOpacity onPress={() => { setInviteVisible(false); setInviteSearch(''); setInviteResults([]); }}>
              <Ionicons name="close" size={22} color={C.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={{ margin: 12, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 50, backgroundColor: 'rgba(0,188,212,0.07)', borderWidth: 1, borderColor: 'rgba(0,188,212,0.18)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="search" size={16} color={C.textMuted} />
            <TextInput value={inviteSearch} onChangeText={handleInviteSearch} placeholder="Search athletes..." placeholderTextColor={C.textMuted} style={{ flex: 1, color: C.text, fontSize: 14 }} autoCapitalize="none" autoCorrect={false} autoFocus />
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
            ListEmptyComponent={inviteSearch.length > 0 ? <View style={{ alignItems: 'center', paddingTop: 40 }}><Text style={{ color: C.textMuted, fontSize: 14 }}>No athletes found</Text></View> : null}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}
