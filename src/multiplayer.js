import { io } from 'socket.io-client';

const $ = id => document.getElementById(id);
const socket = io({ autoConnect: true, reconnection: true, reconnectionAttempts: 8, timeout: 8000 });

let myId = null;
let currentState = null;
let hasMarkedReady = false;

const lobbyShell = $('lobbyShell');
const roomShell = $('roomShell');
const matchReadyShell = $('matchReadyShell');
const liveMatchShell = $('liveMatchShell');
let latestMatch = null;
let deliveryStartedAt = 0;
let shotLocked = false;
let lastCelebratedInnings = 1;
let lastCelebratedResult = '';

function feedback(message, isError = false) {
  $('lobbyFeedback').textContent = message;
  $('lobbyFeedback').classList.toggle('error', isError);
}
function roomFeedback(title, text) {
  $('roomStageTitle').textContent = title;
  $('roomStageText').textContent = text;
}
function showOnly(section) {
  lobbyShell.classList.toggle('hidden', section !== 'lobby');
  roomShell.classList.toggle('hidden', section !== 'room');
  matchReadyShell.classList.toggle('hidden', section !== 'ready');
  liveMatchShell.classList.toggle('hidden', section !== 'live');
}
function emitAck(event, payload = {}) {
  return new Promise(resolve => {
    socket.timeout(6000).emit(event, payload, (err, response) => {
      if (err) resolve({ ok: false, error: 'Server did not respond. Check that both terminals are running.' });
      else resolve(response || { ok: false, error: 'No response from server.' });
    });
  });
}
function nameValue() {
  return $('playerName').value.trim().slice(0, 16) || 'Player';
}
function playerName(state, id) {
  return state.players.find(p => p.id === id)?.name || 'Player';
}
function showRoomState(state) {
  currentState = state;
  myId = socket.id;
  showOnly('room');
  $('roomCodeDisplay').textContent = state.code;
  $('playerOneName').textContent = state.players[0]?.name || 'Waiting…';
  $('playerTwoName').textContent = state.players[1]?.name || 'Waiting for friend';
  $('playerOneStatus').textContent = state.players[0] ? (state.players[0].id === myId ? 'You are here' : 'Connected') : 'Not connected';
  $('playerTwoStatus').textContent = state.players[1] ? (state.players[1].id === myId ? 'You are here' : 'Connected') : 'Not connected';

  const isHost = state.hostId === myId;
  $('startTossBtn').classList.toggle('hidden', !(isHost && state.players.length === 2 && state.phase === 'waiting'));
  $('decisionActions').classList.toggle('hidden', state.phase !== 'toss-result' || state.toss?.winnerId !== myId);
  $('readyActions').classList.toggle('hidden', state.phase !== 'choice-made');
  $('tossResult').textContent = '';
  $('tossCoin').classList.toggle('flipping', state.phase === 'toss-result');

  if (state.phase === 'waiting') {
    roomFeedback(state.players.length === 2 ? 'Both players connected' : 'Waiting for opponent', state.players.length === 2 ? 'The host can now start the toss. The server will flip the coin and select the winner.' : 'Share the room code. Your friend can join from another device or browser.');
  } else if (state.phase === 'toss-result') {
    const winner = state.toss?.winnerName || 'Player';
    $('tossCoin').classList.remove('flipping');
    $('tossResult').textContent = `${state.toss.call} · ${winner} WINS THE TOSS`;
    if (state.toss.winnerId === myId) {
      roomFeedback('You won the toss!', 'Choose whether you want to bat first or field first. Your choice will be shared with your opponent.');
    } else {
      roomFeedback(`${winner} won the toss`, 'Waiting for the toss winner to choose bat or field. You cannot change their decision.');
    }
  } else if (state.phase === 'choice-made') {
    $('tossCoin').classList.remove('flipping');
    $('tossResult').textContent = `${state.choice === 'bat' ? 'BAT FIRST' : 'FIELD FIRST'} · DECISION CONFIRMED`;
    const batting = playerName(state, state.battingPlayerId);
    const bowling = playerName(state, state.bowlingPlayerId);
    $('roleSummary').innerHTML = `<div><span>BAT FIRST</span><strong>${batting}</strong></div><div><span>BOWL FIRST</span><strong>${bowling}</strong></div>`;
    $('readyBtn').disabled = state.readyIds.includes(myId);
    $('readyBtn').textContent = state.readyIds.includes(myId) ? 'READY ✓' : "I'M READY";
    $('readyStatus').textContent = `${state.readyIds.length}/2 players ready. Both players must confirm.`;
    roomFeedback('Innings order confirmed', 'The toss winner has made a final choice. Both players must confirm before the match setup is locked.');
  } else if (state.phase === 'match-ready') {
    showOnly('ready');
    $('matchReadyText').textContent = `Room ${state.code} · ${state.players.map(p => p.name).join(' vs ')}`;
    $('firstInningsName').textContent = playerName(state, state.battingPlayerId);
    $('secondInningsName').textContent = playerName(state, state.bowlingPlayerId);
  } else if (state.phase === 'playing' || state.phase === 'complete') {
    showOnly('live');
    renderMatch(latestMatch, state);
  }
}



