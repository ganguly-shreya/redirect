# HANDOFF — Redirect v1

Redirect is a local-only habit/attention-correction app: users pair failure patterns
("phone scrolling mid-work") with if-then plans (timer / vision-board image / custom
message), fire them via an "I'm Stuck" button or daily check-in notifications, and rate
afterwards whether the redirect helped. Expo SDK 54, Expo Go compatible, expo-router v6,
TypeScript strict, no backend, no accounts.

This document is written for a model or developer with **zero context** on the build
conversation. Read this file plus `git log --oneline` and you know everything.

## Architecture

```
app/
  _layout.tsx              Root layout: OnboardingProvider, Stack.Protected gate,
                           notification handler + tap-response deep linking
  onboarding.tsx           4-step wizard (patterns → plans → images → times), local useState
  stuck.tsx                Plan picker modal ("what loop are you in?"), forwards source param
  execute/[planId].tsx     Runs a plan's action; the ONLY place a TriggerLog is written
  (tabs)/
    _layout.tsx            Bottom tabs: Home, Plans, Vision Board, Retro (Ionicons)
    index.tsx              Home: big "I'm Stuck" button, today's check-in times + count
    plans.tsx              CRUD for FailurePoints + IfThenPlans (single-draft edit model)
    vision-board.tsx       Image grid, add via picker, remove
    retro.tsx              TriggerLogs grouped by week, outcome chips, per-plan ratios
components/
  themed-text.tsx          ThemedText with type scale (title/subtitle/default/caption/link)
  themed-view.tsx          ThemedView (theme-aware background)
  themed-text-input.tsx    Theme-aware TextInput (card bg, hairline border)
  primary-button.tsx       Accent Pressable with haptic feedback; size="large" for "I'm Stuck"
  plan-form.tsx            Shared create/edit form for IfThenPlan + isPlanFormValueValid()
  time-picker-row.tsx      One check-in time row (iOS inline picker, Android dialog)
  countdown-timer.tsx      mm:ss countdown, timestamp-based (drift-free)
  vision-image-grid.tsx    3-column grid (expo-image), optional remove badges
  trigger-log-row.tsx      Retro row with helped/didn't-help chips
hooks/
  use-color-scheme.ts      Re-export of RN useColorScheme (+ .web.ts hydration-safe variant)
  use-theme-color.ts       useThemeColor(props, colorName) — resolves palette per scheme
  use-onboarding-status.tsx OnboardingProvider/useOnboardingStatus; owns hasOnboarded flag,
                           runs storage migrations at app start
lib/
  storage.ts               THE persistence layer: typed AsyncStorage wrapper + schemaVersion
                           migrations. All reads/writes go through here.
  plan-engine.ts           logTriggerFired / setTriggerOutcome / pickRandomVisionImage /
                           computePlanStats — business logic, no UI
  notifications.ts         THE scheduling layer: permissions, daily check-in scheduling,
                           cancel-all; exports STUCK_URL used in notification payloads
  images.ts                Image persistence (copy picker results to document dir),
                           bundled-asset sentinel resolution, delete
  presets.ts               5 preset failure patterns + suggested plans; instantiatePreset()
  id.ts                    createId() — timestamp + random suffix
types/
  models.ts                All domain types + StorageSchema (the storage key map)
constants/
  theme.ts                 Colors (light/dark), Spacing, Radius — the whole design system
assets/images/vision-board/  6 bundled default vision-board images (require()'d in lib/images.ts)
app.json                   Expo config; scheme "redirect", typedRoutes + reactCompiler on
```

## Data flow (the core loop, traced)

1. **Tap "I'm Stuck"** — `app/(tabs)/index.tsx` renders a `PrimaryButton` whose `onPress`
   calls `router.push('/stuck')`.
2. **Pick a pattern** — `app/stuck.tsx` loads `failurePoints` and `plans` via
   `lib/storage.getCollection`, joins them (one plan per failure point), and on row tap
   calls `router.push({ pathname: '/execute/[planId]', params: { planId } })`. If it was
   opened by a notification tap it also forwards `source: 'scheduled'`.
3. **Execute** — `app/execute/[planId].tsx` reads `planId`/`source` from
   `useLocalSearchParams`, loads the plan, and in a mount `useEffect` (ref-guarded against
   double-mount) calls `logTriggerFired(planId, source)` from `lib/plan-engine.ts`.
