import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomInt } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 20000
});

const PORT = Number(process.env.PORT || 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../dist');
const rooms = new Map();
// Ball flight durations (milliseconds). Faster settings have a noticeably
// shorter release-to-batter time, while preserving the shared timing window.
const PACE = {
  slow: { duration: 1900 },
  medium: { duration: 1400 },
  fast: { duration: 1000 }
};

function cleanName(value) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'Player';
}
function makeCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
  } while (rooms.has(code));
  return code;
}
function publicState(room) {
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    players: room.players.map(p => ({ id: p.id, name: p.name })),
    toss: room.toss ? { call: room.toss.call, winnerId: room.toss.winnerId, winnerName: room.players.find(p => p.id === room.toss.winnerId)?.name || 'Player' } : null,
    choice: room.choice,
    battingPlayerId: room.battingPlayerId,
    bowlingPlayerId: room.bowlingPlayerId,
    readyIds: [...room.readyIds],
    innings: room.innings,
    match: room.match ? { ...room.match, delivery: room.match.delivery ? { active: true, startedAt: room.match.delivery.startedAt, duration: room.match.delivery.duration } : null } : null
  };
}
function emitState(room) {
  io.to(room.code).emit('room:state', publicState(room));
}
function replyError(ack, message) {
  if (typeof ack === 'function') ack({ ok: false, error: message });
}
function replyOk(ack, extra = {}) {
  if (typeof ack === 'function') ack({ ok: true, ...extra });
}

