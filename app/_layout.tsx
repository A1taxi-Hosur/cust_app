import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '../src/contexts/AuthContext';
import AuthNavigator from '../src/components/AuthNavigator';
import NotificationBanner from '../src/components/NotificationBanner';
import RideNotificationListener from '../src/components/RideNotificationListener';
import TripCompletionModal from '../src/components/TripCompletionModal';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <AuthNavigator>
        <RideNotificationListener />
        <NotificationBanner />
        <TripCompletionModal />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="booking" />
          <Stack.Screen name="ride-completion" />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </AuthNavigator>
    </AuthProvider>
  );
}