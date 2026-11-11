import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { CareProvider, useCare } from '@/data/care';
import { useTheme } from '@/design/theme';
import { fontFamily, tap, type } from '@/design/tokens';
import { Icon, ICON } from '@/ui/StatusBadge';
import { rescheduleReminders } from '@/lib/reminders';

const HOME = 'M3 11l9-7 9 7v9h-6v-6H9v6H3z';
const LOG = 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3';
const PEOPLE = 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.6';

function Reminders() {
  const care = useCare();
  useEffect(() => {
    if (!care.pet) return;
    void rescheduleReminders({
      meds: care.meds.flatMap((m) => m.schedules.map((s) => ({
        scheduleId: s.id, medicationId: m.id, medicationName: m.name, doseAmount: m.doseAmount, unit: m.unit,
        withFood: m.withFood, timeOfDay: s.timeOfDay, daysOfWeek: s.daysOfWeek,
      }))),
      meals: care.meals.map((m) => ({ scheduleId: m.id, timeOfDay: m.timeOfDay, food: m.food, amountText: m.amountText })),
      timeZone: care.timeZone, petName: care.pet.name, memorial: care.pet.status === 'memorial',
    });
  }, [care.pet, care.meds, care.meals, care.timeZone]);
  return null;
}

export default function AppLayout() {
  const { c } = useTheme();
  const tab = (label: string, d: string) => ({
    title: label, tabBarAccessibilityLabel: label,
    tabBarIcon: ({ color }: { color: unknown }) => <Icon d={d} color={String(color)} size={24} />,
  });
  return (
    <CareProvider>
      <Reminders />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.accent, tabBarInactiveTintColor: c.muted,
          tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.hair, minHeight: tap.primary + 20 },
          tabBarLabelStyle: { fontSize: type.meta.size, fontFamily: fontFamily[600] },
          tabBarAllowFontScaling: true,
        }}
      >
        <Tabs.Screen name="today" options={tab('Today', HOME)} />
        <Tabs.Screen name="meds" options={tab('Meds', ICON.pill)} />
        <Tabs.Screen name="log" options={tab('Log', LOG)} />
        <Tabs.Screen name="household" options={tab('Household', PEOPLE)} />
      </Tabs>
    </CareProvider>
  );
}
