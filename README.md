
# One Over Cricket — Stage 5: Synchronized 3D multiplayer gameplay

## Run
Requires Node.js 20.19+ or 22.12+.
```powershell
npm install
npm run dev
```
Open the Vite Network URL on both devices. Both devices must be on the same Wi-Fi for LAN testing. Allow Node.js through Windows Firewall on private networks.

## Flow
1. Create room on device 1; join room code on device 2.
2. Host starts toss; toss winner chooses bat or field.
3. Both players confirm ready.
4. First innings starts. The bowler sees the pace selector; the batter sees the shot button.
5. Bowler selects slow / medium / fast and clicks BOWL DELIVERY.
6. Batter presses SPACE or PLAY SHOT to attempt contact.
7. Server adjudicates timing, updates runs/wickets/balls and sends the same score to both players.
8. After six balls, roles switch and the second innings starts with the target.
9. Match ends when target is reached or six balls are completed.

## Screen-fit fixes
Toss and room cards now use dynamic viewport height, safe-area padding, internal scrolling on short screens, and compact layouts for narrow phones. The match panel is responsive and fits desktop/mobile viewports.

## Multiplayer authority
The server enforces who can bowl and who can bat, chooses delivery pace privately on the bowler's request, adjudicates shot timing using server receipt time, and owns the score. The pace selection control is rendered only for the current bowler.



## Stage 5 gameplay notes

The multiplayer match now renders deliveries in the actual Three.js stadium scene instead of the previous 2D pitch graphic. Both devices receive the same delivery start, pace, batter swing, and server-adjudicated result. The bowler performs a run-up and delivery gather; the ball travels down the 3D pitch; the batter swings; and both clients animate a ground shot, boundary/lofted shot, or bowled wicket. The score remains server-authoritative. Role-based batting/bowling cameras are selected automatically.

The player models are stylized procedural Three.js models, not motion-captured characters. Ball movement is a synchronized visual animation, not a full rigid-body physics simulation with bat collision or fielders.


## Stage 5.1 mobile controls and camera preference
- On phones, the active player gets a large fixed bottom action button: BOWL DELIVERY or TAP TO BAT.
- The mobile action dock respects the device safe-area and touch interaction.
- Camera selection is now player-controlled. Changing roles or starting a delivery will not force a camera switch. Use the Batting/Bowling view controls to choose the angle, and it remains selected until the player changes it.
- Desktop keyboard SPACE batting remains available.


## Stage 5.2 — gameplay polish
- Camera view controls are moved into a clear top-right toolbar layer so the live match panel does not cover the batting/bowling view selector.
- The multiplayer ball flight is timed to reach the batter around the server's shot-timing window (78% of the delivery clock), then waits at the hitting zone for the result. Pace affects the flight duration.
- The ball now drops to the pitch, rebounds, descends into the batter's hitting zone, and visibly spins during flight and shot travel.
- A successful batter input triggers the existing 3D bat swing; the server broadcasts the same result to both clients and both clients animate the resulting ball path.
- Boundary and wicket moment overlays; first-innings score/target break popup; separate victory, defeat and tie full-time screens with celebration confetti for the winner.
- First innings runs, wickets and balls are retained by the server before the chase starts.
- The existing 3D characters remain stylized procedural models, not motion-captured realistic humans. The game still uses a timing-based server result rather than physical bat/ball collision detection.


### Stage 5.2.1 celebration adjustment
- Removed the blocking FOUR/SIX/WICKET celebration popup and its Continue button.
- FOUR and SIX now trigger only a full-screen falling-paper animation over the live 3D match.
- The animation uses `pointer-events: none`, so it cannot block batting, bowling, camera, or other game controls.
- Innings-break and full-time outcomes are shown in the existing match status/score area instead of a modal.
- A winner sees the falling-paper victory effect; the losing player sees the result text without a blocking overlay.


