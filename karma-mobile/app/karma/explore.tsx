/**
 * Explore Screen — event listing with filters
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
  TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import karmaService, { KarmaEvent, EventFilters } from '@/services/karmaService';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';
import { CATEGORY_CONFIG } from '@/types/karma';
import type { EventCategory } from '@/types/karma';

const CATEGORIES: Array<{ key: string; label: string; icon: string }> = [
  { key: '', label: 'All', icon: 'apps' },
  { key: 'environment', label: 'Environment', icon: 'leaf' },
  { key: 'food', label: 'Food', icon: 'restaurant' },
  { key: 'health', label: 'Health', icon: 'medkit' },
  { key: 'education', label: 'Education', icon: 'school' },
  { key: 'community', label: 'Community', icon: 'people' },
];

const DIFFICULTIES = [
  { key: '', label: 'All Levels' },
  { key: 'easy', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'hard', label: 'Hard' },
];

function EventRow({ event, onPress }: { event: KarmaEvent; onPress: () => void }) {
  const cat = CATEGORY_CONFIG[event.category] ?? CATEGORY_CONFIG.community;
  return (
    <Pressable style={[styles.eventRow, shadows.sm]} onPress={onPress}>
      <View style={[styles.eventRowLeft, { backgroundColor: cat.bgColor }]}>
        <Ionicons name={cat.icon as any} size={28} color={cat.color} />
      </View>
      <View style={styles.eventRowContent}>
        <Text style={styles.eventRowName} numberOfLines={2}>{event.name}</Text>
        <View style={styles.eventRowMeta}>
          <Ionicons name="location" size={12} color={Colors.gray500} />
          <Text style={styles.eventRowLocation}>{event.location.city ?? 'Anywhere'}</Text>
        </View>
        <View style={styles.eventRowFooter}>
          <View style={[styles.eventRowBadge, { backgroundColor: cat.bgColor }]}>
            <Text style={[styles.eventRowBadgeText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <View style={styles.eventRowKarma}>
            <Ionicons name="leaf" size={14} color={Colors.primary} />
            <Text style={styles.eventRowKarmaText}>{event.baseKarmaPerHour}/hr</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function Explore() {
  const [events, setEvents] = useState<KarmaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadEvents = useCallback(async () => {
    try {
      const filters: EventFilters = {};
      if (selectedCategory) filters.category = selectedCategory;
      const res = await karmaService.getNearbyEvents(filters);
      if (res.success && res.data) {
        let evs = res.data.events;
        if (selectedDifficulty) evs = evs.filter((e) => e.difficulty === selectedDifficulty);
        if (searchQuery) evs = evs.filter((e) => e.name.toLowerCase().includes(searchQuery.toLowerCase()));
        setEvents(evs);
      }
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedDifficulty, searchQuery]);

  useFocusEffect(useCallback(() => { loadEvents(); }, [loadEvents]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  return (
    <View style={styles.container}>
      <KarmaHeader title="Explore Events" subtitle="Find your cause" showBack />

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events..."
            placeholderTextColor={Colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={Colors.gray400} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Category filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat.key}
            style={[styles.filterChip, selectedCategory === cat.key && styles.filterChipActive]}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <Ionicons name={cat.icon as any} size={14} color={selectedCategory === cat.key ? '#fff' : Colors.gray600} />
            <Text style={[styles.filterChipText, selectedCategory === cat.key && styles.filterChipTextActive]}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Difficulty filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
        {DIFFICULTIES.map((diff) => (
          <Pressable
            key={diff.key}
            style={[styles.diffChip, selectedDifficulty === diff.key && styles.diffChipActive]}
            onPress={() => setSelectedDifficulty(diff.key)}
          >
            <Text style={[styles.diffChipText, selectedDifficulty === diff.key && styles.diffChipTextActive]}>{diff.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      ) : events.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color={Colors.gray300} />
          <Text style={styles.emptyTitle}>No events found</Text>
          <Text style={styles.emptySub}>Try adjusting your filters</Text>
        </View>
      ) : (
        <FlashList
          data={events}
          
          renderItem={({ item }) => (
            <EventRow
              event={item}
              onPress={() => {}}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 8, ...shadows.sm },
  searchInput: { flex: 1, fontSize: 15, color: Colors.gray800 },
  filtersScroll: { marginTop: Spacing.sm },
  filtersContent: { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingBottom: Spacing.sm },
  filterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 6, gap: 4, ...shadows.sm },
  filterChipActive: { backgroundColor: Colors.primary },
  filterChipText: { fontSize: 13, color: Colors.gray600, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  diffChip: { borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.white, ...shadows.sm },
  diffChipActive: { backgroundColor: Colors.primaryDark },
  diffChipText: { fontSize: 12, color: Colors.gray600, fontWeight: '600' },
  diffChipTextActive: { color: '#fff' },
  listContent: { padding: Spacing.base },
  eventRow: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  eventRowLeft: { width: 56, height: 56, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  eventRowContent: { flex: 1, marginLeft: Spacing.md },
  eventRowName: { ...Typography.bodyBold, color: Colors.gray800, marginBottom: 4 },
  eventRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  eventRowLocation: { fontSize: 12, color: Colors.gray500 },
  eventRowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventRowBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  eventRowBadgeText: { fontSize: 11, fontWeight: '600' },
  eventRowKarma: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventRowKarmaText: { fontSize: 13, color: Colors.primary, fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { ...Typography.h4, color: Colors.gray600, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.gray400, marginTop: 4 },
});
