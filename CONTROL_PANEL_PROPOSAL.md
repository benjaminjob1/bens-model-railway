# Railway control panel proposal

Branch: `feature/railway-control-panel`, based on the tested `preview/railway-refinements` commit `b916837`.

This is a proposal for review before implementation. It can later be merged into the preview branch after the existing fixes have been tested. The fixes and proposal are published on separate GitHub branches.

## Appearance

Keep the existing dark-and-gold theme, animated train, page sections and content order. Expand the small Layout/Random control into a compact **Train controls** button. Opening it reveals a panel in the same style; closing it returns to the compact button. On phones the panel should wrap within the screen and avoid covering navigation or consent dialogs.

Example expanded arrangement:

```text
Train controls                          Close
[Pause trains]    Speed  [----●----]  1×
[Sound: muted]    Track  [Layout] [Random]
Signals: S1 Stop · S2 Proceed · S3 Stop
```

## Behaviour

- Run/Pause freezes and resumes the current train positions without restarting the layout. Pausing also stops train ambience.
- Speed offers a labelled range of 0.5× to 2×, initially 1×. This changes movement speed rather than sound pitch.
- Sound uses the existing shared consent/mute preference across both pages. The panel never enables audio without an explicit user action.
- Layout keeps the normal track; Random generates a new layout only when pressed. Changing sound, speed or panel visibility never regenerates the track.
- Signals retain their current behaviour, with explicit Stop/Proceed labels in addition to colour. All controls support keyboard use and visible focus.
- Reduced-motion preferences remain respected; speed controls explain when motion is disabled by that preference.

## Review and verification

Before implementation, review the existing preview on desktop and phone, especially the restored styling, sound consent, navigation, gallery and signals. Then review this proposal for control placement and interaction changes.

The feature will need checks for pause/resume position continuity, speed changes without resets, shared sound state, keyboard/touch operation, reduced motion and mobile overflow. Capture matching before/after views. Keep it separate until the user approves merging it into the preview branch.

Replacing photographs, railway models, heritage descriptions or the overall page layout is a separate future proposal.

## Revision after preview testing

- **Placement:** the floating bottom-right button is gone. A compact **Trains** button now sits in each page's nav bar (beside the sound button; icon-only under 480px). The panel drops down from the nav bar like the mobile menu, only while open, and closes with Close, the Trains button or Escape. A page without the nav slot falls back to the old bottom-right position.
- **Per-train control:** "Individual trains" (collapsible) lists Train 1, 2… with Pause/Run and a 0.5×–2× speed each. Effective speed = Speed (all) × the train's speed. Pause all stops everything; Run all resumes everything, including individually paused trains; running one train while all are paused starts only that train. Locomotives show a small number badge matching the list when there is more than one.
- **Fixes:** stale locomotives from a previous layout no longer stay frozen on screen; a drag that never saw its release no longer freezes every train; trains follow a continuous route (loop → branch out and back → rest of loop) instead of jumping between the loop and branch; the rail-flow animation follows the speed and pauses with the trains and is off under reduced motion.
