import server from '../api/socket.js';

const port = Number(process.env.PORT || process.env.SOCKET_PORT || 3001);

server.listen(port, '0.0.0.0', () => {
  console.log(`Socket.IO server listening on port ${port}`);
});