## Stage 5.3 — cricket match flow and mobile layout
- Multiplayer match panel is anchored on the left on desktop and compact left side in landscape phone mode, leaving the pitch and camera toolbar visible.
- Score HUD displays live runs/wickets, overs and last delivery; the server match state feeds it.
- On mobile landscape, the score HUD is placed at the right; portrait phones see a rotate prompt. The prompt offers a user-initiated fullscreen request. Browsers may still require manual rotation and may decline orientation lock.
- FOUR, SIX and WICKET show a large transient number/message, falling paper and a short camera/scene shake; there is no blocking modal or Continue button.
- A single wicket ends the current player's innings in this one-wicket-per-player match format. First innings then switches to the other player with target = first innings runs + 1. A wicket in the chase ends the match and the first player wins unless the target has already been reached.
- Six balls also end an innings; reaching the target ends the chase immediately.
- The game is a simplified head-to-head one-over format, not a standard eleven-player cricket innings. One wicket per player is used so that both participants get a batting turn.


## Stage 5.4 — professional gameplay-first interface
- Rebuilt the match overlay layout to remove the overlapping duplicate score HUD.
- One compact scoreboard/match card sits on the left on desktop and landscape mobile.
- Camera controls remain at the top-right, with no bowling pace selector beside them.
- Bowling speed appears only inside the bowler's match card. Batters do not see any bowling-speed control.
- Desktop batting/bowling action remains inside the compact match card.
- Touchscreen landscape devices get one large active action button at bottom-centre (BOWL DELIVERY or TAP TO BAT); the in-card action button is hidden to avoid duplicates.
- The field/3D scene remains the visual priority, with the old duplicate score HUD, scene HUD, scene help and bottom information bar hidden during gameplay.
- Portrait phone warning remains active.


## Stage 5.5 — requested control refinements
- Added a compact Details toggle in the camera palette. It hides/shows the match information card without hiding the mobile action dock.
- Camera palette is now transparent/minimal with subtle outlined controls rather than a large opaque toolbar.
- Added Batter, Bowler, Side and Back camera presets. Camera selection remains manual and is not changed automatically when a delivery starts.
- Removed the large `gameMessage` waiting banner from the pitch view.
- On touch devices with a short/landscape viewport, show one role-aware bottom-centre action: TAP TO BAT for the batter or BOWL DELIVERY for the bowler. The in-card duplicate action is hidden on those devices.
- Kept bowling pace only inside the bowler's match details; the batter does not get the speed selector.


## Stage 5.6 — transparent match panel
- Made the live multiplayer match information card translucent with a subtle glass blur.
- Reduced the heavy shadow and softened the border so the pitch remains visible behind the panel.
- Made the innings strip translucent as well, while preserving readable text and usable controls.


# Stage 6.1 — delivery and bat-contact pass

This stage builds on the existing Stage 5.6 gameplay-first UI and transparent match panel.

## Gameplay changes
- A clearer bowling sequence: short run-up, gather/plant, overarm release and follow-through.
- The ball is animated from the bowler's release point toward the batter with a visible drop, pitch bounce, rebound and final approach.
- Flight timing is aligned to the server's 78% shot-timing point for all three pace settings. The run-up/gather durations are calibrated so fast deliveries also reach the contact zone before the timing window.
- The server remains authoritative for shot timing and outcome. The client queues the server result until the rendered ball reaches the batter, then begins the contact/shot animation.
- A brief 3D contact flash appears at the ball position, and the ball then follows a ground or lofted trajectory based on the server result.
- Batter swing/miss animations are broadcast to both clients.
- The wicket path animates the ball through the stumps and triggers the wicket animation.

## Important scope
- This is a more coherent synchronized animation pass, not a full rigid-body physics simulation.
- Bat-ball contact is synchronized to the authoritative timing result, but there is not yet a physical collision solver or a manually rigged motion-captured bowler.
- The player models remain the existing stylized procedural models.
- Server-side outcome probabilities and room/match rules are retained from the previous stage.

## Run
```powershell
npm install
npm run dev
```


# Stage 6.2 — bowling animation crash fix

## Bug fixed
The 3D animation loop referenced `pace` as an undeclared variable inside `updateNetworkGameplay()`. When the ball entered the flight phase, this raised a `ReferenceError`, stopping the render/update loop. The server's no-shot timeout then resolved the delivery as a wicket, which looked like the bowler animation had frozen and the game immediately called wicket.

The animation now reads the selected pace from the active delivery state (`d.pace`), so the flight animation can continue for slow, medium and fast deliveries.

## Additional safety fix
- The server's delivery timeout now checks the exact delivery object token, preventing an old timeout from resolving a later delivery.