function showScoreFlash(label, effect = 'boundary') {
  const flash = $('scoreFlash');
  const text = $('scoreFlashText');
  if (!flash || !text) return;
  text.textContent = label;
  flash.classList.remove('show');
  flash.classList.toggle('wicket', effect === 'wicket');
  void flash.offsetWidth;
  flash.classList.add('show');
  const sceneWrap = $('scene-wrap');
  sceneWrap?.classList.remove('screen-shake');
  void sceneWrap?.offsetWidth;
  sceneWrap?.classList.add('screen-shake');
  paperCelebration(effect === 'victory' ? 'victory' : effect);
  window.setTimeout(() => {
    flash.classList.remove('show');
    sceneWrap?.classList.remove('screen-shake');
  }, 1050);
}

// Full-screen paper/confetti effect only: no blocking celebration dialog.
// pointer-events:none ensures it can never block the game controls.
function paperCelebration(kind = 'boundary') {
  const layer = $('paperCelebration');
  if (!layer) return;
  layer.replaceChildren();
  layer.className = `paper-celebration ${kind}`;
  const count = kind === 'victory' ? 90 : 48;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('i');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.animationDelay = `${Math.random() * 1.1}s`;
    bit.style.animationDuration = `${2.4 + Math.random() * 2.2}s`;
    bit.style.setProperty('--drift', `${(Math.random() - 0.5) * 180}px`);
    bit.style.setProperty('--spin', `${360 + Math.random() * 900}deg`);
    layer.append(bit);
  }
  window.setTimeout(() => {
    layer.replaceChildren();
    layer.className = 'paper-celebration';
  }, 5200);
}