4. **Log write** — `logTriggerFired` creates a `TriggerLog` (`outcome: null`) and persists
   it via `storage.upsertInCollection('triggerLogs', log)`. This is the only write point.
5. **Action renders** — the same screen switches on `plan.actionType` (exhaustive switch):
   `CountdownTimer` for `'timer'`, a random image via `pickRandomVisionImage` +
   `getImageSource` for `'visionBoard'`, or the centered message for `'customMessage'`.
   "Done" calls `router.dismissAll()` back to Home.
6. **Retro read** — `app/(tabs)/retro.tsx` reloads `triggerLogs` in a `useFocusEffect`,
   groups by `startOfWeek` (date-fns), and renders `TriggerLogRow`s. Tapping a chip calls
   `setTriggerOutcome(logId, outcome)` in `lib/plan-engine.ts`, which rewrites that log via
   `upsertInCollection`. `computePlanStats` derives the helped/didn't ratios shown on top.

The notification path joins this loop at step 2: `lib/notifications.ts` schedules daily
notifications whose payload is `data: { url: '/stuck' }`; the `useLastNotificationResponse`
effect in `app/_layout.tsx` sees the tap and pushes `/stuck` with `source: 'scheduled'`.

## Key decisions and why

- **AsyncStorage over SQLite** — every collection is small, read whole, never queried
  relationally. JSON blobs behind the typed `lib/storage.ts` API are simpler and add no
  native dependency. The wrapper is the seam if this ever changes.
- **Manual trigger over auto-detection** — screen-time/usage detection isn't possible in
  Expo Go and is out of scope for v1. The button and any future detector converge on the
  same `/execute/[planId]` route, so nothing needs restructuring later.
- **Local-only notifications** — remote push needs a server and doesn't work in Expo Go on
  Android since SDK 53. Daily repeating local notifications cover the check-in feature.
- **Cancel-all rescheduling over id tracking** — this app owns every scheduled
  notification, so `cancelAllScheduledNotificationsAsync()` + re-schedule is strictly
  simpler than persisting and reconciling notification ids.
- **`Stack.Protected` onboarding gate** — declarative: completing onboarding flips context
  state in `use-onboarding-status.tsx` and the router re-routes; no imperative
  `router.replace` choreography.
- **`useFocusEffect` reloads over global state** — with a handful of small screens, each
  tab re-reading storage on focus is simpler than a store, and can't go stale.
- **Timestamp-based countdown** — recomputing remaining time from a fixed `endsAt` can't
  drift and survives brief backgrounding, unlike a tick-decrement counter.
- **`bundled:` URI sentinel** — bundled default images are `require()`'d module ids, not
  files, so they can't have real URIs. The sentinel keeps `VisionBoardImage.uri: string`
  per spec; `lib/images.getImageSource()` is the single resolver.
- **Copy picked images to the document directory** — picker URIs point into the OS cache,
  which can be purged. Base64-in-AsyncStorage was rejected (multi-MB values hit Android's
  cursor-window limits). Uses the SDK 54 class-based expo-file-system API (`File`,
  `Directory`, `Paths`) — the legacy promise API is at `expo-file-system/legacy`; don't mix.
- **actionConfig as one optional-fields bag** (not a discriminated union) — the spec fixes
  the JSON shape, and it lets plan-form keep old field values when the user toggles action
  types. Safety for new action types comes from the exhaustive `never` switches instead.
- **Schema versioning from day one** — `redirect/schemaVersion` + `runMigrations()` in
  `lib/storage.ts` (called from `use-onboarding-status.tsx`) so V2 shape changes migrate
  old installs in one place.

## Explicitly out of scope (and where the hook goes)

- **Calendar sync** — would live in `lib/notifications.ts`: `rescheduleCheckIns()` is the
  single place check-in times become scheduled events; a calendar integration either feeds
  times into it or mirrors them to calendar events alongside it.
- **Notion sync** — would wrap `lib/storage.ts`: its typed get/set functions are the only
  persistence path, so a sync layer replaces/decorates those internals while keeping the
  exported API identical.
