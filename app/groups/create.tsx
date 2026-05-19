import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useAuth } from '@/contexts/auth';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { GroupPrivacy, SportType } from '@/lib/types';
import { sportLabel } from '@/lib/utils';
import { GlassCard } from '@/components/GlassCard';
import { PillButton } from '@/components/PillButton';

const SPORT_ICONS: Record<SportType, string> = {
  run: 'flash-outline', ride: 'bicycle-outline', swim: 'water-outline',
  hike: 'trail-sign-outline', walk: 'walk-outline', other: 'barbell-outline',
};
const SPORT_OPTIONS: (SportType | null)[] = [null, 'run', 'ride', 'swim', 'hike', 'walk', 'other'];

export default function CreateGroupScreen() {
  const C = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sportType, setSportType] = useState<SportType | null>(null);
  const [privacy, setPrivacy] = useState<GroupPrivacy>('public');
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) { Alert.alert('Error', 'Group name must be at least 2 characters.'); return; }
    if (!user) return;
    setSubmitting(true);
    const { data: group, error } = await supabase.from('groups').insert([{ name: trimmedName, description: description.trim() || null, sport_type: sportType, privacy, created_by: user.id, avatar_url: null }] as never[]).select('id').single();
    if (error || !group) { Alert.alert('Error', error?.message ?? 'Could not create group.'); setSubmitting(false); return; }
    await supabase.from('group_members').insert([{ group_id: (group as { id: string }).id, user_id: user.id, role: 'admin' }] as never[]);
    setSubmitting(false);
    router.replace(`/groups/${(group as { id: string }).id}`);
  };

  const inputStyle = {
    backgroundColor: 'rgba(0,188,212,0.07)' as const,
    borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,188,212,0.18)',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15 as const, color: C.text,
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#030A0C' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">

        {/* Name */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' }}>GROUP NAME *</Text>
          <TextInput style={inputStyle} placeholder="e.g. Morning Runners Club" placeholderTextColor={C.textMuted} value={name} onChangeText={setName} maxLength={60} returnKeyType="next" />
        </View>

        {/* Description */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' }}>DESCRIPTION</Text>
          <TextInput style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="What's this group about?" placeholderTextColor={C.textMuted} value={description} onChangeText={setDescription} maxLength={500} multiline />
          <Text style={{ color: C.textMuted, fontSize: 11, alignSelf: 'flex-end' }}>{description.length}/500</Text>
        </View>

        {/* Sport focus */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' }}>SPORT FOCUS</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {SPORT_OPTIONS.map((s) => {
              const active = sportType === s;
              return (
                <TouchableOpacity
                  key={s ?? 'any'}
                  onPress={() => setSportType(s)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, borderWidth: 1, borderColor: active ? 'rgba(0,188,212,0.45)' : 'rgba(0,188,212,0.18)', backgroundColor: active ? 'rgba(0,188,212,0.14)' : 'rgba(0,188,212,0.05)' }}
                >
                  <Ionicons name={(s ? SPORT_ICONS[s] : 'apps-outline') as never} size={13} color={active ? C.primary : C.textMuted} />
                  <Text style={{ color: active ? C.primary : C.textMuted, fontSize: 13, fontWeight: active ? '500' : '400' }}>{s ? sportLabel(s) : 'Any'}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Privacy */}
        <View style={{ gap: 8 }}>
          <Text style={{ color: C.textMuted, fontSize: 10, fontWeight: '500', letterSpacing: 0.8, textTransform: 'uppercase' }}>PRIVACY</Text>
          <GlassCard padding={4}>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {(['public', 'private'] as GroupPrivacy[]).map((p) => {
                const active = privacy === p;
                return (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPrivacy(p)}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, backgroundColor: active ? 'rgba(0,188,212,0.18)' : 'transparent', borderWidth: active ? 1 : 0, borderColor: 'rgba(0,188,212,0.35)' }}
                  >
                    <Ionicons name={(p === 'public' ? 'globe-outline' : 'lock-closed-outline') as never} size={16} color={active ? C.primary : C.textMuted} />
                    <Text style={{ color: active ? C.primary : C.textMuted, fontWeight: active ? '500' : '400', fontSize: 13, marginTop: 4 }}>{p === 'public' ? 'Public' : 'Private'}</Text>
                    <Text style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>{p === 'public' ? 'Anyone can join' : 'Invite only'}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </GlassCard>
        </View>

        <PillButton label="Create Group" onPress={handleCreate} loading={submitting} disabled={name.trim().length < 2} glow style={{ marginTop: 8 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
