const { io } = require("socket.io-client");

const server = process.env.SOCKET_SERVER || "http://localhost:4000";
console.log("Connecting to", server);

const socket = io(server, { transports: ["websocket", "polling"] });

socket.on("connect", () => {
  console.log("connected", socket.id, "connected=", socket.connected);
  console.log('emitting display:requestSync');
  socket.emit('display:requestSync');
});

socket.on('state:sync', (state) => {
  console.log('received state:sync:');
  console.log(JSON.stringify({ currentSongId: state.currentSongId, currentSlide: state.currentSlide, songs: (state.songs||[]).length }, null, 2));
  socket.close();
  process.exit(0);
});

socket.on('connect_error', (err) => { console.error('connect_error', err.message); process.exit(2); });
socket.on('error', (e) => { console.error('error', e); });

setTimeout(() => { console.error('timeout waiting for state:sync'); process.exit(3); }, 5000);
