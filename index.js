const express = require("express");
const bodyParser = require("body-parser");

const app = express();

const http = require("http").createServer(app);

const rooms = {};
const socketToRoom = {};
const users = {};
const routes = {};

app.use(bodyParser.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "OPTIONS, GET, POST, PUT, PATCH, DELETE"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

app.get("/", (req, res) => {
  res.send("My New Node Server with socket.io -- ATN");
});

app.use((error, req, res, next) => {
  const status = error.statusCode || 500;
  const message = error.message;
  const data = error.data;
  res.status(status).json({ message: message, data: data });
});

const server = http.listen(process.env.PORT);
const io = require("./socket").init(server);
io.on("connection", (socket) => {
  console.log("connected ", socket.id);
  var userId = null;

  socket.emit("connection-success", {
    success: socket.id,
  });

  socket.on("join-room", (data) => {
    userId = data["userID"];
    var roomID = data["roomID"];
    if (rooms[roomID]) {
      if (users[userId]) {
        var socketID = users[userId]["socketID"];
        let room = rooms[roomID];
        if (room) {
          room = room.filter((id) => id !== socketID);
          rooms[roomID] = room;
          delete users[userId];
          delete socketToRoom[socketID];
        }
      }
      const length = rooms[roomID].length;
      if (length === 100) {
        socket.emit("Room Full");
        return;
      }
      rooms[roomID].push(socket.id);
    } else {
      if (users[userId]) {
        var socketID = users[userId]["socketID"];
        let room = rooms[roomID];
        if (room) {
          room = room.filter((id) => id !== socketID);
          rooms[roomID] = room;
          delete users[userId];
          delete socketToRoom[socketID];
        }
      }
      rooms[roomID] = [socket.id];
    }
    users[userId] = { socketID: socket.id, roomID: roomID };
    socketToRoom[socket.id] = { roomID: roomID, userID: userId };
    const otherUser = rooms[roomID].find((id) => id !== socket.id);
    if (otherUser) {
      socket.emit("online-peer", { otherUser: otherUser });
      socket.emit("joined-peers", { otherUser: socket.id });
    }
    console.log("rooms", rooms);
    console.log("socketToRoom", socketToRoom);
    console.log("users", users);
  });

  socket.on("disconnect", () => {
    if (socket.id) {
      if (socketToRoom[socket.id]) {
        const roomID = socketToRoom[socket.id]["roomID"];
        const userID = socketToRoom[socket.id]["userID"];
        let room = rooms[roomID];
        if (room) {
          room = room.filter((id) => id !== socket.id);
          rooms[roomID] = room;
        }
        const length = rooms[roomID].length;
        if (length === 0) {
          delete rooms[roomID];
        }
        delete socketToRoom[socket.id];
        delete users[userID];
      }
    }
  });

  socket.on("silent-disconnect", (data) => {
    const socketID = data["socketID"];
    const role = data["role"];
    if (socketToRoom[socketID]) {
      const roomID = socketToRoom[socketID]["roomID"];
      const userID = socketToRoom[socketID]["userID"];
      let room = rooms[roomID];
      if (room) {
        room = room.filter((id) => id !== socketID);
        rooms[roomID] = room;
      }
      const otherUser = rooms[roomID].find((id) => id !== socketID);
      if (otherUser) {
        socket.emit("disconnect-msg", {
          message: `${socketID} has been disconnected!`,
        });
      }
      const length = rooms[roomID].length;
      if (length === 0) {
        delete rooms[roomID];
      }
      delete socketToRoom[socketID];
      delete users[userID];
      if (role == "DRIVER") {
        delete routes[roomID];
      }
      console.log("routes", routes);
    }
  });

  socket.on("init-loc", (data) => {
    let roomID = data["roomID"];
    let role = data["role"];
    if (role == "DRIVER") {
      if (!routes[roomID]) {
        routes[roomID] = [
          {
            lat: data["lat"],
            lng: data["lng"],
          },
        ];
      }
    }
    console.log("init", routes);
  });

  socket.on("add-loc", (data) => {
    let roomID = data["roomID"];
    let role = data["role"];
    if (role == "DRIVER") {
      if (routes[roomID]) {
        routes[roomID].push({
          lat: data["lat"],
          lng: data["lng"],
        });
      }
    }
    console.log("adding", routes);
  });

  socket.on("location", (data) => {
    socket.emit("location", { lat: data["lat"], lng: data["lng"] });
  });

  socket.on("get-loc", (data) => {
    let roomID = data["roomID"];
    socket.emit("get-loc", { route: routes[roomID] });
  });

  socket.on("stop", (data) => {
    const roomID = data["roomID"];
    const role = data["role"];
    if (role == "DRIVER") {
      delete routes[roomID];
    }
  });
});
