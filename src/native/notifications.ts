import { Capacitor } from '@capacitor/core';
import { runNativeAccountTask } from './accountPrivacy';
import { LocalNotifications } from '@capacitor/local-notifications';

type SeedReminderNote = {
  id: string;
  title: string;
  createdAt: number;
  lastWateredAt?: number;
  wateringIntervalDays?: number;
  inbox?: boolean;
  paused?: boolean;
  growthStage?: string;
};

type ScheduleSeedRemindersOptions = {
  notes: SeedReminderNote[];
  reminderHour: number;
  language: 'es' | 'en';
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_REMINDER_ID = 410000;
const WATERING_REMINDER_START_ID = 410100;
const WATERING_REMINDER_LIMIT = 10;

function isNativeShell() {
  return Capacitor.isNativePlatform();
}

function nextReminderDate(hour: number, from = Date.now()) {
  const date = new Date(from);
  date.setHours(hour, 0, 0, 0);
  if (date.getTime() <= from + 30_000) {
    date.setDate(date.getDate() + 1);
  }
  return date;
}

function wateringDueAt(note: SeedReminderNote) {
  const interval = Math.max(1, note.wateringIntervalDays || 1);
  return (note.lastWateredAt || note.createdAt) + interval * DAY_MS;
}

async function cancelSeedReminders() {
  const pending = await LocalNotifications.getPending();
  const notificationIds = pending.notifications
    .filter(notification =>
      notification.id === DAILY_REMINDER_ID ||
      (notification.id >= WATERING_REMINDER_START_ID && notification.id < WATERING_REMINDER_START_ID + WATERING_REMINDER_LIMIT)
    )
    .map(notification => ({ id: notification.id }));

  if (notificationIds.length > 0) {
    await LocalNotifications.cancel({ notifications: notificationIds });
  }
}

export async function requestSeedNotificationPermission() {
  if (!isNativeShell()) return 'web' as const;

  const current = await LocalNotifications.checkPermissions();
  if (current.display === 'granted') return 'granted' as const;

  const requested = await LocalNotifications.requestPermissions();
  return requested.display === 'granted' ? 'granted' as const : 'denied' as const;
}

export async function clearSeedNotifications(strict = false) {
  if (!isNativeShell()) return;
  try {
    await runNativeAccountTask(async () => {
      await cancelSeedReminders();
      if (strict) {
        const delivered = await LocalNotifications.getDeliveredNotifications();
        const notifications = delivered.notifications.filter(notification =>
          notification.id === DAILY_REMINDER_ID ||
          (notification.id >= WATERING_REMINDER_START_ID && notification.id < WATERING_REMINDER_START_ID + WATERING_REMINDER_LIMIT));
        if (notifications.length) await LocalNotifications.removeDeliveredNotifications({ notifications });
      }
    });
  } catch (error) {
    if (strict) throw error;
    console.warn('Seed notifications could not be cleared.', error);
  }
}

export async function scheduleSeedReminders({ notes, reminderHour, language }: ScheduleSeedRemindersOptions) {
  if (!isNativeShell()) return false;

  try {
    return await runNativeAccountTask(async () => {
      const permission = await requestSeedNotificationPermission();
      if (permission !== 'granted') return false;

      await cancelSeedReminders();

      const now = Date.now();
      const livingNotes = notes
        .filter(note => !note.inbox && !note.paused && note.growthStage !== 'bloom' && note.growthStage !== 'withered')
        .map(note => ({ note, dueAt: wateringDueAt(note) }))
        .sort((a, b) => a.dueAt - b.dueAt)
        .slice(0, WATERING_REMINDER_LIMIT);

      const dailyBody = language === 'en'
        ? 'Open Seed and choose one idea to water, move forward, or leave for later.'
        : 'Abre Seed y elige una idea para regar, avanzar o dejar para después.';

      const notifications = [
        {
          id: DAILY_REMINDER_ID,
          title: language === 'en' ? 'A gentle garden review' : 'Revisión suave del jardín',
          body: dailyBody,
          schedule: {
            at: nextReminderDate(reminderHour, now),
            repeats: true,
            every: 'day' as const,
          },
          sound: 'default',
        },
        ...livingNotes.map(({ note, dueAt }, index) => {
          const dueDate = nextReminderDate(reminderHour, Math.max(now, dueAt) - 60_000);
          const body = language === 'en'
            ? `"${note.title}" may be ready for a quick review.`
            : `"${note.title}" puede valer una revisión rápida.`;

          return {
            id: WATERING_REMINDER_START_ID + index,
            title: language === 'en' ? 'An idea may need water' : 'Una idea puede necesitar riego',
            body,
            schedule: { at: dueDate },
            sound: 'default',
          };
        }),
      ];

      await LocalNotifications.schedule({ notifications });
      return true;
    });
  } catch (error) {
    console.warn('Seed notifications could not be scheduled.', error);
    return false;
  }
}
