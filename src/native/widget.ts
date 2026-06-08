import { Capacitor, registerPlugin } from '@capacitor/core';

export type SeedWidgetPayload = {
  title: string;
  subtitle: string;
  action: string;
  metric: string;
  seeds: number;
  sprouts: number;
  harvests: number;
  watering: number;
  streak: number;
  updatedAt: number;
};

interface SeedWidgetDataPlugin {
  update(payload: SeedWidgetPayload): Promise<void>;
}

const WidgetData = registerPlugin<SeedWidgetDataPlugin>('SeedWidgetData');

export async function updateSeedWidget(payload: SeedWidgetPayload) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WidgetData.update(payload);
  } catch (error) {
    console.warn('Seeds widget data could not update.', error);
  }
}
