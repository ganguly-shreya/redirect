# HANDOFF — Redirect v2

Redirect is a local-only habit/attention-correction app, now goals-first: users define
goals (why it matters, target date, vision-board images, quotes) and link failure
patterns ("phone scrolling mid-work") to them — a pattern can serve several goals, and
every pattern must be linked to at least one goal. Each pattern gets an if-then plan
(timer / visionBoard / custom message), fired via an "I'm Stuck" button or daily check-in
notifications. When a pattern fires, the visionBoard action shows a random image *or*
quote from the connected goals, always with the goal's title and why. Users rate
Helped/Didn't on the action screen in the moment (Retro keeps the chips as fallback), and
a daily recap notification reports how many times they won at redirecting their brain.
Expo SDK 54, Expo Go compatible, expo-router v6, TypeScript strict, no backend, no accounts.

This document is written for a model or developer with **zero context** on the build
conversation. Read this file plus `git log --oneline` and you know everything.

## Architecture

```
app/
  _layout.tsx              Root layout: OnboardingProvider, Stack.Protected gate,
                           notification handler + tap deep links (/stuck, /retro),
                           foreground refresh of scheduled notifications
  onboarding.tsx           4-step wizard (goals → plans → check-ins → recap time),
                           local useState; goals own images/quotes/failure modes;
                           step 2 red-outlines invalid plan cards/fields (PlanForm
                           showErrors) since Continue is disabled until all are valid
  stuck.tsx                Plan picker modal ("what loop are you in?"), forwards source param
  execute/[planId].tsx     Runs a plan's action; the ONLY place a TriggerLog is written;
                           in-the-moment Helped/Didn't chips; timer ends in "Ship it!"
  (tabs)/
    _layout.tsx            Bottom tabs: Home, Plans, Goals, Retro (Ionicons)
    index.tsx              Home: big "I'm Stuck" button, today's check-in times + count,
                           __DEV__-only "Reset all data" (wipes storage/images/notifications
                           and flips the onboarding gate — full re-test without reinstalling)
    plans.tsx              CRUD for FailurePoints + IfThenPlans (single-draft edit model);
                           each pattern must link to ≥1 goal (checklist in the draft)
    goals.tsx              Goals CRUD (replaces V1 vision-board tab): why, target date,
                           images, quotes, linked failure modes per goal
    retro.tsx              "Today" wins card, TriggerLogs grouped by week, outcome chips
                           (fallback), per-plan ratios
components/
  themed-text.tsx          ThemedText with type scale (title/subtitle/default/caption/link)
  themed-view.tsx          ThemedView (theme-aware background)
  themed-text-input.tsx    Theme-aware TextInput (card bg, hairline border)
  primary-button.tsx       Accent Pressable with haptic feedback; size="large" for "I'm Stuck"
  plan-form.tsx            Shared create/edit form for IfThenPlan + isPlanFormValueValid();
                           showErrors prop turns invalid fields red ("— required" labels)
                           so a disabled Continue/Save never leaves the user guessing
  goal-editor.tsx          Shared goal form (onboarding + Goals tab): GoalDraft type,
                           createEmptyGoalDraft(), isGoalDraftValid(); parent owns pools
                           and persistence via callbacks
  time-picker-row.tsx      One check-in/recap time row (iOS inline picker, Android dialog)
  date-picker-row.tsx      Same pattern for calendar dates (goal target date, min today)
  countdown-timer.tsx      mm:ss countdown, timestamp-based (drift-free), onComplete;
                           fires lib/alarm.ts playTimerCompletionAlert() on completion
  vision-image-grid.tsx    3-column grid (expo-image); remove badges OR selectable mode
                           (selectedIds/onToggleSelect, used by goal-editor)
  outcome-chips.tsx        Helped/Didn't chip pair (execute screen + retro rows)
  trigger-log-row.tsx      Retro row wrapping OutcomeChips
hooks/
  use-color-scheme.ts      Re-export of RN useColorScheme (+ .web.ts hydration-safe variant)
  use-theme-color.ts       useThemeColor(props, colorName) — resolves palette per scheme
  use-onboarding-status.tsx OnboardingProvider/useOnboardingStatus; owns hasOnboarded flag,
                           runs storage migrations at app start
lib/
  storage.ts               THE persistence layer: typed AsyncStorage wrapper + schemaVersion
                           migrations (currently 2). All reads/writes go through here.
  plan-engine.ts           logTriggerFired / setTriggerOutcome / pickGoalRedirectContent /
                           pickRandomVisionImage / computePlanStats — business logic, no UI
  notifications.ts         THE scheduling layer: permissions, rescheduleAllNotifications
                           (daily check-ins + one-shot recap with today's count),
                           refreshScheduledNotifications; exports STUCK_URL / RETRO_URL
  images.ts                Image persistence (copy picker results to document dir),
                           bundled-asset sentinel resolution, delete
  alarm.ts                 playTimerCompletionAlert(): haptic + looping vibration +
                           looping bundled alarm (expo-audio, playsInSilentMode: false —
                           ringer on = sound + vibration, silent switch = vibration
                           only); nags until stopTimerCompletionAlert() (execute screen:
                           Done, Helped/Didn't, or unmount) or a 10-min cap.
                           Module-level reused player, NOT a hook: the countdown
                           unmounts at completion (celebration view swaps in) and a
                           hook player would be released mid-sound.
  presets.ts               5 preset failure patterns + suggested plans + PRESET_QUOTES;
                           instantiatePreset() / instantiateQuote()
  id.ts                    createId() — timestamp + random suffix
types/
  models.ts                All domain types + StorageSchema (the storage key map)
constants/
  theme.ts                 Colors (light/dark), Spacing, Radius — the whole design system
assets/images/vision-board/  6 bundled default vision-board images (require()'d in lib/images.ts)
assets/sounds/timer-alarm.wav  generated triple-beep alarm played on timer completion
app.json                   Expo config; scheme "redirect", typedRoutes + reactCompiler on
```

