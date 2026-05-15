/**
 * Karma App Index — redirects to home if logged in, otherwise login
 */
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/login" />;
}
