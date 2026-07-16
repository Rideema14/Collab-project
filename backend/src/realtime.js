const { Server } = require('socket.io');

/**
 * Minimal realtime relay for the client's `RealtimeBus` (see frontend
 * lib/realtime/bus.ts). It is a pure fan-out: whatever a client emits on the `rt`
 * channel is rebroadcast to every OTHER connected client. No persistence, no auth
 * coupling, no knowledge of the event shapes — the app owns all of that. Rooms are
 * supported (join/leave) for future per-list scoping, but the app currently
 * broadcasts globally, which is correct for chat, presence, and announcements.
 */
function attachRealtime(server) {
  const io = new Server(server, {
    // The relay carries no cookies/auth (the app's auth is a Bearer token), so a
    // permissive origin with no credentials is the simplest thing that connects.
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    socket.on('rt', (event) => {
      // Relay to everyone except the sender (the sender already applied it locally).
      socket.broadcast.emit('rt', event);
      // Also deliver to a room if the event names one (optional, future-proofing).
      if (event && typeof event.room === 'string') socket.to(event.room).emit('rt', event);
    });
    socket.on('join', (room) => typeof room === 'string' && socket.join(room));
    socket.on('leave', (room) => typeof room === 'string' && socket.leave(room));
  });

  return io;
}

module.exports = { attachRealtime };