## Data model (V2, goals-first)

- **Goal** — title, `why` (one-liner), `targetDate` (ISO), `imageIds` → visionBoardImages,
  `quoteIds` → quotes. Goals own the vision content.
- **Quote** — text + isPreset; pool seeded from `PRESET_QUOTES` at onboarding (or lazily by
  the Goals tab for pre-V2 installs).
- **FailurePoint.goalIds** — many-to-many; **invariant: every pattern links to ≥1 goal.**
  Enforced by construction in onboarding (patterns are created inside a goal's editor), by
  the required goal checklist in the Plans tab draft, by the Goals tab blocking a goal
  delete that would orphan a pattern, and by a confirm-then-delete when unlinking a
  pattern's last goal in the goal editor. Only un-edited pre-V2 patterns can have `[]`.
- `visionBoardImages` remains the storage pool for image records; goals reference into it.
- `recapTime: CheckInTime` — the user's daily recap notification time.

## Data flow (the core loop, traced)

1. **Tap "I'm Stuck"** — `app/(tabs)/index.tsx` renders a `PrimaryButton` whose `onPress`
   calls `router.push('/stuck')`.
2. **Pick a pattern** — `app/stuck.tsx` loads `failurePoints` and `plans` via
   `lib/storage.getCollection`, joins them (one plan per failure point), and on row tap
   calls `router.push({ pathname: '/execute/[planId]', params: { planId } })`. If it was
   opened by a notification tap it also forwards `source: 'scheduled'`.
3. **Execute** — `app/execute/[planId].tsx` reads `planId`/`source`, loads the plan, and in
   a mount `useEffect` (ref-guarded against double-mount) calls
   `logTriggerFired(planId, source)`, keeping the returned log in state for the chips.
4. **Log write** — `logTriggerFired` creates a `TriggerLog` (`outcome: null`), persists it
   via `storage.upsertInCollection('triggerLogs', log)`, then calls
   `refreshScheduledNotifications()` so the recap notification body carries today's count.
5. **Action renders** — exhaustive switch on `plan.actionType`:
   - `'visionBoard'`: `pickGoalRedirectContent(failurePoint, goals, images, quotes)` picks
     a random image or quote across the pattern's connected goals (uniform over the union,
     so both rotate); renders full-screen image + goal/why overlay, a quote card with
     goal/why footer, or — when the goals have no content — an accent goal card (title,
     why, days-to-go). Null content (pre-V2 pattern) falls back to the V1 random-pool image.
   - `'timer'`: `CountdownTimer`; on completion swaps to the "Ship it! 🚀 / Progress over
     Perfection!" celebration over a goal/vision image.
   - `'customMessage'`: centered message.
   The footer shows "Did this help?" + `OutcomeChips` (writes via `setTriggerOutcome`)
   and "Done" (`router.dismissAll()`).
6. **Retro read** — `app/(tabs)/retro.tsx` reloads `triggerLogs` on focus, shows the
   "Today" wins card, groups logs by `startOfWeek`, and renders `TriggerLogRow`s whose
   chips remain a fallback for runs not tagged in the moment. `computePlanStats` derives
   the helped/didn't ratios.

Notification paths join this loop: check-ins (`data.url = STUCK_URL`) open the plan picker
with `source: 'scheduled'`; the daily recap (`data.url = RETRO_URL`) opens the Retro tab.
Both are handled by the `useLastNotificationResponse` effect in `app/_layout.tsx`.

## Key decisions and why

- **AsyncStorage over SQLite** — every collection is small, read whole, never queried
  relationally. JSON blobs behind the typed `lib/storage.ts` API are simpler and add no
  native dependency. The wrapper is the seam if this ever changes.
- **Goals reference pools by id** (imageIds/quoteIds into shared collections) — images and
  quotes can be shared across goals without duplication; deleting a goal never destroys
  another goal's content.
- **Pattern↔goal invariant enforced at the edges, not by the storage layer** — onboarding,
  Plans tab validation, and Goals tab delete-blocking keep `goalIds` non-empty; storage
  stays a dumb typed wrapper.
- **Manual trigger over auto-detection** — screen-time/usage detection isn't possible in
  Expo Go and is out of scope. The button and any future detector converge on the same
  `/execute/[planId]` route.