function renderMatch(match, roomState = currentState) {
  if (!roomState) return;
  const battingId = match?.battingPlayerId || roomState.innings?.battingPlayerId || roomState.battingPlayerId;
  const bowlingId = match?.bowlingPlayerId || roomState.innings?.bowlingPlayerId || roomState.bowlingPlayerId;
  const innings = match?.innings || roomState.innings || {};
  const data = match?.match || latestMatch?.match || {};
  const myBatting = socket.id === battingId;
  const myBowling = socket.id === bowlingId;
  $('liveMatchTitle').textContent = roomState.players.map(p => p.name).join('  VS  ');
  $('liveScore').textContent = `${data.runs ?? innings.runs ?? 0}/${data.wickets ?? innings.wickets ?? 0}`;
  $('liveOvers').textContent = `${Math.floor((data.balls ?? innings.balls ?? 0)/6)}.${(data.balls ?? innings.balls ?? 0)%6} / 1 OVER`;
  $('scoreValue').textContent = `${data.runs ?? innings.runs ?? 0}/${data.wickets ?? innings.wickets ?? 0}`;
  $('oversValue').innerHTML = `${Math.floor((data.balls ?? innings.balls ?? 0)/6)}.${(data.balls ?? innings.balls ?? 0)%6} <small>/ 1.0</small>`;
  $('lastBallValue').textContent = data.lastResult || '—';
  $('inningsLabel').textContent = `${data.inningsNumber === 2 || innings.number === 2 ? '2ND' : '1ST'} INNINGS`;
  $('targetLabel').textContent = data.target ? `TARGET ${data.target}` : 'TARGET —';
  $('roleLabel').textContent = myBatting ? 'YOUR ROLE · BATTER' : myBowling ? 'YOUR ROLE · BOWLER' : 'SPECTATOR';
  window.dispatchEvent(new CustomEvent('match:role', { detail: { role: myBatting ? 'batting' : myBowling ? 'bowling' : 'spectator' } }));
  $('bowlerControls').classList.toggle('hidden', !myBowling || data.status === 'complete');
  $('batterControls').classList.toggle('hidden', !myBatting || data.status === 'complete');
  $('bowlNowBtn').disabled = !!data.delivery || data.status === 'complete';
  $('liveHitBtn').disabled = !data.delivery || shotLocked || data.status === 'complete';
  $('mobileBowlBtn').disabled = !!data.delivery || data.status === 'complete';
  $('mobileHitBtn').disabled = !data.delivery || shotLocked || data.status === 'complete';
  $('mobileActionDock').classList.toggle('hidden', data.status === 'complete' || (!myBatting && !myBowling));
  $('mobileBowlBtn').classList.toggle('hidden', !myBowling);
  $('mobileHitBtn').classList.toggle('hidden', !myBatting);
  $('liveStatus').textContent = data.status === 'complete' ? 'MATCH COMPLETE' : data.delivery ? (myBatting ? 'BALL COMING — TIME YOUR SHOT' : 'DELIVERY IN PROGRESS') : myBowling ? 'YOUR TURN — SELECT PACE AND BOWL' : 'WAITING FOR THE NEXT DELIVERY';
  $('lastResult').textContent = data.lastResult || 'Match ready';
  const inningsNumber = Number(data.inningsNumber || innings.number || 1);
  if (inningsNumber === 2 && lastCelebratedInnings === 1 && data.firstInningsScore !== null && data.firstInningsScore !== undefined) {
    lastCelebratedInnings = 2;
    const firstBattingName = playerName(roomState, roomState.battingPlayerId);
    const firstBowlingName = playerName(roomState, roomState.bowlingPlayerId);
    $('liveStatus').textContent = `INNINGS BREAK · ${firstBattingName} ${data.firstInningsScore}/${data.firstInningsWickets ?? 0}`;
    $('lastResult').textContent = `${firstBowlingName} needs ${data.target} runs to win`;
    paperCelebration('innings');
  }
  if (data.status === 'complete') {
    $('liveStatus').textContent = 'FULL TIME';
    $('lastResult').textContent = data.lastResult || 'Match complete';
    if (lastCelebratedResult !== data.lastResult) {
      lastCelebratedResult = data.lastResult || 'complete';
      const won = data.winnerId === socket.id;
      const tied = !data.winnerId;
      $('liveStatus').textContent = tied ? 'MATCH TIED' : won ? '🏆 YOU WIN!' : 'MATCH OVER · YOU LOST';
      $('lastResult').textContent = data.lastResult || 'Full time';
      if (won) showScoreFlash('WIN!', 'victory');
      else if (tied) paperCelebration('innings');
    }
  }
}
function playBallVisual(duration, pace = 'medium') {
  window.dispatchEvent(new CustomEvent('cricket:delivery-start', { detail: { duration, pace } }));
  shotLocked = false;
  $('liveHitBtn').disabled = false;
  $('mobileHitBtn').disabled = false;
  $('liveStatus').textContent = 'BALL RELEASED — WATCH CLOSELY';
}
socket.on('match:state', payload => {
  latestMatch = payload;
  showOnly(payload.match?.status === 'complete' || payload.phase === 'playing' ? 'live' : 'live');
  renderMatch(payload);
});
socket.on('delivery:started', payload => {
  deliveryStartedAt = payload.startedAt;
  playBallVisual(payload.duration, payload.pace);
});
socket.on('batter:swung', () => window.dispatchEvent(new CustomEvent('cricket:batter-swing')));
socket.on('delivery:result', outcome => {
  window.dispatchEvent(new CustomEvent('cricket:delivery-result', { detail: outcome }));
  if (outcome.wicket) {
    $('lastResult').textContent = outcome.label || 'WICKET!';
    $('liveStatus').textContent = 'WICKET!';
    showScoreFlash('WICKET', 'wicket');

  } else if (outcome.runs === 6) {
    $('lastResult').textContent = 'SIX! · MAXIMUM';
    $('liveStatus').textContent = 'SIX! · 6 RUNS';
    showScoreFlash('6', 'boundary');
  } else if (outcome.runs === 4) {
    $('lastResult').textContent = 'FOUR! · BOUNDARY';
    $('liveStatus').textContent = 'FOUR! · 4 RUNS';
    showScoreFlash('4', 'boundary');
  }
});
socket.on('match:state', payload => {
  if (payload.match?.lastResult) $('lastResult').textContent = payload.match.lastResult;
});

socket.on('connect', () => {
  $('connectionDot').classList.add('connected');
  $('connectionText').textContent = 'MATCH SERVER CONNECTED';
  feedback('Connected. Create a room or join your friend.');
});
socket.on('disconnect', () => {
  $('connectionDot').classList.remove('connected');
  $('connectionText').textContent = 'RECONNECTING…';
  feedback('Connection lost. Trying to reconnect…', true);
});
socket.on('connect_error', () => {
  $('connectionDot').classList.remove('connected');
  $('connectionText').textContent = 'SERVER OFFLINE';
  feedback('Cannot reach the game server. Start the project using npm run dev.', true);
});
socket.on('room:state', showRoomState);

