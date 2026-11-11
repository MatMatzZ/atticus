import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/design/theme';
import { radius } from '@/design/tokens';

/** Bottom sheet: dialogs live in thumb reach, buttons stacked at the bottom. */
export function Sheet({ visible, onClose, children, alert }: { visible: boolean; onClose?: () => void; children: React.ReactNode; alert?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: c.scrim }}>
        {alert ? null : <Pressable accessibilityLabel="Close" accessibilityRole="button" style={{ flex: 1 }} onPress={onClose} />}
        <View
          accessibilityViewIsModal
          style={{ backgroundColor: c.surface, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, maxHeight: '90%', paddingBottom: insets.bottom + 16 }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.hair, marginTop: 12 }} accessible={false} />
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}
