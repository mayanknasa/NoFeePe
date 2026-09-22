import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';

interface BackButtonProps {
  onPress: () => void;
  size?: number;
}

export const BackButton: React.FC<BackButtonProps> = ({ onPress, size = 40 }) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.chevron} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2.4,
    borderBottomWidth: 2.4,
    borderColor: '#F5F6FA',
    transform: [{ rotate: '45deg' }],
    marginLeft: 3,
    borderRadius: 1,
  },
});
