import { useTheme } from '@/contexts/theme';
import type { Colors } from '@/constants/colors';

export function useColors(): Colors {
  return useTheme().colors;
}