io.on('connection', socket => {
  socket.on('room:create', ({ name } = {}, ack) => {
    if (socket.data.roomCode) return replyError(ack, 'You are already in a room.');
    const code = makeCode();
    const room = {
      code,
      hostId: socket.id,
      phase: 'waiting',
      players: [{ id: socket.id, name: cleanName(name) }],
      toss: null,
      choice: null,
      battingPlayerId: null,
      bowlingPlayerId: null,
      readyIds: new Set(),
      innings: null,
      match: null
    };
    rooms.set(code, room);
    socket.data.roomCode = code;
    socket.join(code);
    replyOk(ack, { code, playerId: socket.id });
    emitState(room);
  });

  socket.on('room:join', ({ code, name } = {}, ack) => {
    if (socket.data.roomCode) return replyError(ack, 'Leave your current room before joining another.');
    const normalized = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    const room = rooms.get(normalized);
    if (!room) return replyError(ack, 'Room not found. Check the six-character code.');
    if (room.players.length >= 2) return replyError(ack, 'This room already has two players.');
    if (room.phase !== 'waiting') return replyError(ack, 'This match has already started.');
    room.players.push({ id: socket.id, name: cleanName(name) });
    socket.data.roomCode = normalized;
    socket.join(normalized);
    replyOk(ack, { code: normalized, playerId: socket.id });
    emitState(room);
  });

  socket.on('toss:start', (_payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return replyError(ack, 'Join a room first.');
    if (socket.id !== room.hostId) return replyError(ack, 'Only the room creator can start the toss.');
    if (room.players.length !== 2) return replyError(ack, 'Wait for your friend to join first.');
    if (room.phase !== 'waiting') return replyError(ack, 'The toss has already been completed.');
    const call = randomInt(2) === 0 ? 'HEADS' : 'TAILS';
    const winner = room.players[randomInt(2)];
    room.toss = { call, winnerId: winner.id };
    room.phase = 'toss-result';
    emitState(room);
    replyOk(ack);
  });

  socket.on('toss:choose', ({ decision } = {}, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return replyError(ack, 'Room not found.');
    if (room.phase !== 'toss-result') return replyError(ack, 'The toss is not awaiting a decision.');
    if (socket.id !== room.toss?.winnerId) return replyError(ack, 'Only the toss winner can choose bat or field.');
    if (!['bat', 'field'].includes(decision)) return replyError(ack, 'Choose bat or field.');
    const other = room.players.find(p => p.id !== socket.id);
    room.choice = decision;
    room.battingPlayerId = decision === 'bat' ? socket.id : other.id;
    room.bowlingPlayerId = decision === 'field' ? socket.id : other.id;
    room.phase = 'choice-made';
    emitState(room);
    replyOk(ack);
  });

  socket.on('match:ready', (_payload, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return replyError(ack, 'Room not found.');
    if (room.phase !== 'choice-made') return replyError(ack, 'The toss decision is not complete.');
    room.readyIds.add(socket.id);
    if (room.readyIds.size === 2) {
      room.phase = 'playing';
      room.innings = {
        number: 1, overs: 1,
        battingPlayerId: room.battingPlayerId,
        bowlingPlayerId: room.bowlingPlayerId,
        target: null, status: 'in-progress', runs: 0, wickets: 0, balls: 0
      };
      room.match = { inningsNumber: 1, runs: 0, wickets: 0, balls: 0, target: null, status: 'in-progress', delivery: null, firstInningsScore: null, firstInningsWickets: null, firstInningsBalls: null, winnerId: null, lastResult: 'First innings started' };
    }
    emitState(room);
    replyOk(ack);
  });

  function emitMatch(room) {
    io.to(room.code).emit('match:state', {
      phase: room.phase,
      innings: room.innings,
      match: room.match ? { inningsNumber: room.match.inningsNumber, runs: room.match.runs, wickets: room.match.wickets, balls: room.match.balls, target: room.match.target, status: room.match.status, lastResult: room.match.lastResult, firstInningsScore: room.match.firstInningsScore, firstInningsWickets: room.match.firstInningsWickets, firstInningsBalls: room.match.firstInningsBalls, winnerId: room.match.winnerId, delivery: room.match.delivery ? { active: true, startedAt: room.match.delivery.startedAt, duration: room.match.delivery.duration } : null } : null,
      battingPlayerId: room.innings?.battingPlayerId,
      bowlingPlayerId: room.innings?.bowlingPlayerId,
      players: room.players.map(p => ({ id: p.id, name: p.name }))
    });
  }

  function endInnings(room) {
    const m = room.match;
    if (m.inningsNumber === 1) {
      m.firstInningsScore = m.runs;
      m.firstInningsWickets = m.wickets;
      m.firstInningsBalls = m.balls;
      m.target = m.runs + 1;
      m.inningsNumber = 2;
      const oldBat = room.innings.battingPlayerId;
      room.innings = {
        number: 2, overs: 1,
        battingPlayerId: room.bowlingPlayerId,
        bowlingPlayerId: oldBat,
        target: m.target, status: 'in-progress', runs: 0, wickets: 0, balls: 0
      };
      m.runs = 0; m.wickets = 0; m.balls = 0;
      m.lastResult = `Innings break — target ${m.target}`;
      room.phase = 'playing';
    } else {
      m.status = 'complete';
      room.phase = 'complete';
      if (m.runs >= m.target) {
        m.winnerId = room.innings.battingPlayerId;
        m.lastResult = `${room.players.find(p => p.id === m.winnerId)?.name} wins`;
      } else if (m.runs === m.target - 1) {
        m.winnerId = null;
        m.lastResult = 'Match tied';
      } else {
        m.winnerId = room.innings.bowlingPlayerId;
        m.lastResult = `${room.players.find(p => p.id === m.winnerId)?.name} wins`;
      }
    }
    emitState(room);
    emitMatch(room);
  }

  function resolveDelivery(room, outcome) {
    const m = room.match;
    if (!m || m.status !== 'in-progress' || !m.delivery) return;
    m.delivery = null;
    m.balls += 1;
    if (outcome.wicket) m.wickets += 1;
    else m.runs += outcome.runs;
    m.lastResult = outcome.label;
    room.innings.balls = m.balls;
    room.innings.runs = m.runs;
    room.innings.wickets = m.wickets;
    if (m.inningsNumber === 2 && m.runs >= m.target) {
      m.status = 'complete'; room.phase = 'complete';
      m.winnerId = room.innings.battingPlayerId;
      m.lastResult = `${room.players.find(p => p.id === m.winnerId)?.name} wins`;
    } else if (m.balls >= 6 || m.wickets >= 1) {
      if (m.inningsNumber === 1) return endInnings(room);
      m.status = 'complete'; room.phase = 'complete';
      if (m.runs === m.target - 1) { m.winnerId = null; m.lastResult = 'Match tied'; }
      else {
        m.winnerId = m.runs >= m.target ? room.innings.battingPlayerId : room.innings.bowlingPlayerId;
        m.lastResult = `${room.players.find(p => p.id === m.winnerId)?.name || 'A player'} wins`;
      }
    }
    emitState(room);
    emitMatch(room);
  }

  socket.on('delivery:bowl', ({ pace } = {}, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || !room.match || room.match.status !== 'in-progress') return replyError(ack, 'No active match.');
    if (socket.id !== room.innings.bowlingPlayerId) return replyError(ack, 'Only the current bowler can deliver.');
    if (room.match.delivery) return replyError(ack, 'A delivery is already in progress.');
    if (!PACE[pace]) return replyError(ack, 'Choose a valid bowling pace.');
    const duration = PACE[pace].duration;
    room.match.delivery = { startedAt: Date.now(), duration, pace, shotAccepted: false };
    const deliveryToken = room.match.delivery;
    room.match.lastResult = 'Bowler delivered — time your shot';
    io.to(room.code).emit('delivery:started', { startedAt: room.match.delivery.startedAt, duration, pace });
    emitMatch(room);
    replyOk(ack);
    setTimeout(() => {
      const current = rooms.get(room.code);
      // Ignore stale timers and never turn an already-submitted shot into a
      // wicket. The delivery object identity is the authoritative timer token.
      if (current !== room || room.match?.delivery !== deliveryToken || deliveryToken.shotAccepted) return;
      // No shot was submitted by the end of the visual delivery window.
      const missed = { wicket: true, runs: 0, label: 'BOWLED — missed delivery' };
      io.to(room.code).emit('delivery:result', missed);
      resolveDelivery(room, missed);
    }, Math.round(duration * 0.78 + 120));
  });

  socket.on('batter:shot', ({ clientElapsed } = {}, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.phase !== 'playing' || !room.match?.delivery) return replyError(ack, 'There is no delivery to play.');
    if (socket.id !== room.innings.battingPlayerId) return replyError(ack, 'Only the batter can play a shot.');
    const delivery = room.match.delivery;
    if (delivery.shotAccepted) return replyError(ack, 'Your shot has already been submitted.');
    delivery.shotAccepted = true;
    const elapsed = Date.now() - delivery.startedAt;
    const timingError = Math.abs(elapsed - delivery.duration * 0.78) / 1000;
    let outcome;
    // More forgiving contact windows: normal human input/network latency
    // should not turn a visually well-timed swing into an automatic wicket.
    if (timingError <= 0.35) {
      const r = randomInt(100);
      const runs = r < 10 ? 1 : r < 36 ? 2 : r < 84 ? 4 : 6;
      outcome = { wicket: false, runs, direction: randomInt(2) ? 1 : -1, label: runs === 6 ? 'SIX — lofted shot' : runs === 4 ? 'FOUR — ground drive' : `${runs} RUN${runs === 1 ? '' : 'S'}` };
    } else if (timingError <= 0.65) {
      outcome = { wicket: false, runs: 1, direction: randomInt(2) ? 1 : -1, label: 'LATE / EARLY CONTACT — 1 RUN' };
    } else if (timingError <= 0.90) {
      outcome = { wicket: false, runs: 0, direction: 0, label: 'DOT BALL — MISSED TIMING' };
    } else {
      outcome = { wicket: true, runs: 0, label: 'MISTIMED — BOWLED' };
    }
    replyOk(ack, { accepted: true });
    io.to(room.code).emit('batter:swung');
    io.to(room.code).emit('delivery:result', outcome);
    setTimeout(() => {
      if (room.match?.delivery === delivery) resolveDelivery(room, outcome);
    }, 450);
  });

  socket.on('room:leave', (_payload, ack) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (room) {
      socket.leave(code);
      room.players = room.players.filter(p => p.id !== socket.id);
      room.readyIds.delete(socket.id);
      if (room.players.length === 0) rooms.delete(code);
      else {
        // A remaining player becomes host; reset pre-match state safely.
        room.hostId = room.players[0].id;
        room.phase = 'waiting';
        room.toss = null;
        room.choice = null;
        room.battingPlayerId = null;
        room.bowlingPlayerId = null;
        room.readyIds.clear();
        room.innings = null;
        room.match = null;
        emitState(room);
      }
    }
    socket.data.roomCode = null;
    replyOk(ack);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    room.players = room.players.filter(p => p.id !== socket.id);
    room.readyIds.delete(socket.id);
    if (room.players.length === 0) rooms.delete(code);
    else {
      room.hostId = room.players[0].id;
      room.phase = 'waiting';
      room.toss = null;
      room.choice = null;
      room.battingPlayerId = null;
      room.bowlingPlayerId = null;
      room.readyIds.clear();
      room.innings = null;
      room.match = null;
      emitState(room);
    }
  });
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'one-over-cricket-room-server' }));
// Production client hosting: Vite's built frontend and Socket.IO share this
// single HTTPS origin, so multiplayer works without a separate client service.
app.use(express.static(clientDist));
app.get(/^(?!\/socket\.io).*/, (_req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), error => {
    if (error) next(error);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`One Over Cricket multiplayer server listening on http://0.0.0.0:${PORT}`);
});