$('createRoomBtn').addEventListener('click', async () => {
  const result = await emitAck('room:create', { name: nameValue() });
  if (!result.ok) return feedback(result.error, true);
  feedback(`Room ${result.code} created. Share the code with your friend.`);
});
$('joinRoomBtn').addEventListener('click', async () => {
  const result = await emitAck('room:join', { name: nameValue(), code: $('roomCodeInput').value });
  if (!result.ok) return feedback(result.error, true);
  feedback(`Joined room ${result.code}.`);
});
$('roomCodeInput').addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
});
$('startTossBtn').addEventListener('click', async () => {
  $('startTossBtn').disabled = true;
  $('tossCoin').classList.add('flipping');
  const result = await emitAck('toss:start');
  if (!result.ok) {
    $('tossCoin').classList.remove('flipping');
    $('startTossBtn').disabled = false;
    roomFeedback('Cannot start toss', result.error);
  }
});
$('chooseBatBtn').addEventListener('click', async () => {
  const result = await emitAck('toss:choose', { decision: 'bat' });
  if (!result.ok) roomFeedback('Choice not accepted', result.error);
});
$('chooseFieldBtn').addEventListener('click', async () => {
  const result = await emitAck('toss:choose', { decision: 'field' });
  if (!result.ok) roomFeedback('Choice not accepted', result.error);
});
$('readyBtn').addEventListener('click', async () => {
  $('readyBtn').disabled = true;
  const result = await emitAck('match:ready');
  if (!result.ok) {
    $('readyBtn').disabled = false;
    $('readyStatus').textContent = result.error;
  }
});

async function bowlDelivery() {
  if ($('bowlNowBtn').disabled) return;
  $('bowlNowBtn').disabled = true;
  $('mobileBowlBtn').disabled = true;
  const result = await emitAck('delivery:bowl', { pace: $('livePace').value });
  if (!result.ok) {
    $('bowlNowBtn').disabled = false;
    $('mobileBowlBtn').disabled = false;
    $('lastResult').textContent = result.error;
  }
}
$('bowlNowBtn').addEventListener('click', bowlDelivery);
$('mobileBowlBtn').addEventListener('click', bowlDelivery);
async function submitShot() {
  if ($('liveHitBtn').disabled || shotLocked) return;
  shotLocked = true;
  $('liveHitBtn').disabled = true;
  $('mobileHitBtn').disabled = true;
  const result = await emitAck('batter:shot', { clientElapsed: Date.now() - deliveryStartedAt });
  if (!result.ok) {
    shotLocked = false;
    $('liveHitBtn').disabled = false;
    $('mobileHitBtn').disabled = false;
    $('lastResult').textContent = result.error;
  } else {
    $('liveStatus').textContent = 'SHOT PLAYED — WAITING FOR UMPIRE';
  }
}
$('liveHitBtn').addEventListener('click', submitShot);
$('mobileHitBtn').addEventListener('click', submitShot);
window.addEventListener('keydown', event => {
  if (event.code === 'Space' && !liveMatchShell.classList.contains('hidden')) {
    event.preventDefault();
    submitShot();
  }
});
$('leaveMatchBtn').addEventListener('click', async () => {
  await emitAck('room:leave');
  latestMatch = null;
  showOnly('lobby');
  feedback('You left the match.');
});

$('copyRoomCodeBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('roomCodeDisplay').textContent);
    $('copyRoomCodeBtn').textContent = 'COPIED ✓';
  } catch {
    $('copyRoomCodeBtn').textContent = 'SELECT CODE ABOVE';
  }
});
$('leaveRoomBtn').addEventListener('click', async () => {
  await emitAck('room:leave');
  currentState = null;
  hasMarkedReady = false;
  $('startTossBtn').disabled = false;
  showOnly('lobby');
  feedback('You left the room. Create or join another match.');
});

showOnly('lobby');


// Portrait-phone guard. Fullscreen is requested only after the player taps,
// because browsers do not permit websites to force fullscreen automatically.
function updateOrientationPrompt() {
  const prompt = $('rotateOverlay');
  if (!prompt) return;
  const phonePortrait = window.matchMedia('(max-width: 800px) and (orientation: portrait)').matches;
  prompt.classList.toggle('hidden', !phonePortrait);
}
window.addEventListener('resize', updateOrientationPrompt);
window.addEventListener('orientationchange', updateOrientationPrompt);
updateOrientationPrompt();
$('rotateFullscreenBtn')?.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (screen.orientation?.lock) await screen.orientation.lock('landscape').catch(() => {});
  } catch (error) {
    // Rotation still works manually even if fullscreen is blocked by the browser.
  }
  updateOrientationPrompt();
});
