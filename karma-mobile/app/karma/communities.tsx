/**
 * Communities Screen
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import karmaService, { Community } from '@/services/karmaService';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';
import { CATEGORY_CONFIG } from '@/types/karma';

function CommunityCard({ community, onPress }: { community: Community; onPress: () => void }) {
  const cat = CATEGORY_CONFIG[community.category] ?? CATEGORY_CONFIG.community;

  return (
    <Pressable style={[styles.communityCard, shadows.md]} onPress={onPress}>
      <View style={[styles.communityCover, { backgroundColor: cat.bgColor }]}>
        <Ionicons name={cat.icon as any} size={32} color={cat.color} />
      </View>
      <View style={styles.communityContent}>
        <Text style={styles.communityName}>{community.name}</Text>
        <Text style={styles.communityDesc} numberOfLines={2}>{community.description}</Text>
        <View style={styles.communityStats}>
          <View style={styles.communityStat}>
            <Ionicons name="people" size={14} color={Colors.gray500} />
            <Text style={styles.communityStatText}>{community.followerCount.toLocaleString()} members</Text>
          </View>
          <View style={styles.communityStat}>
            <Ionicons name="calendar" size={14} color={Colors.gray500} />
            <Text style={styles.communityStatText}>{community.stats.eventsHosted} events</Text>
          </View>
        </View>
        <View style={[styles.categoryBadge, { backgroundColor: cat.bgColor }]}>
          <Text style={[styles.categoryBadgeText, { color: cat.color }]}>{cat.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function Communities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadCommunities = useCallback(async () => {
    try {
      const res = await karmaService.getCommunities();
      if (res.success && res.data) setCommunities(res.data);
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadCommunities();
  }, [loadCommunities]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCommunities();
    setRefreshing(false);
  }, [loadCommunities]);

  return (
    <View style={styles.container}>
      <KarmaHeader title="Communities" subtitle="Join the cause" showBack />
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : communities.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="people-outline" size={64} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>No communities yet</Text>
        </View>
      ) : (
        <FlashList
          data={communities}
          renderItem={({ item }) => (
            <CommunityCard
              community={item}
              onPress={() => router.push(`/karma/communities/${item.slug}`)}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        />
      )}
    </View>
  );
}

// Needed for useFocusEffect
import { useFocusEffect } from 'expo-router';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Spacing.base },
  communityCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, overflow: 'hidden' },
  communityCover: { height: 80, justifyContent: 'center', alignItems: 'center' },
  communityContent: { padding: Spacing.md },
  communityName: { ...Typography.bodyBold, color: Colors.gray800, marginBottom: 4 },
  communityDesc: { fontSize: 13, color: Colors.gray500, marginBottom: 8 },
  communityStats: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  communityStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  communityStatText: { fontSize: 12, color: Colors.gray500 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  categoryBadgeText: { fontSize: 11, fontWeight: '700' },
  emptyTitle: { ...Typography.h4, color: Colors.gray500, marginTop: 16 },
});
