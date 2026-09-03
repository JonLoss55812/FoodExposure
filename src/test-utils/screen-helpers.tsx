/**
 * Shared seams for the `app/` screen tests.
 *
 * Four screen suites (`onboarding/join`, `food/[id]`, `food/add`,
 * `(tabs)/settings`, `(tabs)/log`) had independently grown copies of the same
 * three helpers. They are behaviour-defining, not incidental: the safe-area
 * metrics are what stop `SafeAreaView`'s hook from throwing, and the Alert
 * helpers encode the one way a confirm dialog is reachable under this harness
 * (React Native's `Alert.alert` is a spy, so the only way to "tap" a button is
 * to reach into the spy's third argument and invoke it yourself).
 *
 * Test-only module — excluded from `collectCoverageFrom`.
 */
import React, { type ReactNode } from 'react';
import { fireEvent, screen, act } from '@testing-library/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/**
 * Static safe-area metrics. Tab screens are wrapped in `SafeAreaView`, whose
 * hook throws outside a provider; static metrics keep the harness
 * deterministic (and are the documented way to render safe-area consumers in
 * a test environment).
 */
export const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Wrap a screen under test so its `SafeAreaView` resolves. */
export function SafeArea({ children }: { children: ReactNode }) {
  return <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>{children}</SafeAreaProvider>;
}

/** Click an element by its accessibility label, flushing effects. */
export async function click(label: string) {
  await act(async () => {
    fireEvent.click(screen.getByLabelText(label));
  });
}

type AlertButton = { text: string; onPress?: () => void | Promise<void> };

function alertButtonsAt(alertSpy: jest.SpyInstance, callIndex: number): AlertButton[] {
  const call = alertSpy.mock.calls[callIndex];
  expect(call).toBeTruthy();
  return (call[2] as AlertButton[] | undefined) ?? [];
}

async function invoke(buttons: AlertButton[], text: string) {
  const button = buttons.find((b) => b.text === text);
  expect(button).toBeTruthy();
  await act(async () => {
    await button!.onPress?.();
  });
}

/**
 * Invoke a named button on the **first** Alert the screen raised. Use for a
 * confirm dialog, where a later failure Alert must not be mistaken for it.
 */
export async function confirmAlert(alertSpy: jest.SpyInstance, text: string) {
  await invoke(alertButtonsAt(alertSpy, 0), text);
}

/**
 * Invoke a named button on the **most recent** Alert. Use when the screen
 * raises several and the last one is the one under test.
 */
export async function pressAlertButton(alertSpy: jest.SpyInstance, text: string) {
  await invoke(alertButtonsAt(alertSpy, alertSpy.mock.calls.length - 1), text);
}
