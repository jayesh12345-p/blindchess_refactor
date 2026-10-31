import http from 'node:http';
import { Server } from 'socket.io';

const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('Not found');
});
const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: allowedOrigins.length ? allowedOrigins : '*', methods: ['GET', 'POST'] }
});

// This state is shared only by connections handled by this process. For a
// multi-instance production deployment, move room state and pub/sub to Redis.
const seats = { white: null, black: null };
let gameData = null;

function announceGameState() {
  const started = Boolean(seats.white && seats.black);
  io.emit('game-state', {
    started,
    message: started ? 'Both players connected. White moves first.' : 'Waiting for the second player…'
  });
}

io.on('connection', (socket) => {
  socket.emit('connected', 'Connected to the chess server.');

  let color;
  if (!seats.white && !seats.black) {
    color = Math.random() < 0.5 ? 'white' : 'black';
  } else if (!seats.white) {
    color = 'white';
  } else if (!seats.black) {
    color = 'black';
  }

  if (color) {
    seats[color] = socket.id;
    socket.data.color = color;
    socket.emit('player', { id: `${color}player`, playing: true, color });
    if (gameData) socket.emit('Board', gameData);
  } else {
    socket.data.color = null;
    socket.emit('player', { id: `visitor-${socket.id}`, playing: false, color: '' });
  }

  announceGameState();

  socket.on('move', (data) => {
    const currentColor = socket.data.color;
    if (!currentColor || !seats.white || !seats.black || !data || !data.fen || !data.move) return;

    // Enforce turns on the server as well as in the browser.
    const sideToMove = data.fen.split(' ')[1];
    if ((currentColor === 'white' && sideToMove !== 'b') ||
        (currentColor === 'black' && sideToMove !== 'w')) return;

    gameData = data;
    socket.broadcast.emit('Board', data);
  });

  socket.on('disconnect', () => {
    const color = socket.data.color;
    if (color && seats[color] === socket.id) {
      seats[color] = null;
      gameData = null;
      io.emit('game-reset', 'A player disconnected. Waiting for two players to join again.');
    }
    announceGameState();
  });
});

export default server;
