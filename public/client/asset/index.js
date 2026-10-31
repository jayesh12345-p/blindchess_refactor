// --- Begin Example JS --------------------------------------------------------
var board = null
var game = new Chess()
var $status = $('#status')
var $connection = $('#connection')
var $fen = $('#fen')
var $pgn = $('#pgn')
var $btn = $('#btn')
var player = { playing: false, color: '' }
var gameStarted = false
var socket = null
var move

$btn.hide()

function reload() {
  game = new Chess()
  $status = $('#status')
  $fen = $('#fen')
  $pgn = $('#pgn')
  config.position = 'start'
  board = Chessboard('myBoard', config)
  updateStatus()
}

function onDragStart(source, piece) {
  if (game.game_over() || !player.playing || !gameStarted || !socket || !socket.connected) return false

  if ((player.color === 'black' && game.turn() === 'w' && piece.search(/^b/) !== -1) ||
      (player.color === 'white' && game.turn() === 'b' && piece.search(/^w/) !== -1)) {
    return false
  }

  if ((player.color === 'black' && game.turn() === 'w') ||
      (player.color === 'white' && game.turn() === 'b')) {
    return false
  }
}

function onDrop(source, target) {
  move = game.move({ from: source, to: target, promotion: 'q' })
  if (move === null) return 'snapback'
  updateStatus()
}

function onSnapEnd() {
  if (socket && socket.connected) {
    socket.emit('move', { fen: game.fen(), move: move })
  }
}

function updateStatus() {
  var status = ''
  var moveColor = game.turn() === 'b' ? 'Black' : 'White'

  if (game.in_checkmate()) {
    status = 'Game over, ' + moveColor + ' is in checkmate.'
  } else if (game.in_stalemate()) {
    status = 'Game over, drawn by stalemate'
  } else if (game.in_repeat()) {
    status = 'Game over, drawn by three fold repetition'
  } else if (game.in_draw()) {
    status = 'Game over, drawn position'
  } else {
    status = moveColor + ' to move'
    if (game.in_check()) status += ', ' + moveColor + ' is in check'
  }

  status = (player.playing ? '(' + player.color + ' player) ' : '(Visitor mode) ') + status
  $status.html(status)

  if (game.game_over()) {
    $fen.html(game.fen())
    $pgn.html(game.pgn())
    board.position(game.fen())
  }
}

var config = {
  draggable: true,
  position: 'start',
  pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd
}

// Draw the board before opening a realtime connection. If the socket script or
// function is unavailable, the board still renders and the console explains why.
board = Chessboard('myBoard', config)
updateStatus()

if (typeof io === 'function') {
  // Local development uses port 3001. Set CHESS_SOCKET_URL in socket-config.js
  // to use a separately hosted Socket.IO service in production.
  var localSocketServer = ['localhost', '127.0.0.1'].includes(window.location.hostname)
  var configuredSocketUrl = (window.CHESS_SOCKET_URL || '').trim().replace(/\/+$/, '')
  var dedicatedSocketServer = localSocketServer || Boolean(configuredSocketUrl)
  var socketUrl = configuredSocketUrl || (localSocketServer ? 'http://localhost:3001' : window.location.origin)
  socket = io(socketUrl, {
    path: dedicatedSocketServer ? '/socket.io' : '/api/socket/socket.io',
    transports: ['websocket']
  })

  socket.on('connect', () => {
    $connection.text('Connected. Waiting for player assignment…')
  })

  socket.on('connected', (data) => console.info(data))

  socket.on('game-state', (state) => {
    gameStarted = state.started
    $connection.text(state.message)
  })

  socket.on('game-reset', (message) => {
    gameStarted = false
    game = new Chess()
    board.position('start')
    updateStatus()
    $connection.text(message)
  })

  socket.on('player', (playerObj) => {
    player = playerObj
    if (player.color === 'black') board.orientation('black')
    updateStatus()
  })

  socket.on('Board', (data) => {
    var newFen = data.fen
    if (player.color === 'black') {
      newFen = data.fen.replace(/[RNBQP]/g, '1')
    } else if (player.color === 'white') {
      newFen = data.fen.replace(/[rnbqp]/g, '1')
    }

    board.position(newFen)
    game.move(data.move)
    if (player.playing) alert('It is now your turn')
    updateStatus()
  })

  socket.on('connect_error', (error) => {
    gameStarted = false
    $connection.text('Could not connect to the game server: ' + error.message)
    console.error('Socket.IO connection failed:', error.message)
  })

  socket.on('disconnect', () => {
    gameStarted = false
    $connection.text('Disconnected from the game server. Reconnecting…')
  })
} else {
  $connection.text('Socket.IO client failed to load. Check its script URL in index.html.')
  console.error('Socket.IO client failed to load. Check its script URL in index.html.')
}

// --- End Example JS ----------------------------------------------------------
