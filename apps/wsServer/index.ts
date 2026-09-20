import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { redis } from "bun";

const activeDocs = new Map<string, Y.Doc>();

const rooms = new Map<string, Set<WebSocket>>();

function leaveRoom(docId: string, ws: WebSocket) {
  const room = rooms.get(docId);

  if (!room) return;

  room.delete(ws);

  if (room.size === 0) {
    rooms.delete(docId);
  }
}

function broadcastToRoom(docId: string, sender: WebSocket, update: Uint8Array) {
  const room = rooms.get(docId);

  console.log(room);
  if (!room) return;

  for (const client of room) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(update);
    }
  }
}
type updateMessage = {
  id: string;
  type: string;
  payload: {
    userId: string;
    docId: string;
    data: Uint8Array;
  };
};

function verifyToken(token) {
  return jwt.verify(token, "SECRET");
}
const server = createServer();
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws: WebSocket) => {
  console.log("client connected");

  const docId = ws.docId;
  console.log(docId);

  joinRoom(docId, ws);

  ws.on("close", () => {
    leaveRoom(docId, ws);
  });

  ws.on("message", async (data) => {
    const parsedData = JSON.parse(data) as {
      id: string;
      type: "update_doc";
      payload: {
        data: Uint8Array;
        docId: string;
        userId: string;
      };
    };

    if (parsedData.type === "update_doc") {
      console.log("updating doc");
      const docId = parsedData.payload.docId;
      // check if the doc is active in here
      let doc = activeDocs.get(docId);
      if (!doc) {
        // if not get from redis and make it active here
        // const redisDoc = await redis.getBuffer(`doc::${docId}::state`);
        // if (!redisDoc) {
        //   return;
        // }
        //
        doc = new Y.Doc();
        // Y.applyUpdate(doc, redisDoc);
        activeDocs.set(docId, doc);
      }

      Y.applyUpdate(doc, new Uint8Array(Buffer.from(parsedData.payload.data)));
      broadcastToRoom(
        docId,
        ws,
        new Uint8Array(Buffer.from(parsedData.payload.data)),
      );
    }
  });
});

function joinRoom(docId: string, socket: WebSocket) {
  let room = rooms.get(docId);

  if (!room) {
    room = new Set<WebSocket>();
    rooms.set(docId, room);
  }

  room.add(socket);
}

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  const docId = url.searchParams.get("docId");
  console.log(token);

  // verify token
  const decoded = verifyToken(token);
  console.log(decoded);
  if (!token) {
    socket.write(
      "HTTP/1.1 401 Unauthorized\r\n" + "Connection: close\r\n" + "\r\n",
    );
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.user = decoded;
    ws.docId = docId;

    wss.emit("connection", ws, req);
  });
});

server.listen(8080);
