import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { RootStackParamList } from '../types';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { BackButton } from '../components/BackButton';
import { GlassCard } from '../components/GlassCard';
import { AppIcon } from '../components/AppIcon';
import { APP_VERSION, GITHUB_REPO } from '../constants/version';

type Props = NativeStackScreenProps<RootStackParamList, 'About'>;

/**
 * About & Information Screen.
 * Explains NoFeePe's core mission: avoiding MDR charges on P2M transactions above ₹2,000
 * by automatically splitting payments into installments capped at ₹1,999 each.
 */
export const AboutScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    try {
      ReactNativeHapticFeedback.trigger('selection', {
        enableVibrateFallback: true,
      });
    } catch {}
    navigation.goBack();
  };

  const handleOpenGitHub = () => {
    try {
      ReactNativeHapticFeedback.trigger('selection', {
        enableVibrateFallback: true,
      });
    } catch {}
    Linking.openURL(GITHUB_REPO).catch(() => {});
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, 16),
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <Text style={styles.headerTitle}>About NoFeePe</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Brand / Hero Header Card */}
        <GlassCard elevated style={styles.heroCard}>
          <View style={styles.logoFrame}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.brandTitle}>NoFee<Text style={styles.brandAccent}>Pe</Text></Text>
            <View style={styles.versionBadge}>
              <Text style={styles.versionText}>v{APP_VERSION}</Text>
            </View>
          </View>
          <Text style={styles.brandTagline}>Zero-MDR Smart UPI Payment Utility</Text>
          <Text style={styles.creditLine}>Developed by Mayank Nasa</Text>

          <View style={styles.pillContainer}>
            <AppIcon name="shield" size={13} color="#38BDF8" />
            <Text style={styles.pillText}>100% Offline • Zero MDR • Free</Text>
          </View>
        </GlassCard>

        {/* Why NoFeePe / MDR Charges Card */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.cardHeadingRow}>
            <AppIcon name="info" size={16} color="#38BDF8" />
            <Text style={styles.cardHeading}>Why NoFeePe?</Text>
          </View>
          <Text style={styles.bodyText}>
            NoFeePe is created to avoid <Text style={styles.highlight}>Merchant Discount Rate (MDR)</Text> charges,
            which are levied on Person-to-Merchant (P2M) transactions above <Text style={styles.highlight}>₹2,000</Text>.
          </Text>
          <Text style={styles.bodyText}>
            The app automatically splits your payment into consecutive installments strictly capped at{' '}
            <Text style={styles.accentHighlight}>multiples of ₹1,999</Text>, ensuring zero extra MDR charges for either you or the merchant.
          </Text>
        </GlassCard>

        {/* Split & Pay Details */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.cardHeadingRow}>
            <AppIcon name="card" size={16} color="#38BDF8" />
            <Text style={styles.cardHeading}>How Split & Pay Works</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletSymbol}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.highlight}>Capped at ₹1,999:</Text> Keeps each installment strictly under the ₹2,000 threshold.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletSymbol}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.highlight}>Sub-Rupee Rebalancing:</Text> Fractions and odd remainders are evenly balanced so no payment falls below the UPI floor of ₹1.00.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletSymbol}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.highlight}>One-Tap Approvals:</Text> Approve each installment seamlessly in your favorite UPI app (PhonePe, Google Pay, Paytm, BHIM, CRED, Navi, etc.).
            </Text>
          </View>
        </GlassCard>

        {/* Understanding UPI Limits: P2P vs P2M Card */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.cardHeadingRow}>
            <AppIcon name="history" size={16} color="#38BDF8" />
            <Text style={styles.cardHeading}>Understanding UPI Daily Limits</Text>
          </View>
          <Text style={styles.bodyText}>
            The National Payments Corporation of India (NPCI) and retail banks enforce daily transaction
            guidelines. How these limits apply depends on whether you are paying an individual or a verified merchant:
          </Text>

          {/* P2P Section */}
          <View style={styles.subSection}>
            <Text style={styles.subHeading}>1. Person-to-Person (P2P) Transfers</Text>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.highlight}>20 Transfers per Day:</Text> Standard transfers between personal bank accounts are capped at a strict 20 transactions per rolling 24-hour cycle.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.highlight}>Account-Wide Aggregation:</Text> This cap is combined across all UPI apps linked to that bank account (e.g. 10 payments on Google Pay, 5 on PhonePe, and 5 on Paytm reaches the ceiling). Switching apps does not reset your count.
              </Text>
            </View>
          </View>

          {/* P2M Section */}
          <View style={styles.subSection}>
            <Text style={styles.subHeading}>2. Person-to-Merchant (P2M) Payments</Text>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.highlight}>Relaxed Frequency Cap:</Text> For payments to verified merchant QR codes (grocery stores, fuel pumps, restaurants, pharmacies), the 20-transaction count limit is generally relaxed or omitted by major banks (including SBI, HDFC, ICICI).
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletSymbol}>•</Text>
              <Text style={styles.bulletText}>
                <Text style={styles.highlight}>Amount-Based Cap:</Text> Merchant payments are instead bounded by the daily cumulative monetary cap (typically ₹1 Lakh to ₹5 Lakh, depending on the merchant category).
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* UPI Lite & 20-Leg Safety Guard Card */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.cardHeadingRow}>
            <AppIcon name="sparkle" size={16} color={colors?.textPurpleLight ?? '#C4B5FD'} />
            <Text style={styles.cardHeading}>Bypassing Caps & The 20-Leg Guard</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletSymbol}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.highlight}>UPI Lite for Micro-Payments:</Text> If you make frequent small payments, activating UPI Lite in your preferred UPI app allows pinless payments up to ₹1,000. UPI Lite transactions debit an on-device balance and do not route through your bank’s core servers—meaning they <Text style={styles.accentHighlight}>do not count</Text> toward your 20-transaction daily limit.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletSymbol}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.highlight}>NoFeePe's 20-Leg Safety Guard:</Text> To ensure your split payments never fail due to bank-side frequency limits on P2P or strict accounts, NoFeePe caps split plans to a maximum of <Text style={styles.accentHighlight}>20 installments</Text> (up to ₹39,980). Higher amounts are automatically directed to Pay Direct.
            </Text>
          </View>
        </GlassCard>

        {/* Security & Privacy */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.cardHeadingRow}>
            <AppIcon name="shield" size={16} color="#00E676" />
            <Text style={styles.cardHeading}>100% Private & Offline</Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletSymbol}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.highlight}>Zero Remote Servers:</Text> Runs entirely on your phone. No tracking, analytics, or external servers.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletSymbol}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.highlight}>Zero Access to Secrets:</Text> Never sees, asks for, or stores your UPI PIN, bank details, card numbers, or OTPs.
            </Text>
          </View>
          <View style={styles.bulletRow}>
            <Text style={styles.bulletSymbol}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.highlight}>Direct Intent Handoff:</Text> Uses Android's official <Text style={styles.codeSnippet}>upi://pay</Text> scheme for secure execution.
            </Text>
          </View>
        </GlassCard>

        {/* Technical Specs & GitHub */}
        <GlassCard style={styles.infoCard}>
          <View style={styles.cardHeadingRow}>
            <AppIcon name="lock" size={16} color="#94A3B8" />
            <Text style={styles.cardHeading}>Application Details</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specKey}>Package ID</Text>
            <Text style={styles.specValue}>com.nasa.nofeepe</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specKey}>Architecture</Text>
            <Text style={styles.specValue}>React Native 0.87 • TypeScript</Text>
          </View>
          <View style={styles.specRow}>
            <Text style={styles.specKey}>Developer</Text>
            <Text style={styles.specValue}>Mayank Nasa</Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.82}
            onPress={handleOpenGitHub}
            style={styles.githubButton}
            accessibilityLabel="View project on GitHub"
          >
            <Text style={styles.githubButtonText}>View Source on GitHub ↗</Text>
          </TouchableOpacity>
        </GlassCard>

        {/* Footer Credit */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>Crafted by Mayank Nasa</Text>
        </View>
      </ScrollView>
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
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerTitle: {
    ...typography.headingSm,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerPlaceholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#11121C',
    borderWidth: 1,
    borderColor: '#24263A',
    borderRadius: 20,
  },
  logoFrame: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginBottom: 4,
  },
  brandTitle: {
    ...typography.headingMd,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: colors?.accentEnd ?? '#00D9F5',
  },
  versionBadge: {
    backgroundColor: 'rgba(0, 245, 160, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 245, 160, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  versionText: {
    ...typography.caption,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontSize: 11,
    fontWeight: '800',
  },
  brandTagline: {
    ...typography.body,
    fontSize: 13,
    color: '#8E92A8',
    marginTop: 2,
  },
  creditLine: {
    ...typography.caption,
    fontSize: 12,
    color: colors?.accentEnd ?? '#00D9F5',
    fontWeight: '600',
    marginTop: 4,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  pillText: {
    ...typography.caption,
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoCard: {
    backgroundColor: '#11121C',
    borderWidth: 1,
    borderColor: '#24263A',
    borderRadius: 18,
    padding: spacing.lg,
  },
  cardHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  cardHeading: {
    ...typography.headingSm,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  subSection: {
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  subHeading: {
    ...typography.bodyMedium,
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  bodyText: {
    ...typography.body,
    color: '#A2A6BC',
    fontSize: 13.5,
    lineHeight: 20,
    marginBottom: spacing.xs + 2,
  },
  highlight: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  accentHighlight: {
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontWeight: '700',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletSymbol: {
    color: colors?.accentEnd ?? '#00D9F5',
    fontSize: 16,
    lineHeight: 20,
    marginRight: 8,
  },
  bulletText: {
    ...typography.body,
    color: '#A2A6BC',
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
  codeSnippet: {
    fontFamily: 'monospace',
    color: colors?.textPurpleLight ?? '#C4B5FD',
    fontSize: 11.5,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  specKey: {
    ...typography.caption,
    color: '#71758A',
    fontSize: 12,
  },
  specValue: {
    ...typography.caption,
    color: '#E0E3F0',
    fontSize: 12,
    fontWeight: '600',
  },
  githubButton: {
    marginTop: spacing.md,
    borderRadius: radii?.button ?? 14,
    backgroundColor: colors?.primaryButton ?? '#6338F2',
    borderWidth: 1,
    borderColor: colors?.primaryButtonBorder ?? '#7C5CFF',
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  githubButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  footerText: {
    ...typography.caption,
    color: '#5A5F73',
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
