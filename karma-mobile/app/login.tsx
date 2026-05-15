/**
 * Login Screen for Karma Mobile App
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/services/authContext';
import { Colors, Spacing, BorderRadius, Typography, shadows } from '@/constants/theme';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { sendOTP, login } = useAuth();

  const handleSendOTP = useCallback(async () => {
    if (phone.length < 10) return;
    setLoading(true);
    try {
      await sendOTP(phone);
      setStep('otp');
    } catch (err) {
      // handled in context
    } finally {
      setLoading(false);
    }
  }, [phone, sendOTP]);

  const handleLogin = useCallback(async () => {
    if (otp.length < 4) return;
    setLoading(true);
    try {
      const user = await login(phone, otp);
      if (user) {
        router.replace('/karma/home');
      }
    } catch (err) {
      // handled in context
    } finally {
      setLoading(false);
    }
  }, [phone, otp, login, router]);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#7C3AED', '#8B5CF6', '#A78BFA']} style={styles.gradient}>
        {/* Logo area */}
        <View style={styles.logoSection}>
          <View style={styles.logoCircle}>
            <Ionicons name="leaf" size={48} color="#fff" />
          </View>
          <Text style={styles.appName}>Karma by ReZ</Text>
          <Text style={styles.appTagline}>Make an impact. Earn rewards.</Text>
        </View>

        {/* Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{step === 'phone' ? 'Welcome Back' : 'Enter OTP'}</Text>
          <Text style={styles.formSub}>
            {step === 'phone' ? 'Enter your phone number to continue' : `Code sent to ${phone}`}
          </Text>

          {step === 'phone' ? (
            <View style={styles.inputContainer}>
              <View style={styles.phoneInput}>
                <Text style={styles.phoneCode}>+91</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Phone Number"
                  placeholderTextColor={Colors.gray400}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  maxLength={10}
                />
              </View>
              <Pressable style={styles.primaryButton} onPress={handleSendOTP} disabled={loading || phone.length < 10}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Send OTP</Text>}
              </Pressable>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInputLarge}
                placeholder="Enter 4-digit OTP"
                placeholderTextColor={Colors.gray400}
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={4}
                textAlign="center"
              />
              <Pressable style={styles.primaryButton} onPress={handleLogin} disabled={loading || otp.length < 4}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify & Login</Text>}
              </Pressable>
              <Pressable onPress={() => setStep('phone')}>
                <Text style={styles.changeNumber}>Change phone number</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Admin link */}
        <Pressable style={styles.adminLink} onPress={() => router.push('/admin')}>
          <Text style={styles.adminLinkText}>Admin Dashboard</Text>
        </Pressable>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, paddingHorizontal: Spacing.xl },
  logoSection: { alignItems: 'center', marginTop: 80 },
  logoCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  appName: { ...Typography.h1, color: '#fff', marginBottom: 4 },
  appTagline: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  formCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xxl, padding: Spacing.xl, marginTop: 40, ...shadows.lg },
  formTitle: { ...Typography.h3, color: Colors.gray800, marginBottom: 4 },
  formSub: { fontSize: 14, color: Colors.gray500, marginBottom: 24 },
  inputContainer: { gap: 16 },
  phoneInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gray50, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, borderWidth: 1, borderColor: Colors.gray200 },
  phoneCode: { fontSize: 16, color: Colors.gray700, fontWeight: '600', marginRight: 8 },
  textInput: { flex: 1, fontSize: 16, color: Colors.gray800, paddingVertical: Spacing.md },
  textInputLarge: { fontSize: 24, color: Colors.gray800, paddingVertical: Spacing.md, letterSpacing: 8, fontWeight: '700' },
  primaryButton: { backgroundColor: Colors.primary, borderRadius: BorderRadius.lg, paddingVertical: 16, alignItems: 'center' },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  changeNumber: { fontSize: 14, color: Colors.primary, textAlign: 'center', fontWeight: '600' },
  adminLink: { alignSelf: 'center', marginTop: 24 },
  adminLinkText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
});
