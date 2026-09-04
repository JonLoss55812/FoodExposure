import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import * as schema from '@/src/db/schema';
import { useAuthStore } from '@/src/stores/auth-store';
import { useChildStore } from '@/src/stores/child-store';

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  // Read from the theme rather than hardcoding: these labels sit on
  // `tabBar`, which is white in light mode and #1E293B in dark, and at 10px
  // they are the smallest text in the app. The previous literals were
  // theme-blind (the light-mode orange rendered in dark mode too) and the
  // unfocused #94A3B8 was 2.56:1 on a white tab bar.
  const { theme } = useUnistyles();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 4 }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text
        style={{
          fontSize: 10,
          fontWeight: focused ? '600' : '400',
          color: focused ? theme.colors.primaryStrong : theme.colors.textTertiary,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const familyId = useAuthStore((s) => s.familyId);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isOnboarded = useAuthStore((s) => s.isOnboarded);
  const ensureSelection = useChildStore((s) => s.ensureSelection);

  useEffect(() => {
    if (!isAuthenticated || !isOnboarded || !familyId) return;
    let cancelled = false;
    (async () => {
      try {
        const kids = await db
          .select({ id: schema.children.id })
          .from(schema.children)
          .where(eq(schema.children.familyId, familyId));
        if (cancelled) return;
        if (kids.length === 0) {
          router.replace('/onboarding/add-child');
          return;
        }
        ensureSelection(kids);
      } catch (err) {
        console.error('Failed to ensure child selection on tab mount:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [familyId, isAuthenticated, isOnboarded, ensureSelection, router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.tabBarBorder,
          height: 80,
          paddingBottom: 20,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="➕" label="Log" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="foods"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="🍽️" label="Foods" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="📊" label="Progress" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙️" label="Settings" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