- **Automatic screen-time detection** — would replace the manual button's `onPress` in
  `app/(tabs)/index.tsx` with a background trigger that navigates to the same
  `/execute/[planId]` route (or calls `logTriggerFired` in `lib/plan-engine.ts` directly).
  Add `'automatic'` to `TriggerSource` in `types/models.ts`. Requires a dev build — usage
  APIs don't exist in Expo Go.
- **Payments** — provider/paywall wrapping would slot into `app/_layout.tsx` around
  `RootNavigator`, next to `OnboardingProvider`.
- **Backend/auth** — swap the internals of `lib/storage.ts` for an API client; every
  screen already goes through its five functions, so the API surface is the contract.

## Extending the model (adding a new actionType)

The compiler walks you through it — after step 1, `npx tsc --noEmit` fails at every site
that must handle the new type:

1. `types/models.ts` — add the variant to the `ActionType` union and any new config
   fields (optional) to `ActionConfig`.
2. `app/execute/[planId].tsx` — add a `case` to the `renderAction()` switch (the `never`
   default is currently failing compilation here).
3. `components/plan-form.tsx` — add the option to `ACTION_TYPES`, a config-input `case`
   to `renderConfig()`, and a validation `case` to `isPlanFormValueValid()`.
4. Optional: add a preset using it in `lib/presets.ts`, and a summary line in the plan
   card rendering in `app/(tabs)/plans.tsx` (that one is an if/else chain, not exhaustive).

No storage changes needed — plans serialize as-is. If the new config fields need defaults
on existing stored plans, add a migration in `MIGRATIONS` in `lib/storage.ts`.

## Known rough edges

- **Check-in times aren't editable after onboarding.** The data (`checkInTimes`) and API
  (`rescheduleCheckIns`) exist; there's just no settings UI. First candidate for a small
  V1.x feature — reuse `components/time-picker-row.tsx`.
- **Stored image URIs are absolute** (`file:///...Documents/vision-board/...`). On iOS the
  app container path can change across reinstalls/updates, which would orphan them.
  Acceptable for local-only v1; fix = store relative paths and resolve against
  `Paths.document` at read time in `lib/images.ts`.
- **Android daily notifications can arrive late** — inexact alarms/Doze; that's OS
  behavior, not a bug.
- **`ActionConfig.imageId` is honored by the execute screen but no UI sets it** — the
  vision-board action always shows a random image today; plan-form doesn't offer picking a
  specific one.
- **`caption` on VisionBoardImage is in the model but unused** by any UI.
- **One plan per failure point is assumed** by `stuck.tsx` and `plans.tsx`
  (`plans.find(p => p.failurePointId === ...)`), though the data model would allow more.
- **Dev double-mount guards** (`loggedRef` in execute, `handledDate` in `_layout`) are
  load-bearing — removing them causes duplicate TriggerLogs / repeated deep links.
- **No test suite** — verification is the manual sequence below plus strict TypeScript.

## How to verify a change didn't break the core loop

No test suite in v1 — run this manually in Expo Go after any nontrivial change:

1. **Reset:** delete the app from Expo Go (or bump nothing and reinstall) so onboarding
   shows. (Dev shortcut: call `resetOnboarding()` from `useOnboardingStatus`, but note it
   only flips the flag — old data remains.)
2. **Onboard:** pick at least one preset pattern → step 2 shows its suggested plan
   (edit it or accept as-is) → step 3 keep the 6 default images → step 4 set one check-in
   time ~2 minutes in the future → Finish → allow notifications → you should land on Home.
3. **Trigger:** tap "I'm Stuck" → the pattern you picked is listed → tap it → the action
   runs (timer counts down / image appears full-screen / message shows) → Done returns Home.
4. **Retro:** open the Retro tab → this week's group shows the log entry → tap "Helped" →
   the "What's working" ratio card appears/updates.
5. **Notification:** background the app, wait for the scheduled time → notification
   arrives → tapping it opens the plan picker (`/stuck`); a plan run from there shows up in
   Retro with a bell icon (source `scheduled`).
6. **Persistence:** force-quit and relaunch → still lands on Home (not onboarding), plans
   and logs intact.
7. **Static checks:** `npx expo start` once (regenerates typed routes), then
   `npx tsc --noEmit` must pass clean.
