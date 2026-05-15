/**
 * Event Detail Screen
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import karmaService, { KarmaEvent } from '@/services/karmaService';
import { KarmaHeader } from '../_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';
import { CATEGORY_CONFIG, DIFFICULTY_CONFIG } from '@/types/karma';

const VERIFICATION_ICONS: Record<string, string> = {
  qr: 'qr-code',
  gps: 'location',
  manual: 'hand-left',
};

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<KarmaEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    try {
      const res = await karmaService.getEventDetail(id);
      if (res.success && res.data) setEvent(res.data);
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { loadEvent(); }, [loadEvent]);

  const handleJoin = useCallback(async () => {
    if (!id) return;
    setJoining(true);
    try {
      const res = await karmaService.joinEvent(id);
      if (res.success) {
        Alert.alert('Success', 'You have joined this event!');
        loadEvent();
      } else {
        Alert.alert('Error', res.message || 'Failed to join event');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to join event');
    } finally {
      setJoining(false);
    }
  }, [id, loadEvent]);

  if (loading) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Event" showBack />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Event" showBack />
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={64} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>Event not found</Text>
        </View>
      </View>
    );
  }

  const cat = CATEGORY_CONFIG[event.category] ?? CATEGORY_CONFIG.community;
  const diff = DIFFICULTY_CONFIG[event.difficulty] ?? DIFFICULTY_CONFIG.easy;
  const verIcon = VERIFICATION_ICONS[event.verificationMode] ?? 'qr-code';

  return (
    <View style={styles.container}>
      <KarmaHeader title={event.name} showBack />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Hero */}
        <LinearGradient colors={cat.bgColor as any} style={styles.heroSection}>
          <View style={styles.heroContent}>
            <View style={[styles.categoryBadge, { backgroundColor: cat.color + '20' }]}>
              <Ionicons name={cat.icon as any} size={16} color={cat.color} />
              <Text style={[styles.categoryText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            <Text style={styles.heroTitle}>{event.name}</Text>
            <View style={styles.heroMeta}>
              <Ionicons name="location" size={16} color={Colors.gray600} />
              <Text style={styles.heroLocation}>{event.location.city ?? event.location.address}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="leaf" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{event.baseKarmaPerHour} KP/hr</Text>
            <Text style={styles.statLabel}>Karma Rate</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="speedometer" size={20} color={diff.color} />
            <Text style={[styles.statValue, { color: diff.color }]}>{diff.label}</Text>
            <Text style={styles.statLabel}>Difficulty</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="people" size={20} color={Colors.success} />
            <Text style={styles.statValue}>{event.confirmedVolunteers}/{event.maxVolunteers}</Text>
            <Text style={styles.statLabel}>Volunteers</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name={verIcon as any} size={20} color={Colors.info} />
            <Text style={[styles.statValue, { color: Colors.info }]}>{event.verificationMode.toUpperCase()}</Text>
            <Text style={styles.statLabel}>Verify</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>{event.description}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={18} color={Colors.gray500} />
            <Text style={styles.detailText}>{new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
          </View>
          {event.time && (
            <View style={styles.detailRow}>
              <Ionicons name="time" size={18} color={Colors.gray500} />
              <Text style={styles.detailText}>{event.time.start} — {event.time.end}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Ionicons name="hourglass" size={18} color={Colors.gray500} />
            <Text style={styles.detailText}>{event.expectedDurationHours}h expected</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="trophy" size={18} color={Colors.gray500} />
            <Text style={styles.detailText}>Up to {event.maxKarmaPerEvent} KP per event</Text>
          </View>
          {event.impactUnit && (
            <View style={styles.detailRow}>
              <Ionicons name="heart" size={18} color={Colors.error} />
              <Text style={styles.detailText}>Impact: {event.impactUnit} (x{event.impactMultiplier})</Text>
            </View>
          )}
        </View>

        {/* Organizer */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organizer</Text>
          <View style={styles.organizerCard}>
            <View style={styles.organizerAvatar}>
              <Ionicons name="business" size={24} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.organizerName}>{event.organizer.name}</Text>
              <Text style={styles.organizerLabel}>Event Organizer</Text>
            </View>
          </View>
        </View>

        {/* CTA */}
        {!event.isJoined && event.status !== 'completed' && (
          <View style={styles.ctaContainer}>
            <Pressable style={styles.joinButton} onPress={handleJoin} disabled={joining}>
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.joinButtonText}>Join Event</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  heroSection: { padding: Spacing.xl, borderBottomLeftRadius: BorderRadius.xxl, borderBottomRightRadius: BorderRadius.xxl },
  heroContent: { alignItems: 'center' },
  categoryBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, gap: 6, marginBottom: 12 },
  categoryText: { fontSize: 13, fontWeight: '700' },
  heroTitle: { ...Typography.h2, color: Colors.gray800, textAlign: 'center', marginBottom: 8 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  heroLocation: { fontSize: 14, color: Colors.gray600 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: Spacing.base, gap: Spacing.sm },
  statCard: { width: '48%', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, alignItems: 'center', ...shadows.sm },
  statValue: { ...Typography.h4, color: Colors.primary, marginTop: 6 },
  statLabel: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.lg },
  sectionTitle: { ...Typography.bodyBold, color: Colors.gray800, marginBottom: 8 },
  description: { ...Typography.body, color: Colors.gray600, lineHeight: 24 },
  detailsCard: { marginHorizontal: Spacing.base, marginTop: Spacing.md, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, ...shadows.sm },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  detailText: { ...Typography.body, color: Colors.gray700 },
  organizerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.base, gap: 12, ...shadows.sm },
  organizerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center' },
  organizerName: { ...Typography.bodyBold, color: Colors.gray800 },
  organizerLabel: { fontSize: 12, color: Colors.gray500 },
  emptyTitle: { ...Typography.h4, color: Colors.gray600, marginTop: 16 },
  ctaContainer: { padding: Spacing.base, marginTop: Spacing.lg },
  joinButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  joinButtonText: { ...Typography.bodyBold, color: '#fff' },
});
