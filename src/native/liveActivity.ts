import { Capacitor, registerPlugin } from '@capacitor/core';

type FocusLiveActivityPayload = {
  noteId: string;
  title: string;
  subtitle: string;
  endTimestamp: number;
  progress: number;
};

interface SeedLiveActivityPlugin {
  start(payload: FocusLiveActivityPayload): Promise<{ activityId?: string }>;
  update(payload: FocusLiveActivityPayload): Promise<void>;
  stop(): Promise<void>;
}

const LiveActivity = registerPlugin<SeedLiveActivityPlugin>('SeedLiveActivity');

function isNativeShell() {
  return Capacitor.isNativePlatform();
}

export async function startFocusLiveActivity(payload: FocusLiveActivityPayload) {
  if (!isNativeShell()) return;
  try {
    await LiveActivity.start(payload);
  } catch (error) {
    console.warn('Seed Live Activity could not start.', error);
  }
}

export async function updateFocusLiveActivity(payload: FocusLiveActivityPayload) {
  if (!isNativeShell()) return;
  try {
    await LiveActivity.update(payload);
  } catch (error) {
    console.warn('Seed Live Activity could not update.', error);
  }
}

export async function stopFocusLiveActivity() {
  if (!isNativeShell()) return;
  try {
    await LiveActivity.stop();
  } catch (error) {
    console.warn('Seed Live Activity could not stop.', error);
  }
}
