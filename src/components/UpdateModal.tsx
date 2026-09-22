import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { CustomModal } from './CustomModal';
import { AppIcon } from './AppIcon';
import { UpdateInfo } from '../services/updateChecker';
import { colors, spacing, typography, radii } from '../theme';

export type UpdateModalProps = {
  update: UpdateInfo | null;
  visible: boolean;
  onDismiss: () => void;
};

/**
 * App-Themed Update Notification Modal.
 * Alerts the user when a newer release is published on GitHub,
 * displaying the new version tag, changelog summary, and one-tap download.
 */
export const UpdateModal: React.FC<UpdateModalProps> = ({
  update,
  visible,
  onDismiss,
}) => {
  if (!update || !visible) return null;

  const handleDownload = () => {
    try {
      onDismiss?.();
      const targetUrl = update?.downloadUrl ?? update?.releaseUrl;
      if (targetUrl) {
        Linking.openURL(targetUrl).catch((err: unknown) => {
          console.warn('[UpdateModal] Linking.openURL error, falling back to releaseUrl:', err);
          if (update?.releaseUrl) {
            Linking.openURL(update.releaseUrl).catch(() => {});
          }
        });
      }
    } catch (err: unknown) {
      console.warn('[UpdateModal] handleDownload error:', err);
    }
  };

  const latestVersion = update?.latestVersion ?? 'New';
  const releaseNotes = update?.releaseNotes?.trim();

  return (
    <CustomModal
      visible={visible}
      icon={<AppIcon name="download" size={24} color="#38BDF8" />}
      iconType="info"
      title="New Update Available"
      message={`Version ${latestVersion} is now available on GitHub. Update to get the latest features, security patches, and performance improvements.`}
      primaryButton={{
        text: `Download v${latestVersion}`,
        onPress: handleDownload,
      }}
      secondaryButton={{
        text: 'Later',
        onPress: onDismiss,
      }}
      onDismiss={onDismiss}
    >
      {releaseNotes ? (
        <View style={styles.notesContainer}>
          <Text style={styles.notesLabel}>What's New:</Text>
          <Text numberOfLines={3} style={styles.notesText}>
            {releaseNotes}
          </Text>
        </View>
      ) : null}
    </CustomModal>
  );
};

const styles = StyleSheet.create({
  notesContainer: {
    width: '100%',
    backgroundColor: '#0C0D15',
    borderWidth: 1,
    borderColor: '#24263A',
    borderRadius: radii?.sm ?? 8,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  notesLabel: {
    ...typography.captionMedium,
    color: colors?.accentEnd ?? '#00D9F5',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    ...typography.caption,
    color: '#8E92A8',
    fontSize: 12,
    lineHeight: 16,
  },
});
