/**
 * Wallet Screen — wallet + transactions
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FlashList } from '@shopify/flash-list';
import karmaService, { WalletBalance, Transaction } from '@/services/karmaService';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';

const TX_TYPE_ICONS: Record<string, string> = {
  earned: 'leaf',
  converted: 'swap-horizontal',
  spent: 'cash',
  bonus: 'gift',
};

const TX_TYPE_COLORS: Record<string, string> = {
  earned: Colors.success,
  converted: Colors.info,
  spent: Colors.warning,
  bonus: Colors.primary,
};

function WalletBalanceCard({ balance }: { balance: WalletBalance }) {
  return (
    <LinearGradient colors={['#7C3AED', '#8B5CF6', '#A78BFA']} style={styles.balanceCard}>
      <Text style={styles.balanceLabel}>Total Balance</Text>
      <View style={styles.balanceRow}>
        <View style={styles.balanceItem}>
          <Ionicons name="leaf" size={20} color="#fff" />
          <Text style={styles.balanceValue}>{balance.karmaPoints.toLocaleString()}</Text>
          <Text style={styles.balanceSub}>Karma Points</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceItem}>
          <Ionicons name="diamond" size={20} color="#fff" />
          <Text style={styles.balanceValue}>{balance.rezCoins.toLocaleString()}</Text>
          <Text style={styles.balanceSub}>ReZ Coins</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const icon = TX_TYPE_ICONS[tx.type] ?? 'cash';
  const color = TX_TYPE_COLORS[tx.type] ?? Colors.gray500;
  const isPositive = tx.type === 'earned' || tx.type === 'bonus';

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={styles.txContent}>
        <Text style={styles.txDesc}>{tx.description}</Text>
        <Text style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.txAmount, { color: isPositive ? Colors.success : Colors.gray700 }]}>
        {isPositive ? '+' : ''}{tx.amount.toLocaleString()}
      </Text>
    </View>
  );
}

export default function Wallet() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [balanceRes, txRes] = await Promise.all([
        karmaService.getWalletBalance(),
        karmaService.getTransactions(),
      ]);
      if (balanceRes.success && balanceRes.data) setBalance(balanceRes.data);
      if (txRes.success && txRes.data) setTransactions(txRes.data.transactions);
    } catch (err) {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (loading) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Wallet" subtitle="Your coins" showBack />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KarmaHeader title="Wallet" subtitle="Your coins" showBack />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {balance && <WalletBalanceCard balance={balance} />}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          {transactions.map((tx) => (
            <TransactionRow key={tx._id} tx={tx} />
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
  balanceCard: { margin: Spacing.base, borderRadius: BorderRadius.xl, padding: Spacing.lg },
  balanceLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 12 },
  balanceRow: { flexDirection: 'row' },
  balanceItem: { flex: 1, alignItems: 'center' },
  balanceDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  balanceValue: { fontSize: 28, fontWeight: '800', color: '#fff', marginTop: 4 },
  balanceSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.lg },
  sectionTitle: { ...Typography.bodyBold, color: Colors.gray800, marginBottom: Spacing.sm },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 8, ...shadows.sm },
  txIconWrap: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  txContent: { flex: 1, marginLeft: 12 },
  txDesc: { ...Typography.bodyBold, color: Colors.gray800, fontSize: 14 },
  txDate: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '800' },
});
