# Online Blind Chess

A browser based blind chess game built with Chessboard.js, chess.js, Node.js, and Socket.IO. Players see their own pieces and the opponent's king; other opponent pieces are hidden.

## Requirements

- Node.js 22 or later
- npm
- Python 3 (for the built-in static file server)

Install the project dependencies from the project root:

```powershell
npm.cmd install
```

## Run locally

The page and Socket.IO server run in separate terminal windows. Start both from the project root. You do not need the Vercel CLI for this local setup.

**Terminal 1 — start Socket.IO on port 3001:**

```powershell
npm.cmd run dev:socket
```

Wait for `Socket.IO server listening at http://localhost:3001` and leave this terminal running.

**Terminal 2 — serve the page on port 3000:**

```powershell
py -m http.server 3000 --directory public
```

If `py` is not recognized, try:

```powershell
python -m http.server 3000 --directory public
```

This Python command serves the static files in `public`; the Node.js process in Terminal 1 handles Socket.IO connections and game events. Leave both terminals running. Open <http://localhost:3000> in two browser tabs. The first player should see a waiting message. When the second player joins, the game starts; White moves first. Try alternating moves between the two tabs.

Stop either server with **Ctrl+C** in its terminal.

## Deploy the frontend and Socket.IO server

The frontend can stay on Vercel while the long-running Socket.IO server runs as a Render Web Service.

### 1. Deploy the Socket.IO service

Create a Render **Web Service** from this repository and configure:

- **Build command:** `npm ci`
- **Start command:** `npm start`
- **Health check path:** `/healthz`
- **Environment variable:** `CLIENT_ORIGIN` set to your Vercel site's origin, such as `https://your-chess-app.vercel.app`

The service reads Render's `PORT` variable automatically. Its public origin will look like `https://your-chess-server.onrender.com`.

### 2. Point the Vercel frontend at the Socket.IO service

In `public/client/asset/socket-config.js`, set `window.CHESS_SOCKET_URL` to the Render service origin:

```js
window.CHESS_SOCKET_URL = 'https://your-chess-server.onrender.com';
```

Commit and deploy this change to Vercel. The browser will connect to the Render service using secure WebSockets. Local development continues to use `http://localhost:3001`.

For the initial demo, keep the Render service at **one instance**. Player seats and game data are currently held in that process's memory, so a service restart clears the match. Running multiple instances requires shared match state and cross-instance message delivery.

## Run the Socket.IO functional test

From the project root, run:

```powershell
npm.cmd run test:socket
```

The test starts the Socket.IO server on an available port and checks that:

1. Two clients connect and receive opposite player colors.
2. The game changes from waiting to started after the second player joins.
3. A move from one player is relayed to the other player.

On success, it prints:

```text
PASS: two players connected, the game started, and a move was relayed.
```

This test covers the Socket.IO server flow. It does not test the browser UI, chess move legality, checkmate detection, or Vercel deployment routing.

## Troubleshooting

- If `npm` is blocked by PowerShell's script policy, use `npm.cmd` as shown above.
- If Python is not installed or `py`/`python` is not recognized, install Python 3 or use `npx.cmd vercel dev --listen 3000` to serve the page instead.
- If port 3000 or 3001 is already in use, stop the process using it. The local browser client expects Socket.IO on port 3001.
- If the page says it cannot connect, check that the Socket.IO terminal is still running and that the browser is open at `http://localhost:3000`.

## TODO

- Add match rooms so players can choose which game to join.
- Add shared state and cross-instance message delivery before scaling the Socket.IO service beyond one instance.
- Validate legal moves and game results on the server, with tests for checkmate and disconnect behavior.

# Todo
allow user to create rooms, fixing share state problem for better reliability.
