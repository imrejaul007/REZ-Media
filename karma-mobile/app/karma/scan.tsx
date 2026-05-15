/**
 * Scan Screen — QR scanner using expo-camera
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import karmaService from '@/services/karmaService';
import { useAuth } from '@/services/authContext';
import { KarmaHeader } from './_layout';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/theme';

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scanned || scanning) return;
    setScanning(true);
    setScanned(true);

    try {
      // Parse QR data: expected format is "rez-karma:checkin:{eventId}" or "rez-karma:checkout:{eventId}"
      const parts = data.split(':');
      if (parts.length < 3 || parts[0] !== 'rez-karma') {
        Alert.alert('Invalid QR', 'This QR code is not a valid Karma event code.');
        setScanned(false);
        setScanning(false);
        return;
      }

      const [, action, eventId] = parts;
      if (!user?.userId) {
        Alert.alert('Error', 'Please log in first.');
        setScanning(false);
        return;
      }

      if (action === 'checkin') {
        const res = await karmaService.checkIn(user.userId, eventId, 'qr', data);
        if (res.success && res.data) {
          Alert.alert('Checked In!', `Welcome! You earned ${res.data?.karmaEarned ?? 0} KP for check-in.`);
        } else {
          Alert.alert('Check-in Failed', res.message || 'Could not check in.');
        }
      } else if (action === 'checkout') {
        const res = await karmaService.checkOut(user.userId, eventId, 'qr', data);
        if (res.success && res.data) {
          Alert.alert('Checked Out!', `Great work! You earned ${res.data?.karmaEarned ?? 0} KP for this event.`);
        } else {
          Alert.alert('Check-out Failed', res.message || 'Could not check out.');
        }
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred while scanning.');
    } finally {
      setScanning(false);
      setScanned(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Scan QR" subtitle="Check in/out" showBack />
        <View style={styles.centered}><ActivityIndicator size="large" color={Colors.primary} /></View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <KarmaHeader title="Scan QR" subtitle="Check in/out" showBack />
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color={Colors.gray300} />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSub}>We need camera access to scan event QR codes for check-in and check-out.</Text>
          <Pressable style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KarmaHeader title="Scan QR" subtitle="Check in/out" showBack />
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        />
        <View style={styles.overlay}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
        </View>
        {scanning && (
          <View style={styles.scanningOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.scanningText}>Processing...</Text>
          </View>
        )}
      </View>
      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>How it works</Text>
        <View style={styles.instructionRow}>
          <View style={styles.instructionItem}>
            <View style={[styles.instructionNum, { backgroundColor: Colors.success }]}>
              <Text style={styles.instructionNumText}>1</Text>
            </View>
            <Text style={styles.instructionText}>Scan at event start</Text>
          </View>
          <View style={styles.instructionItem}>
            <View style={[styles.instructionNum, { backgroundColor: Colors.primary }]}>
              <Text style={styles.instructionNumText}>2</Text>
            </View>
            <Text style={styles.instructionText}>Scan at event end</Text>
          </View>
        </View>
        <Text style={styles.instructionSub}>Earn Karma Points for every verified volunteer hour!</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.gray900 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  permissionTitle: { ...Typography.h3, color: Colors.white, marginTop: 20, textAlign: 'center' },
  permissionSub: { fontSize: 14, color: Colors.gray400, marginTop: 8, textAlign: 'center', lineHeight: 22 },
  permissionButton: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: BorderRadius.lg, marginTop: 24 },
  permissionButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cameraContainer: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 250, height: 250, position: 'relative' },
  corner: { position: 'absolute', width: 30, height: 30, borderColor: Colors.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanningOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  scanningText: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 12 },
  instructions: { padding: Spacing.xl, backgroundColor: Colors.gray900, alignItems: 'center' },
  instructionTitle: { ...Typography.h4, color: Colors.white, marginBottom: 16 },
  instructionRow: { flexDirection: 'row', gap: 24 },
  instructionItem: { alignItems: 'center' },
  instructionNum: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  instructionNumText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  instructionText: { fontSize: 13, color: Colors.gray300 },
  instructionSub: { fontSize: 13, color: Colors.gray400, marginTop: 16, textAlign: 'center' },
});
