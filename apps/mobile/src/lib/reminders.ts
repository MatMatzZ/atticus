import { Platform, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { planReminders, type MealScheduleInput, type MedScheduleInput } from '@atticus/core';

const CHANNEL = 'care-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensureReminderPermissions(): Promise<{ notifications: boolean; exactAlarms: boolean }> {
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Care reminders', importance: Notifications.AndroidImportance.HIGH,
    });
    // Exact alarms: Android 14+ denies by default. Without it reminders arrive approximately.
    const exact = await Notifications.getExactAlarmPermissionsAsync().catch(() => ({ granted: true }));
    return { notifications: status === 'granted', exactAlarms: !!exact.granted };
  }
  return { notifications: status === 'granted', exactAlarms: true };
}

export async function requestExactAlarms() {
  if (Platform.OS !== 'android') return;
  try { await Notifications.requestExactAlarmPermissionsAsync(); } catch { void Linking.openSettings(); }
}

/** Replaces all pending reminders with the next 48 h of meds + meals. Call on start and on any schedule change. */
export async function rescheduleReminders(input: {
  meds: MedScheduleInput[]; meals: MealScheduleInput[]; timeZone: string; petName: string; memorial: boolean;
}) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (input.memorial) return 0;
  const perms = await ensureReminderPermissions();
  if (!perms.notifications) return 0;
  const plan = planReminders(input.meds, input.meals, { timeZone: input.timeZone, now: new Date(), petName: input.petName });
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, interruptionLevel: 'timeSensitive', sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
    });
  }
  return plan.length;
}
