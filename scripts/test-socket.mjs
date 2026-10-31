import assert from 'node:assert/strict';
import server from '../api/socket.js';

const timeoutMs = 5000;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeClient(url) {
  const ws = new WebSocket(url);
  const events = [];
  let socketError = null;

  ws.addEventListener('message', ({ data }) => {
    const packet = String(data);

    // Engine.IO handshake, followed by a Socket.IO namespace connection.
    if (packet.startsWith('0')) {
      ws.send('40');
    } else if (packet === '2') {
      ws.send('3');
    } else if (packet.startsWith('42')) {
      try {
        events.push(JSON.parse(packet.slice(2)));
      } catch (error) {
        socketError = error;
      }
    }
  });

  ws.addEventListener('error', () => {
    socketError = new Error('WebSocket connection error');
  });
  ws.addEventListener('close', () => {
    if (ws.readyState !== WebSocket.CLOSING) {
      socketError ??= new Error('WebSocket closed before the expected event');
    }
  });

  return {
    ws,
    async waitFor(eventName) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const index = events.findIndex(([name]) => name === eventName);
        if (index !== -1) return events.splice(index, 1)[0][1];
        if (socketError) throw socketError;
        await delay(20);
      }
      throw new Error(`Timed out waiting for Socket.IO event "${eventName}"`);
    }
  };
}

async function closeClient(client) {
  if (!client || client.ws.readyState === WebSocket.CLOSED) return;
  await new Promise((resolve) => {
    client.ws.addEventListener('close', resolve, { once: true });
    client.ws.close();
    setTimeout(resolve, 500);
  });
}

let first;
let second;
let listening = false;

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  listening = true;

  const { port } = server.address();
  const url = `ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`;
  first = makeClient(url);

  const firstPlayer = await first.waitFor('player');
  assert.equal(firstPlayer.playing, true, 'first connection should receive a player seat');
  const waitingState = await first.waitFor('game-state');
  assert.equal(waitingState.started, false, 'game should wait for the second player');

  second = makeClient(url);
  const secondPlayer = await second.waitFor('player');
  assert.equal(secondPlayer.playing, true, 'second connection should receive a player seat');
  assert.notEqual(secondPlayer.color, firstPlayer.color, 'players should receive opposite colors');

  const [startedForFirst, startedForSecond] = await Promise.all([
    first.waitFor('game-state'),
    second.waitFor('game-state')
  ]);
  assert.equal(startedForFirst.started, true, 'first player should see the game start');
  assert.equal(startedForSecond.started, true, 'second player should see the game start');

  const moveData = {
    fen: `test-position ${firstPlayer.color === 'white' ? 'b' : 'w'} - - 0 1`,
    move: { from: 'e2', to: 'e4', test: true }
  };
  first.ws.send(`42${JSON.stringify(['move', moveData])}`);
  const relayedMove = await second.waitFor('Board');
  assert.deepEqual(relayedMove, moveData, 'opponent should receive the move');

  console.log('PASS: two players connected, the game started, and a move was relayed.');
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all([closeClient(first), closeClient(second)]);
  if (listening) {
    await new Promise((resolve) => server.close(resolve));
  }
}
