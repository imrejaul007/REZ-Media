import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { Screen, Earnings } from '../types';

export default function DashboardScreen() {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [screensData, earningsData] = await Promise.all([
      api.getScreens(),
      api.getEarnings(),
    ]);
    setScreens(screensData);
    setEarnings(earningsData);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const onlineCount = screens.filter(s => s.status === 'online').length;
  const totalImpressions = screens.reduce((sum, s) => sum + s.impressions, 0);

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good morning!</Text>
        <Text style={styles.subtitle}>{onlineCount} of {screens.length} screens online</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#6366f1' }]}>
          <Ionicons name="eye" size={24} color="white" />
          <Text style={styles.statValue}>{totalImpressions.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Views</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#10b981' }]}>
          <Ionicons name="cash" size={24} color="white" />
          <Text style={styles.statValue}>₹{earnings?.thisMonth.toFixed(0) || '0'}</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
      </View>

      {/* Pending Payout */}
      <View style={styles.payoutCard}>
        <View>
          <Text style={styles.payoutLabel}>Pending Payout</Text>
          <Text style={styles.payoutValue}>₹{earnings?.pending.toFixed(2) || '0.00'}</Text>
        </View>
        <TouchableOpacity style={styles.payoutButton}>
          <Text style={styles.payoutButtonText}>Request Payout</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="add-circle" size={28} color="#6366f1" />
          <Text style={styles.actionLabel}>Add Screen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="analytics" size={28} color="#6366f1" />
          <Text style={styles.actionLabel}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="settings" size={28} color="#6366f1" />
          <Text style={styles.actionLabel}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Screens List */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Screens</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See All</Text>
          </TouchableOpacity>
        </View>
        {screens.map(screen => (
          <TouchableOpacity key={screen.id} style={styles.screenCard}>
            <View style={styles.screenIcon}>
              <Ionicons
                name={screen.type === 'led' ? 'tv' : screen.type === 'tablet' ? 'tablet-portrait' : 'apps'}
                size={24}
                color="#6366f1"
              />
            </View>
            <View style={styles.screenInfo}>
              <Text style={styles.screenName}>{screen.name}</Text>
              <Text style={styles.screenLocation}>{screen.location}</Text>
              <View style={styles.screenStats}>
                <Text style={styles.screenStat}>{screen.impressions.toLocaleString()} views</Text>
                <Text style={styles.screenDot}>•</Text>
                <Text style={styles.screenStat}>₹{screen.todayEarnings.toFixed(0)} today</Text>
              </View>
            </View>
            <View style={[
              styles.statusBadge,
              { backgroundColor: screen.status === 'online' ? '#dcfce7' : '#fee2e2' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: screen.status === 'online' ? '#16a34a' : '#dc2626' }
              ]}>
                {screen.status.toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 20, paddingTop: 10 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 16 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  payoutCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 20, padding: 16, backgroundColor: 'white', borderRadius: 12 },
  payoutLabel: { fontSize: 12, color: '#6b7280' },
  payoutValue: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  payoutButton: { backgroundColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  payoutButtonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, marginHorizontal: 20, backgroundColor: 'white', borderRadius: 12 },
  actionButton: { alignItems: 'center' },
  actionLabel: { fontSize: 12, color: '#6b7280', marginTop: 8 },
  section: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  seeAll: { fontSize: 14, color: '#6366f1', fontWeight: '500' },
  screenCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12 },
  screenIcon: { width: 48, height: 48, backgroundColor: '#f3f4f6', borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  screenInfo: { flex: 1, marginLeft: 12 },
  screenName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  screenLocation: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  screenStats: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  screenStat: { fontSize: 12, color: '#9ca3af' },
  screenDot: { marginHorizontal: 6, color: '#9ca3af' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '600' },
});
