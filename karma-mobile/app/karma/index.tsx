/**
 * Karma App Redirect — redirects to karma home
 */
import { useEffect } from 'react';
import { Redirect } from 'expo-router';

export default function KarmaIndex() {
  return <Redirect href="/karma/home" />;
}
