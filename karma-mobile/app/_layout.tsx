/**
 * Karma Mobile App Root Layout
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/services/authContext';
import { Colors } from '@/constants/theme';
import { initializeSentry } from '@/services/sentry';
import { hasPendingRequests, getQueueSize } from '@/services/cache';
import apiClient from '@/services/apiClient';
import * as Network from 'expo-network';

export default function RootLayout() {
  // Initialize Sentry on app start
  useEffect(() => {
    initializeSentry();
  }, []);

  // Sync offline requests when back online
  useEffect(() => {
    let isMounted = true;

    const syncOfflineRequests = async () => {
      const pending = await hasPendingRequests();
      if (pending) {
        const size = await getQueueSize();
        console.log('[App] Back online, syncing', size, 'pending requests');
        await apiClient.retryOfflineRequests();
      }
    };

    // Check network status
    const checkNetwork = async () => {
      const networkState = await Network.useNetworkState();
      if (isMounted && networkState.isConnected && networkState.isInternetReachable) {
        await syncOfflineRequests();
      }
    };

    // Initial check
    checkNetwork();

    // Set up interval to check periodically
    const interval = setInterval(checkNetwork, 30000); // Check every 30 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" backgroundColor={Colors.primaryDark} />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: Colors.gray50 },
            }}
          >
            <Stack.Screen name="karma" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
