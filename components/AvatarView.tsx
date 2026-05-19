import { Image, Text, View, ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface AvatarViewProps {
  uri?: string | null;
  name: string;
  size?: number;
  style?: ViewStyle;
}

export default function AvatarView({ uri, name, size = 40, style }: AvatarViewProps) {
  const C = useColors();
  const radius = size / 2;
  const initial = (name || '?')[0].toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[{
          width: size, height: size, borderRadius: radius,
          borderWidth: 1, borderColor: 'rgba(0,188,212,0.28)',
        }, style]}
      />
    );
  }

  return (
    <View style={[{
      width: size, height: size, borderRadius: radius,
      backgroundColor: 'rgba(0,188,212,0.12)',
      borderWidth: 1, borderColor: 'rgba(0,188,212,0.28)',
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Text style={{ color: C.primary, fontSize: size * 0.38, fontWeight: '500' }}>
        {initial}
      </Text>
    </View>
  );
}
