/**
 * Community Detail Screen
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
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import karmaService, { Community, CommunityPost } from '@/services/karmaService';
import { KarmaHeader } from '../_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';
import { CATEGORY_CONFIG } from '@/types/karma';

function PostCard({ post }: { post: CommunityPost }) {
  return (
    <View style={[styles.postCard, shadows.sm]}>
      <View style={styles.postHeader}>
        <View style={styles.postAvatar}>
          <Ionicons name="person" size={18} color={Colors.gray400} />
        </View>
        <View style={styles.postMeta}>
          <Text style={styles.postAuthor}>{post.authorType}</Text>
          <Text style={styles.postDate}>{new Date(post.createdAt).toLocaleDateString()}</Text>
        </View>
      </View>
      <Text style={styles.postContent}>{post.content}</Text>
      <View style={styles.postFooter}>
        <View style={styles.postStat}>
          <Ionicons name="heart" size={14} color={Colors.error} />
          <Text style={styles.postStatText}>{post.likeCount}</Text>
        </View>
        <View style={styles.postStat}>
          <Ionicons name="chatbubble" size={14} color={Colors.info} />
          <Text style={styles.postStatText}>{post.commentCount}</Text>
        </View>
        <View style={styles.postStat}>
          <Ionicons name="leaf" size={14} color={Colors.primary} />
          <Text style={[styles.postStatText, { color: Colors.primary }]}>+{post.karmaEarned} KP</Text>
        </View>
      </View>
    </View>
  );
}

export default function CommunityDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [following, setFollowing] = useState(false);

  const loadCommunity = useCallback(async () => {
    if (!slug) return;
    try {
      const [commRes, feedRes] = await Promise.all([
        karmaService.getCommunity(slug),
        karmaService.getCommunityFeed(slug),
      ]);
      if (commRes.success && commRes.data) {
        setCommunity(commRes.data);
        setFollowing(commRes.data.isFollowing);
      }
      if (feedRes.success && feedRes.data) {
        setPosts(feedRes.data.posts);
      }
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [slug]);

  React.useEffect(() => { loadCommunity(); }, [loadCommunity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCommunity();
    setRefreshing(false);
  }, [loadCommunity]);

  const handleFollow = useCallback(async () => {
    if (!slug) return;
    try {
      if (following) {
        const res = await karmaService.unfollowCommunity(slug);
        if (res.success) setFollowing(false);
      } else {
        const res = await karmaService.followCommunity(slug);
        if (res.success) setFollowing(true);
      }
    } catch (err) {
      Alert.alert('Error', 'Could not update follow status');
    }
  }, [slug, following]);

  if (loading) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Community" showBack />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  if (!community) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Community" showBack />
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={64} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>Community not found</Text>
        </View>
      </View>
    );
  }

  const cat = CATEGORY_CONFIG[community.category] ?? CATEGORY_CONFIG.community;

  return (
    <View style={styles.container}>
      <KarmaHeader
        title={community.name}
        showBack
        rightAction={
          <Pressable style={[styles.followButton, following && styles.followingButton]} onPress={handleFollow}>
            <Text style={[styles.followButtonText, following && styles.followingButtonText]}>
              {following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        }
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: cat.bgColor }]}>
          <Ionicons name={cat.icon as any} size={48} color={cat.color} />
          <Text style={styles.heroName}>{community.name}</Text>
          <Text style={styles.heroDesc}>{community.description}</Text>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{community.followerCount.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>Members</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{community.stats.eventsHosted}</Text>
              <Text style={styles.heroStatLabel}>Events</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{community.stats.totalVolunteers}</Text>
              <Text style={styles.heroStatLabel}>Volunteers</Text>
            </View>
          </View>
        </View>

        {/* Feed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Feed</Text>
          {posts.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  followButton: { backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full },
  followingButton: { backgroundColor: Colors.success },
  followButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  followingButtonText: { color: '#fff' },
  hero: { padding: Spacing.xl, alignItems: 'center', borderBottomLeftRadius: BorderRadius.xxl, borderBottomRightRadius: BorderRadius.xxl },
  heroName: { ...Typography.h2, color: Colors.gray800, marginTop: 12 },
  heroDesc: { fontSize: 14, color: Colors.gray600, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  heroStats: { flexDirection: 'row', marginTop: 20 },
  heroStat: { alignItems: 'center', paddingHorizontal: 16 },
  heroStatDivider: { width: 1, backgroundColor: Colors.gray300 },
  heroStatValue: { ...Typography.h4, color: Colors.gray800 },
  heroStatLabel: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  section: { padding: Spacing.base, marginTop: Spacing.md },
  sectionTitle: { ...Typography.bodyBold, color: Colors.gray800, marginBottom: Spacing.sm },
  postCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray100, justifyContent: 'center', alignItems: 'center' },
  postMeta: { marginLeft: 10 },
  postAuthor: { fontSize: 14, fontWeight: '600', color: Colors.gray800, textTransform: 'capitalize' },
  postDate: { fontSize: 12, color: Colors.gray500 },
  postContent: { ...Typography.body, color: Colors.gray700, lineHeight: 22 },
  postFooter: { flexDirection: 'row', gap: 16, marginTop: 10 },
  postStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postStatText: { fontSize: 13, color: Colors.gray500 },
  emptyTitle: { ...Typography.h4, color: Colors.gray500, marginTop: 16 },
});
