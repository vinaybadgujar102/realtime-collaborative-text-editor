import { WebSocketServer } from "ws";
import { createServer } from "http";
import jwt from "jsonwebtoken";

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

wss.on("connection", (ws) => {
  console.log("client connected");

  ws.on("message", (data) => {
    const parsedData = JSON.parse(data);

    if (parsedData.type === "update_doc") {
      console.log("updating doc");
    }
  });
});

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
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
    wss.emit("connection", ws, req);
  });
});

server.listen(8080);
