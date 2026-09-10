"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as E from "./engine";
import { buildScenario, SCENARIOS } from "./scenarios";
import type { AppState, Card, CardBehavior, ChangeKind, Interval, PaidTier } from "./types";

const KEY = "privy-global-subs-proto-v3";

type Updater = (s: AppState) => AppState;

interface StoreApi {
  state: AppState | null;
  ready: boolean;
  selectScenario: (id: string) => void;
  reset: () => void;
  update: (fn: Updater) => void;
  advanceDays: (n: number) => void;
  advanceTo: (iso: string) => void;
  setNextChargeOverride: (b: CardBehavior | null) => void;
  setShowSpecTags: (v: boolean) => void;
  setControlsOpen: (v: boolean) => void;
  setGuideOpen: (v: boolean) => void;
  toggleStep: (id: string) => void;
  resetSteps: () => void;
  dismissToast: () => void;
  completeSubscription: (input: E.CheckoutInput) => void;
  upgradeNow: (input: E.UpgradeInput) => void;
  scheduleChange: (input: { kind: ChangeKind; tier: PaidTier; interval: Interval; seats: number }) => void;
  undoScheduledChange: () => void;
  cancelAtPeriodEnd: (reason?: string) => void;
  resume: (consentText: string) => void;
  replaceCard: (card: Card) => void;
  confirmAuthentication: () => void;
  optIn: (card: Card, consentText: string, interval: Interval, tier?: PaidTier, seats?: number) => void;
  dismissOptIn: () => void;
  makeCardExpireSoon: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

function load(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 3) return null;
    return parsed;
  } catch {
    return null;
  }
}

function save(s: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [ready, setReady] = useState(false);
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;

  useEffect(() => {
    const loaded = load();
    setState(loaded);
    setReady(true);
  }, []);

  useEffect(() => {
    if (state) save(state);
  }, [state]);

  const update = useCallback((fn: Updater) => {
    setState((prev) => (prev ? fn(prev) : prev));
  }, []);

  const api = useMemo<StoreApi>(
    () => ({
      state,
      ready,
      selectScenario: (id) => {
        const meta = SCENARIOS.find((x) => x.id === id) ? id : "free";
        const s = buildScenario(meta);
        s.ui.guideOpen = stateRef.current?.ui.guideOpen ?? true;
        setState(s);
        save(s);
      },
      reset: () => {
        const id = stateRef.current?.scenarioId ?? "free";
        const s = buildScenario(id);
        s.ui.guideOpen = stateRef.current?.ui.guideOpen ?? true;
        setState(s);
        save(s);
      },
      update,
      advanceDays: (n) => update((s) => E.advanceDays(s, n)),
      advanceTo: (iso) => update((s) => E.advanceTo(s, iso)),
      setNextChargeOverride: (b) => update((s) => ({ ...s, nextChargeOverride: b })),
      setShowSpecTags: (v) => update((s) => ({ ...s, ui: { ...s.ui, showSpecTags: v } })),
      setControlsOpen: (v) => update((s) => ({ ...s, ui: { ...s.ui, controlsOpen: v } })),
      setGuideOpen: (v) => update((s) => ({ ...s, ui: { ...s.ui, guideOpen: v } })),
      toggleStep: (id) =>
        update((s) => {
          const cur = s.ui.checkedSteps ?? [];
          return { ...s, ui: { ...s.ui, checkedSteps: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } };
        }),
      resetSteps: () => update((s) => ({ ...s, ui: { ...s.ui, checkedSteps: [] } })),
      dismissToast: () => update((s) => ({ ...s, ui: { ...s.ui, toast: null } })),
      completeSubscription: (input) => update((s) => E.completeSubscription(s, input)),
      upgradeNow: (input) => update((s) => E.upgradeNow(s, input)),
      scheduleChange: (input) => update((s) => E.scheduleChange(s, input)),
      undoScheduledChange: () => update((s) => E.undoScheduledChange(s)),
      cancelAtPeriodEnd: (reason) => update((s) => E.cancelAtPeriodEnd(s, reason)),
      resume: (consentText) => update((s) => E.resumeSubscription(s, consentText)),
      replaceCard: (card) => update((s) => E.replaceCard(s, card)),
      confirmAuthentication: () => update((s) => E.confirmAuthentication(s)),
      optIn: (card, consentText, interval, tier, seats) => update((s) => E.optInAutoRenew(s, card, consentText, interval, tier, seats)),
      dismissOptIn: () => update((s) => ({ ...s, optInDismissed: true })),
      makeCardExpireSoon: () =>
        update((s) => {
          if (!s.card) return s;
          const d = new Date(s.now);
          return { ...s, card: { ...s.card, expMonth: d.getUTCMonth() + 1, expYear: d.getUTCFullYear() } };
        }),
    }),
    [state, ready, update]
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore(): StoreApi {
  const api = useContext(Ctx);
  if (!api) throw new Error("useStore must be used inside StoreProvider");
  return api;
}

/** For app screens: the state is guaranteed (AppShell redirects to the picker otherwise). */
export function useAppState(): { s: AppState; api: StoreApi } {
  const api = useStore();
  if (!api.state) throw new Error("No scenario loaded");
  return { s: api.state, api };
}