## Run
Extract this project into a new folder and run:
```powershell
npm install
npm run dev
```


# Stage 6.3 — bowling pace rebalance

Adjusted the authoritative server delivery durations and matching 3D flight animation:
- Slow: 2,200 ms (displayed as approx. 90 km/h)
- Medium: 1,550 ms (approx. 125 km/h)
- Fast: 1,100 ms (approx. 150 km/h)

The bowler run-up/gather is shortened to 0.38 seconds so the ball's travel time has more room to express the difference between pace settings. The rendered ball reaches the batter at the server's 78% timing point. This keeps the shot timing calculation synchronized with the visible ball arrival.


# Stage 6.5 — faster bowling timings

Updated delivery durations as requested:
- Slow: 1.9 seconds (1900 ms)
- Medium: 1.4 seconds (1400 ms)
- Fast: 1.0 second (1000 ms)

Adjusted the minimum rendered flight duration so the 1000 ms fast delivery can still reach the batter at the server's 78% timing point. This preserves the shot-timing synchronization rather than letting the ball arrive after the server has already judged the shot.


## Stage 6.6 improvements
- More detailed pitch wear, mowing stripes, stadium roof ring and roof supports.
- Improved rendering balance and stadium lighting presentation.
- More expressive batter swing with wind-up, fast downswing and follow-through.
- Shot flight now uses a gravity-shaped ballistic arc with launch energy based on the awarded shot.
- Procedural bat-contact, pitch-bounce, wicket-impact and crowd-reaction sounds using browser audio; no external audio downloads required.
- Sound On/Off control in the camera toolbar. Audio begins after the first user interaction due to browser autoplay rules.
- Multiplayer score and outcome remain server-authoritative; the client-side trajectory is visual only.


## Stage 6.7 fixes
- Removed the literal `\n` text between the Back and Sound toolbar controls.
- Fixed first-click sound unlocking so clicking Sound On does not immediately switch it off.
- Increased and layered continuous synthetic stadium crowd ambience with slow crowd swells.
- Added stronger crowd roar and applause accents after boundaries and sixes.
- Audio is generated locally with Web Audio; no recorded crowd tracks are downloaded or streamed.


## Stage 6.8 missed-delivery fix
- A missed ball no longer freezes beside the batter while waiting for the server.
- After reaching the batter, the ball continues directly toward the stumps with a short, smooth animation.
- The server now adjudicates a no-input delivery at the same 78% delivery timing point as the visual ball, plus a 120 ms network grace period.
- The server remains authoritative for the wicket and score; both players receive the same result event.


## Stage 6.9.1 gameplay recovery
- Restored the complete Stage 6.8 3D scene and multiplayer gameplay code.
- Removed the incomplete Stage 6.9 animation changes that caused a runtime error before the render call.
- Kept the missed-delivery animation, stadium sound, batting/ball trajectory, and all prior working multiplayer features.
- This recovery build prioritizes restoring the playable game. The five new player/fielding/celebration features are not included in this recovery build and should be reintroduced incrementally with runtime testing.


## Stage 6.9.2 batting timing fix
- Fixed a server timeout race: the no-input timer now checks the exact delivery object and exits if the batter has already submitted a shot.
- Expanded the good-contact timing window from ±120 ms to ±350 ms to account for real human reaction and network latency.
- Early/late timing up to 650 ms awards one run; up to 900 ms becomes a dot ball rather than an automatic wicket.
- Only a very badly mistimed submitted shot becomes a wicket; no-input deliveries still become bowled.
- Re-enables the mobile TAP TO BAT button at the start of every delivery.


## Deploy publicly on Render (Stage 6.9.3)
This version is prepared as a single Node web service. The Express server serves
the built Vite site and the Socket.IO multiplayer endpoint from the same origin.

1. Push this project folder to a GitHub repository (include `render.yaml`).
2. In Render, choose **New + → Blueprint** and connect that GitHub repository.
3. Render reads `render.yaml`; confirm creation of the `one-over-cricket` web service.
4. Wait for the deploy to finish. Open the `onrender.com` URL shown by Render.
5. Share that same URL with the second player. Both players should use the same
   public URL; do not use the local LAN IP or Vite port for the deployed match.

Local development remains:
- `npm install`
- `npm run dev`

Production build check:
- `npm install`
- `npm run build`
- `npm start`
