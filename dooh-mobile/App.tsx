/**
 * dooh-mobile - DOOH Screen Owner Companion App
 * React Native/Expo app for managing digital screens
 */

import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, TextInput, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Types
interface Screen {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'paused';
  impressions: number;
  todayEarnings: number;
  lastUpdated: string;
}

// Mock data
const mockScreens: Screen[] = [
  { id: '1', name: 'Lobby Display', location: 'Hotel Reception', status: 'online', impressions: 12450, todayEarnings: 234.50, lastUpdated: '2 min ago' },
  { id: '2', name: 'Restaurant Screen', location: 'Cafe Corner', status: 'online', impressions: 8920, todayEarnings: 156.00, lastUpdated: '5 min ago' },
  { id: '3', name: 'Gym Entrance', location: 'Fitness Center', status: 'offline', impressions: 0, todayEarnings: 0, lastUpdated: '1 hour ago' },
];

// API Configuration
const API_BASE = process.env.EXPO_PUBLIC_DOOH_API_URL || 'http://localhost:4004';

// Screen Card Component
function ScreenCard({ screen, onPress }: { screen: Screen; onPress: () => void }) {
  const statusColors = {
    online: '#10b981',
    offline: '#ef4444',
    paused: '#f59e0b',
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.screenName}>{screen.name}</Text>
          <Text style={styles.location}>{screen.location}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColors[screen.status] }]}>
          <Text style={styles.statusText}>{screen.status.toUpperCase()}</Text>
        </View>
      </View>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{screen.impressions.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Impressions Today</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>₹{screen.todayEarnings.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Earnings</Text>
        </View>
      </View>
      <Text style={styles.updated}>Updated {screen.lastUpdated}</Text>
    </TouchableOpacity>
  );
}

// Screen Details Modal
function ScreenDetails({ screen, onClose }: { screen: Screen; onClose: () => void }) {
  return (
    <View style={styles.modal}>
      <Text style={styles.modalTitle}>{screen.name}</Text>
      <Text style={styles.modalSubtitle}>{screen.location}</Text>
      <View style={styles.modalStats}>
        <View style={styles.modalStat}>
          <Text style={styles.modalStatValue}>{screen.impressions.toLocaleString()}</Text>
          <Text style={styles.modalStatLabel}>Total Impressions</Text>
        </View>
        <View style={styles.modalStat}>
          <Text style={styles.modalStatValue}>₹{screen.todayEarnings.toFixed(2)}</Text>
          <Text style={styles.modalStatLabel}>Today's Earnings</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.actionBtn} onPress={onClose}>
        <Text style={styles.actionBtnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

// Main App
export default function App() {
  const [screens] = useState<Screen[]>(mockScreens);
  const [search, setSearch] = useState('');
  const [selectedScreen, setSelectedScreen] = useState<Screen | null>(null);

  const filteredScreens = screens.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.location.toLowerCase().includes(search.toLowerCase())
  );

  const totalImpressions = screens.reduce((sum, s) => sum + s.impressions, 0);
  const totalEarnings = screens.reduce((sum, s) => sum + s.todayEarnings, 0);
  const onlineScreens = screens.filter(s => s.status === 'online').length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Screens</Text>
        <Text style={styles.subtitle}>{onlineScreens} of {screens.length} online</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: '#6366f1' }]}>
          <Ionicons name="eye" size={24} color="white" />
          <Text style={styles.statCardValue}>{totalImpressions.toLocaleString()}</Text>
          <Text style={styles.statCardLabel}>Total Views</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#10b981' }]}>
          <Ionicons name="cash-outline" size={24} color="white" />
          <Text style={styles.statCardValue}>₹{totalEarnings.toFixed(0)}</Text>
          <Text style={styles.statCardLabel}>Today's Earnings</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search screens..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Screen List */}
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {filteredScreens.map(screen => (
          <ScreenCard
            key={screen.id}
            screen={screen}
            onPress={() => setSelectedScreen(screen)}
          />
        ))}
      </ScrollView>

      {/* Modal */}
      {selectedScreen && (
        <View style={styles.modalOverlay}>
          <ScreenDetails screen={selectedScreen} onClose={() => setSelectedScreen(null)} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { padding: 20, paddingTop: 10 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#111827' },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  statCard: { flex: 1, padding: 16, borderRadius: 16 },
  statCardValue: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 8 },
  statCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', margin: 20, backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, height: 48 },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 16, color: '#111827' },
  list: { flex: 1, paddingHorizontal: 20 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  screenName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  location: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '600', color: 'white' },
  stats: { flexDirection: 'row', marginTop: 16, gap: 24 },
  stat: {},
  statValue: { fontSize: 18, fontWeight: '600', color: '#111827' },
  statLabel: { fontSize: 12, color: '#6b7280' },
  updated: { fontSize: 12, color: '#9ca3af', marginTop: 12 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modal: { backgroundColor: 'white', borderRadius: 20, padding: 24, width: '100%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  modalStats: { flexDirection: 'row', marginTop: 24, gap: 16 },
  modalStat: { flex: 1, backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12, alignItems: 'center' },
  modalStatValue: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  modalStatLabel: { fontSize: 12, color: '#6b7280', marginTop: 4, textAlign: 'center' },
  actionBtn: { marginTop: 20, backgroundColor: '#6366f1', padding: 16, borderRadius: 12, alignItems: 'center' },
  actionBtnText: { color: 'white', fontWeight: '600', fontSize: 16 },
});
