// shared/i18n/rtlStyles.ts
import { I18nManager, StyleSheet } from 'react-native';

export const isRTL = I18nManager.isRTL;

export const rtl = StyleSheet.create({
  text: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  row: {
    flexDirection: isRTL ? 'row-reverse' : 'row',
  },
  alignStart: {
    alignItems: isRTL ? 'flex-end' : 'flex-start',
  },
  selfStart: {
    alignSelf: isRTL ? 'flex-end' : 'flex-start',
  },
});