- **Local-only notifications** — remote push needs a server and doesn't work in Expo Go on
  Android since SDK 53.
- **Cancel-all rescheduling over id tracking** — this app owns every scheduled
  notification; `rescheduleAllNotifications` cancel-alls and re-schedules check-ins + recap
  in one place.
- **Timer completion defers to the ringer switch** — expo-audio with
  `playsInSilentMode: false` plus an always-on vibration pattern means a silenced phone
  stays silent (vibrate only) and a ringing phone gets the alarm; no in-app sound setting
  to build or explain.
- **Recap is a one-shot DATE trigger with the count baked in** — local notifications can't
  compute content at fire time, so `refreshScheduledNotifications()` re-schedules it with
  today's count after every log write and on every app foreground. Accepted limitation: on
  a day the app is never opened, no recap fires (there are no wins to report; if the next
  occurrence is tomorrow, the generic body is used).
- **`Stack.Protected` onboarding gate**; **`useFocusEffect` reloads over global state**;
  **timestamp-based countdown**; **`bundled:` URI sentinel**; **copy picked images to the
  document directory**; **actionConfig as one optional-fields bag**; **schema versioning
  from day one** — all unchanged from V1 (see git history for the original rationale).
- **Goal editor is controlled + callback-driven** — `GoalEditor` edits a `GoalDraft` and
  asks its parent to grow the shared pools (pick images, add quotes, instantiate
  patterns). Onboarding keeps everything in component state until Finish; the Goals tab
  persists pools immediately but holds draft-created patterns pending until Save, so
  Cancel leaves storage consistent.

## Extending the model (adding a new actionType)

Unchanged from V1: add the variant in `types/models.ts`, a render case in
`app/execute/[planId].tsx`, options/config/validation in `components/plan-form.tsx`,
optionally a preset in `lib/presets.ts`. `npx tsc --noEmit` fails at every site that must
handle the new type until you do.

## Known rough edges

- **Check-in and recap times aren't editable after onboarding.** Data + API exist
  (`checkInTimes`, `recapTime`, `rescheduleAllNotifications`); no settings UI yet. Reuse
  `components/time-picker-row.tsx`.
- **Stored image URIs are absolute** (`file:///...Documents/vision-board/...`). On iOS the
  container path can change across reinstalls, orphaning them. Fix = store relative paths
  and resolve against `Paths.document` in `lib/images.ts`.
- **Pre-V2 installs**: migrated patterns have `goalIds: []` and fall back to V1 redirect
  behavior until edited (the Plans tab then forces a goal link). A migration can't invent
  goals.
- **Unreferenced pool content isn't garbage-collected** — images/quotes deselected from
  every goal stay in their pools (harmless; the V1 fallback still uses the image pool).
- **Android daily notifications can arrive late** — inexact alarms/Doze; OS behavior.
- **`ActionConfig.imageId` is honored by the execute screen's fallback path but no UI sets
  it**; goal-driven content has effectively superseded it.
- **One plan per failure point is assumed** by `stuck.tsx` and `plans.tsx`, though the
  data model would allow more.
- **Dev double-mount guards** (`loggedRef`/`logRef` in execute, `handledDate` in
  `_layout`) are load-bearing — removing them causes duplicate TriggerLogs / repeated
  deep links.
- **No test suite** — verification is the manual sequence below plus strict TypeScript.

## How to verify a change didn't break the core loop

No test suite — run this manually in Expo Go after any nontrivial change:

1. **Reset:** tap "Reset all data (dev)" at the bottom of Home (dev builds only) —
   storage, picked image files, and scheduled notifications are wiped and onboarding
   shows immediately. (Fallback: delete/reinstall Expo Go.)
2. **Onboard:** add a goal (title, why, target date; select images; pick a quote; link two
   failure modes — one preset, one custom) → step 2 shows a plan per linked pattern →
   step 3 set one check-in time ~2 min out → step 4 set a recap time ~4 min out →
   Finish → allow notifications → land on Home.
3. **Trigger:** tap "I'm Stuck" → pick the pattern → a visionBoard plan shows a goal
   image or quote with the goal + why (repeat runs to see rotation); a goal with no
   images/quotes shows the accent goal card. Tag "Helped" on the action screen → Done.
4. **Timer:** run a 1-min timer plan to the end → alarm beeps (or vibration only with the
   silent switch on) loop over "Ship it! / Progress over Perfection!" until Done or a
   Helped/Didn't tap silences them (10-min cap).
5. **Retro:** the "Today" card counts the runs; the in-the-moment tag is already set; an
   untagged run can still be tagged via the row chips.
6. **Goals/Plans invariants:** a new pattern in the Plans tab can't be saved without a
   goal; deleting a goal whose patterns have no other goal is blocked.
7. **Notifications:** background the app → check-in arrives → tap opens the plan picker
   (`/stuck`); recap arrives with today's count → tap opens Retro.
8. **Persistence:** force-quit and relaunch → still lands on Home, data intact (schema v2
   migration is idempotent).
9. **Static checks:** `npx expo start` once (regenerates typed routes), then
   `npx tsc --noEmit` must pass clean.
