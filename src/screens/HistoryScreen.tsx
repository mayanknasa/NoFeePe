import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList, TransactionRecord } from '../types';
import { useHistoryStore } from '../store/historyStore';
import { maskVpa } from '../domain/upi';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { GlassCard } from '../components/GlassCard';
import { BackButton } from '../components/BackButton';
import { AppIcon } from '../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

/**
 * Transaction History Screen.
 * Provides an offline ledger of completed direct and split payments:
 * - Direct payments: single summary card showing settled status, UPI app used, and UTR.
 * - Split payments: batch card showing installment counts (e.g. 45/46 settled).
 *   Tapping expands an interactive ledger detailing each installment leg, amount,
 *   UPI app used, settlement UTR, and timestamp.
 * - Displays clear data retention notice informing users of device-only storage.
 */
export const HistoryScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const records = useHistoryStore((state) => state?.records ?? []);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleBack = () => {
    try {
      ReactNativeHapticFeedback.trigger('selection', {
        enableVibrateFallback: true,
      });
    } catch (err: unknown) {
      console.debug?.('[HistoryScreen] Haptic error:', err);
    }
    try {
      navigation?.goBack?.();
    } catch (err: unknown) {
      console.warn('[HistoryScreen] goBack error:', err);
    }
  };

  const handleToggleExpand = (id: string) => {
    try {
      ReactNativeHapticFeedback.trigger('selection', {
        enableVibrateFallback: true,
      });
    } catch (err: unknown) {
      console.debug?.('[HistoryScreen] Haptic error:', err);
    }
    setExpandedId((prev: string | null) => (prev === id ? null : id));
  };

  const renderItem = useCallback(
    ({ item: record }: ListRenderItemInfo<TransactionRecord>) => {
      const dateStr = new Date(record?.timestamp ?? Date.now()).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const amountRupees = (((record?.totalPaise ?? 0) / 100)).toFixed(2);
      const isSuccess = record?.status === 'SUCCESS';
      const isExpanded = expandedId === record?.id;

      return (
        <TouchableOpacity
          key={record?.id}
          activeOpacity={0.85}
          onPress={() => handleToggleExpand(record.id)}
        >
          <GlassCard style={styles.recordCard}>
            <View style={styles.recordHeader}>
              <View style={styles.payeeInfo}>
                <Text style={styles.recordPayee} numberOfLines={1}>
                  {record?.payeeName ?? 'Merchant'}
                </Text>
                <Text style={styles.recordVpa}>
                  {maskVpa(record?.payeeVpa ?? '')}
                </Text>
              </View>
              <View style={styles.amountInfo}>
                <Text style={styles.recordAmount}>₹{amountRupees}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    isSuccess ? styles.badgeSuccess : styles.badgePartial,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isSuccess ? styles.textSuccess : styles.textPartial,
                    ]}
                  >
                    {isSuccess ? '✓ Settled' : 'Partial'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.recordMetaRow}>
              <Text style={styles.recordDate}>{dateStr}</Text>
              <View style={styles.modeIndicator}>
                <Text style={styles.modeText}>
                  {record?.mode === 'split'
                    ? `Split (${record?.legs?.length ?? 1} legs)`
                    : 'Direct'}
                </Text>
                {record?.primaryAppLabel && (
                  <Text style={styles.appBadge}>
                    via {record.primaryAppLabel}
                  </Text>
                )}
                {record?.mode === 'split' && (
                  <Text style={styles.expandChevron}>
                    {isExpanded ? '▲' : '▼'}
                  </Text>
                )}
              </View>
            </View>

            {/* Expandable Installment Breakdown for Split Payments */}
            {isExpanded && record?.mode === 'split' && (
              <View style={styles.expandedSection}>
                <View style={styles.expandedDivider} />
                <Text style={styles.expandedTitle}>
                  INSTALLMENT BREAKDOWN ({record?.legs?.length ?? 0} LEGS)
                </Text>
                {(record?.legs ?? []).map((leg, legIdx) => {
                  const legAmt = (((leg?.amountPaise ?? 0) / 100)).toFixed(2);
                  return (
                    <View key={leg?.index ?? legIdx} style={styles.expandedLegRow}>
                      <View style={styles.legIndexBox}>
                        <Text style={styles.legIndexNum}>#{legIdx + 1}</Text>
                      </View>
                      <View style={styles.expandedLegDetails}>
                        <Text style={styles.expandedLegAmt}>₹{legAmt}</Text>
                        <Text style={styles.expandedLegRef} numberOfLines={1}>
                          {leg?.txnId ? `UTR: ${leg.txnId}` : 'Ref: —'}
                          {leg?.appLabel ? ` • ${leg.appLabel}` : ''}
                        </Text>
                      </View>
                      <View style={styles.expandedLegStatus}>
                        <Text
                          style={
                            leg?.status === 'success'
                              ? styles.legSuccessText
                              : styles.legFailedText
                          }
                        >
                          {leg?.status === 'success' ? '✓' : '✕'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </GlassCard>
        </TouchableOpacity>
      );
    },
    [expandedId]
  );

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing.sm,
          paddingBottom: Math.max(insets.bottom, 16) + spacing.xs,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.backPlaceholder} />
      </View>

      <FlatList<TransactionRecord>
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.scrollContent}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={5}
        ListHeaderComponent={
          <>
            {/* Prominent Data Notice Card */}
            <GlassCard elevated style={styles.noticeCard}>
              <View style={styles.noticeHeader}>
                <AppIcon name="info" size={16} color="#38BDF8" />
                <Text style={styles.noticeTitle}>Important Data Notice</Text>
              </View>
              <Text style={styles.noticeText}>
                Deleting or clearing data of the app will remove all transaction history.
                Please ensure to save receipts to your gallery if you need permanent records.
              </Text>
              <Text style={styles.noticeSubText}>
                All payment details remain permanently accessible inside the respective UPI app used for payment.
              </Text>
            </GlassCard>

            {(records?.length ?? 0) > 0 && (
              <Text style={styles.listHeader}>Recent Payments ({records.length})</Text>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrapper}>
              <AppIcon name="card" size={36} color="#475569" />
            </View>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Completed direct payments and split instalments will appear here automatically.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                try {
                  navigation?.navigate?.('Scanner');
                } catch (err: unknown) {
                  console.warn('[HistoryScreen] Navigate to Scanner error:', err);
                }
              }}
              style={styles.scanButton}
            >
              <Text style={styles.scanButtonText}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070B',
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.headingSm,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  backPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  noticeCard: {
    padding: spacing.md,
    backgroundColor: 'rgba(34, 211, 238, 0.05)',
    borderColor: 'rgba(34, 211, 238, 0.2)',
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  noticeIcon: {
    fontSize: 14,
  },
  noticeTitle: {
    ...typography.captionMedium,
    color: colors?.accentEnd ?? '#00D9F5',
    fontSize: 12,
    fontWeight: '700',
  },
  noticeText: {
    ...typography.caption,
    color: '#8E92A8',
    fontSize: 12,
    lineHeight: 17,
  },
  noticeSubText: {
    ...typography.caption,
    color: colors?.textFaint ?? '#5A5F73',
    fontSize: 11,
    lineHeight: 15,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: spacing.xl,
  },
  emptyIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  scanButton: {
    backgroundColor: colors.primaryButton ?? '#6338F2',
    borderWidth: 1,
    borderColor: colors.primaryButtonBorder ?? '#7C5CFF',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii?.md ?? 12,
  },
  scanButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  listContainer: {
    gap: spacing.sm,
  },
  listHeader: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    letterSpacing: 1,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  recordCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  payeeInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  recordPayee: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  recordVpa: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontFamily: 'monospace',
    fontSize: 11,
    marginTop: 2,
  },
  amountInfo: {
    alignItems: 'flex-end',
  },
  recordAmount: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii?.pill ?? 9999,
    marginTop: 4,
  },
  badgeSuccess: {
    backgroundColor: 'rgba(0, 245, 160, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.3)',
  },
  badgePartial: {
    backgroundColor: 'rgba(255, 176, 32, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.3)',
  },
  statusBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
  },
  textSuccess: {
    color: colors?.success ?? '#2BD9A0',
  },
  textPartial: {
    color: colors?.warning ?? '#FFB020',
  },
  recordMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  recordDate: {
    ...typography.caption,
    color: colors?.textFaint ?? '#5A5F73',
    fontSize: 11,
  },
  modeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  modeText: {
    ...typography.caption,
    color: colors?.accentEnd ?? '#00D9F5',
    fontWeight: '600',
    fontSize: 11,
  },
  appBadge: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 10,
  },
  expandChevron: {
    ...typography.caption,
    color: colors?.accentEnd ?? '#00D9F5',
    fontSize: 10,
    marginLeft: 2,
  },
  expandedSection: {
    marginTop: spacing.md,
  },
  expandedDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: spacing.sm,
  },
  expandedTitle: {
    ...typography.captionMedium,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  expandedLegRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  legIndexBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  legIndexNum: {
    ...typography.caption,
    color: colors?.textMuted ?? '#8E92A8',
    fontSize: 10,
    fontWeight: '700',
  },
  expandedLegDetails: {
    flex: 1,
  },
  expandedLegAmt: {
    ...typography.bodyMedium,
    color: colors?.textPrimary ?? '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  expandedLegRef: {
    ...typography.caption,
    color: colors?.textFaint ?? '#5A5F73',
    fontFamily: 'monospace',
    fontSize: 10,
    marginTop: 1,
  },
  expandedLegStatus: {
    marginLeft: spacing.sm,
  },
  legSuccessText: {
    color: colors?.success ?? '#2BD9A0',
    fontWeight: '800',
    fontSize: 13,
  },
  legFailedText: {
    color: colors?.danger ?? '#EF4444',
    fontWeight: '800',
    fontSize: 13,
  },
});
