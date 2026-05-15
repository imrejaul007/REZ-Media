/**
 * Perk Management Admin Page
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';

type PerkType = 'discount' | 'upgrade' | 'access' | 'cashback' | 'coin_bonus';
type PerkStatus = 'active' | 'used' | 'expired' | 'revoked';

const PERK_TYPE_CONFIG: Record<PerkType, { label: string; icon: string; color: string }> = {
  discount: { label: 'Discount', icon: 'pricetag', color: Colors.success },
  upgrade: { label: 'Upgrade', icon: 'arrow-up', color: Colors.info },
  access: { label: 'Access', icon: 'key', color: Colors.warning },
  cashback: { label: 'Cashback', icon: 'cash', color: Colors.primary },
  coin_bonus: { label: 'Coin Bonus', icon: 'diamond', color: '#F59E0B' },
};

const MOCK_PERKS = [
  { _id: '1', name: '10% Off All Orders', description: 'Get 10% discount on all ReZ orders', type: 'discount' as PerkType, status: 'active' as PerkStatus, claimCount: 234, totalClaims: 500 },
  { _id: '2', name: 'Priority Booking', description: 'Book popular events before others', type: 'upgrade' as PerkType, status: 'active' as PerkStatus, claimCount: 156, totalClaims: 300 },
  { _id: '3', name: 'Elite Badge', description: 'Exclusive Elite tier badge', type: 'access' as PerkType, status: 'active' as PerkStatus, claimCount: 89, totalClaims: 200 },
  { _id: '4', name: '5% Cashback', description: 'Get 5% cashback on purchases', type: 'cashback' as PerkType, status: 'active' as PerkStatus, claimCount: 445, totalClaims: 1000 },
  { _id: '5', name: '+50 ReZ Coins', description: 'Bonus coins on first conversion', type: 'coin_bonus' as PerkType, status: 'active' as PerkStatus, claimCount: 178, totalClaims: 250 },
  { _id: '6', name: 'VIP Event Access', description: 'Exclusive access to VIP events', type: 'access' as PerkType, status: 'expired' as PerkStatus, claimCount: 50, totalClaims: 100 },
];

function AdminHeader() {
  return (
    <LinearGradient colors={['#7C3AED', '#8B5CF6', '#A78BFA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" size={18} color="#fff" />
            </View>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Perk Management</Text>
            <Text style={styles.headerSubtitle}>Rewards & Benefits</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function PerkCard({ perk }: { perk: typeof MOCK_PERKS[0] }) {
  const config = PERK_TYPE_CONFIG[perk.type];
  const statusColors: Record<PerkStatus, string> = {
    active: Colors.success,
    used: Colors.info,
    expired: Colors.gray400,
    revoked: Colors.error,
  };

  return (
    <View style={[styles.perkCard, shadows.sm]}>
      <View style={[styles.perkIcon, { backgroundColor: config.color + '20' }]}>
        <Ionicons name={config.icon as any} size={24} color={config.color} />
      </View>
      <View style={styles.perkContent}>
        <View style={styles.perkHeader}>
          <Text style={styles.perkName}>{perk.name}</Text>
          <View style={[styles.perkStatus, { backgroundColor: (statusColors[perk.status] ?? Colors.gray500) + '20' }]}>
            <Text style={[styles.perkStatusText, { color: statusColors[perk.status] ?? Colors.gray500 }]}>
              {perk.status}
            </Text>
          </View>
        </View>
        <Text style={styles.perkDesc}>{perk.description}</Text>
        <View style={styles.perkMeta}>
          <View style={[styles.typeBadge, { backgroundColor: config.color + '15' }]}>
            <Text style={[styles.typeBadgeText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.perkClaims}>{perk.claimCount}/{perk.totalClaims} claimed</Text>
        </View>
        <View style={styles.perkBar}>
          <View style={[styles.perkBarFill, { width: `${(perk.claimCount / perk.totalClaims) * 100}%`, backgroundColor: config.color }]} />
        </View>
      </View>
    </View>
  );
}

export default function PerkManagement() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<PerkType | ''>('');

  const filtered = MOCK_PERKS.filter((p) => {
    if (selectedType && p.type !== selectedType) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <View style={styles.container}>
      <AdminHeader />
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search perks..."
            placeholderTextColor={Colors.gray400}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Type filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll} contentContainerStyle={styles.typeContent}>
        <Pressable
          style={[styles.typeFilter, !selectedType && styles.typeFilterActive]}
          onPress={() => setSelectedType('')}
        >
          <Text style={[styles.typeFilterText, !selectedType && styles.typeFilterTextActive]}>All</Text>
        </Pressable>
        {(Object.keys(PERK_TYPE_CONFIG) as PerkType[]).map((type) => (
          <Pressable
            key={type}
            style={[styles.typeFilter, selectedType === type && styles.typeFilterActive]}
            onPress={() => setSelectedType(type)}
          >
            <Ionicons
              name={PERK_TYPE_CONFIG[type].icon as any}
              size={14}
              color={selectedType === type ? '#fff' : Colors.gray600}
            />
            <Text style={[styles.typeFilterText, selectedType === type && styles.typeFilterTextActive]}>
              {PERK_TYPE_CONFIG[type].label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{MOCK_PERKS.length}</Text>
          <Text style={styles.statLabel}>Total Perks</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{MOCK_PERKS.filter((p) => p.status === 'active').length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{MOCK_PERKS.reduce((s, p) => s + p.claimCount, 0)}</Text>
          <Text style={styles.statLabel}>Total Claims</Text>
        </View>
      </View>

      <FlashList
        data={filtered}
        
        renderItem={({ item }) => <PerkCard perk={item} />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray50 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, minHeight: 56 },
  headerLeft: { width: 44, alignItems: 'flex-start' },
  headerCenter: { flex: 1, alignItems: 'center' },
  adminBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { ...Typography.h4, fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
  searchContainer: { paddingHorizontal: Spacing.base, paddingTop: Spacing.sm },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 8, ...shadows.sm },
  searchInput: { flex: 1, fontSize: 15, color: Colors.gray800 },
  typeScroll: { marginTop: Spacing.sm, maxHeight: 44 },
  typeContent: { paddingHorizontal: Spacing.base, gap: Spacing.sm, paddingVertical: Spacing.xs },
  typeFilter: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 6, gap: 4, ...shadows.sm },
  typeFilterActive: { backgroundColor: Colors.primary },
  typeFilterText: { fontSize: 13, color: Colors.gray600, fontWeight: '600' },
  typeFilterTextActive: { color: '#fff' },
  statsRow: { flexDirection: 'row', padding: Spacing.base, gap: Spacing.sm },
  statCard: { flex: 1, backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', ...shadows.sm },
  statValue: { ...Typography.h3, color: Colors.gray800 },
  statLabel: { fontSize: 11, color: Colors.gray500, marginTop: 2 },
  listContent: { padding: Spacing.base },
  perkCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  perkIcon: { width: 48, height: 48, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  perkContent: { flex: 1, marginLeft: 12 },
  perkHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  perkName: { ...Typography.bodyBold, color: Colors.gray800, flex: 1 },
  perkStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  perkStatusText: { fontSize: 11, fontWeight: '700' },
  perkDesc: { fontSize: 13, color: Colors.gray500, marginTop: 4 },
  perkMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  perkClaims: { fontSize: 12, color: Colors.gray500 },
  perkBar: { height: 4, backgroundColor: Colors.gray100, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  perkBarFill: { height: 4, borderRadius: 2 },
});
