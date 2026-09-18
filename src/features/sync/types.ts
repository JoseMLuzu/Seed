/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SupabaseRealtimePayload = {
  eventType?: "INSERT" | "UPDATE" | "DELETE" | string;
  old?: Record<string, unknown> | null;
  new?: Record<string, unknown> | null;
};
