import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SettingItem {
  icon: string;
  title: string;
  subtitle?: string;
  type: 'navigate' | 'toggle' | 'action';
  value?: boolean;
  onToggle?: (value: boolean) => void;
}

const sections = [
  {
    title: 'Account',
    items: [
      { icon: 'person', title: 'Profile', subtitle: 'Update your details', type: 'navigate' },
      { icon: 'business', title: 'Business Info', subtitle: 'Company details', type: 'navigate' },
      { icon: 'card', title: 'Bank Account', subtitle: 'For payouts', type: 'navigate' },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { icon: 'notifications', title: 'Push Notifications', type: 'toggle', value: true },
      { icon: 'mail', title: 'Email Alerts', type: 'toggle', value: true },
      { icon: 'chatbubbles', title: 'WhatsApp Updates', type: 'toggle', value: false },
    ],
  },
  {
    title: 'Screen Settings',
    items: [
      { icon: 'wifi', title: 'Auto-connect WiFi', type: 'toggle', value: true },
      { icon: 'moon', title: 'Night Mode', type: 'toggle', value: false },
      { icon: 'refresh', title: 'Auto-restart', type: 'toggle', value: true },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: 'help-circle', title: 'Help Center', type: 'navigate' },
      { icon: 'document-text', title: 'Terms of Service', type: 'navigate' },
      { icon: 'shield-checkmark', title: 'Privacy Policy', type: 'navigate' },
    ],
  },
];

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      {sections.map((section, si) => (
        <View key={si} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.items.map((item, ii) => (
              <TouchableOpacity key={ii} style={styles.item}>
                <View style={styles.itemIcon}>
                  <Ionicons name={item.icon as any} size={20} color="#6366f1" />
                </View>
                <View style={styles.itemContent}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {item.subtitle && <Text style={styles.itemSubtitle}>{item.subtitle}</Text>}
                </View>
                {item.type === 'toggle' ? (
                  <Switch
                    value={item.value}
                    onValueChange={() => {}}
                    trackColor={{ false: '#d1d5db', true: '#a5b4fc' }}
                    thumbColor="white"
                  />
                ) : (
                  <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.logout}>
        <Ionicons name="log-out" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>
      <Text style={styles.version}>dooh-mobile v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', paddingHorizontal: 20, marginBottom: 8, marginTop: 16 },
  sectionContent: { backgroundColor: 'white', marginHorizontal: 20, borderRadius: 12, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemIcon: { width: 36, height: 36, backgroundColor: '#f3f4f6', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  itemContent: { flex: 1, marginLeft: 12 },
  itemTitle: { fontSize: 16, color: '#111827' },
  itemSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, padding: 16 },
  logoutText: { fontSize: 16, color: '#ef4444', fontWeight: '600' },
  version: { textAlign: 'center', color: '#9ca3af', fontSize: 12, marginVertical: 24 },
});
