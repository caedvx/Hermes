import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface SegmentedControlProps {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export default function SegmentedControl({ options, selectedIndex, onChange }: SegmentedControlProps) {
  const C = useColors();

  return (
    <View style={{ backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row' }}>
        {options.map((option, index) => {
          const active = index === selectedIndex;
          return (
            <TouchableOpacity
              key={option}
              onPress={() => onChange(index)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 2,
                borderBottomColor: active ? C.primary : 'transparent',
              }}
            >
              <Text
                style={{
                  color: active ? C.primary : C.textMuted,
                  fontWeight: active ? '700' : '400',
                  fontSize: 14,
                }}
              >
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
