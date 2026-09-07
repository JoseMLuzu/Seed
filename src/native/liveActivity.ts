import { Capacitor, registerPlugin } from '@capacitor/core';
import { runNativeAccountTask } from './accountPrivacy';

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
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('SeedLiveActivity');
}

export async function startFocusLiveActivity(payload: FocusLiveActivityPayload) {
  if (!isNativeShell()) return;
  try {
    await runNativeAccountTask(() => LiveActivity.start(payload));
  } catch (error) {
    console.warn('Seeds Live Activity could not start.', error);
  }
}

export async function updateFocusLiveActivity(payload: FocusLiveActivityPayload) {
  if (!isNativeShell()) return;
  try {
    await runNativeAccountTask(() => LiveActivity.update(payload));
  } catch (error) {
    console.warn('Seeds Live Activity could not update.', error);
  }
}

export async function stopFocusLiveActivity(strict = false) {
  if (!isNativeShell()) return;
  try {
    await runNativeAccountTask(() => LiveActivity.stop());
  } catch (error) {
    if (strict) throw error;
    console.warn('Seeds Live Activity could not stop.', error);
  }
}
