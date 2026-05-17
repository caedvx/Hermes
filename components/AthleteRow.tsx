import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Profile } from '@/lib/types';
import AvatarView from './AvatarView';

interface AthleteRowProps {
  profile: Profile;
  actionLabel?: string;
  actionVariant?: 'primary' | 'outline' | 'danger';
  onAction?: () => void;
  onPress?: () => void;
  isLoading?: boolean;
  rightElement?: React.ReactNode;
}

export default function AthleteRow({
  profile,
  actionLabel,
  actionVariant = 'primary',
  onAction,
  onPress,
  isLoading,
  rightElement,
}: AthleteRowProps) {
  const C = useColors();

  const buttonBg =
    actionVariant === 'primary' ? C.primary :
    actionVariant === 'danger' ? C.danger :
    'transparent';
  const buttonBorder =
    actionVariant === 'outline' ? C.border :
    actionVariant === 'danger' ? C.danger :
    C.primary;
  const buttonText =
    actionVariant === 'primary' ? '#fff' :
    actionVariant === 'danger' ? C.danger :
    C.textSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: C.surface,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        gap: 12,
      }}
    >
      <AvatarView uri={profile.avatar_url} name={profile.username} size={44} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: C.text, fontWeight: '600', fontSize: 15 }}>
          {profile.username}
        </Text>
        {profile.full_name ? (
          <Text style={{ color: C.textMuted, fontSize: 13, marginTop: 1 }}>
            {profile.full_name}
          </Text>
        ) : null}
      </View>
      {rightElement !== undefined ? (
        rightElement
      ) : actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          disabled={isLoading}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 6,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: buttonBorder,
            backgroundColor: buttonBg,
            minWidth: 80,
            alignItems: 'center',
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={buttonText} />
          ) : (
            <Text style={{ color: buttonText, fontSize: 13, fontWeight: '600' }}>
              {actionLabel}
            </Text>
          )}
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}
