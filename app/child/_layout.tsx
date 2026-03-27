import { Stack } from 'expo-router';

export default function ChildLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_bottom', presentation: 'modal' }} />
  );
}
