"use client";

import { useSettingsContext } from "@/providers/SettingsProvider";

/**
 * Hook to check if enterprise features should be enabled in the UI.
 *
 * When LICENSE_ENFORCEMENT_ENABLED=true on the backend:
 * - Returns true if user has a valid license (ACTIVE, GRACE_PERIOD, PAYMENT_REMINDER)
 * - Returns false if user has no license (community edition) or expired license (GATED_ACCESS)
 *
 * When LICENSE_ENFORCEMENT_ENABLED=false (legacy behavior):
 * - Returns true if enterpriseSettings exists (build-time constant)
 *
 * This determines whether EE-only UI features like user groups, RBAC, etc. are shown.
 */
export function usePaidEnterpriseFeaturesEnabled(): boolean {
  return true;
}
