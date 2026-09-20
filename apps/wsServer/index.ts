import { WebSocketServer, WebSocket } from "ws";
import * as Y from "yjs";
import { createServer } from "http";
import jwt from "jsonwebtoken";
import { redis } from "bun";
import { prisma } from "@repo/database";

const PERSIST_INTERVAL_MS = 5_000;
// TODO: bump to 30_000 for production
const DB_FLUSH_INTERVAL_MS = 5_000;
/** Redis cache TTL for document state (1 hour). */
const REDIS_TTL_SECONDS = 60 * 60;
/** Delay before dropping Redis after the last client leaves a doc. */
const REDIS_CLEANUP_DELAY_MS = 5_000;

const activeDocs = new Map<string, Y.Doc>();
const dirtyDocs = new Set<string>();
const pendingDbFlush = new Set<string>();
const rooms = new Map<string, Set<WebSocket>>();
const redisCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

function redisStateKey(docId: string) {
  return `doc:${docId}:state`;
}

async function setRedisState(docId: string, state: Buffer | Uint8Array) {
  await redis.set(redisStateKey(docId), state, "EX", REDIS_TTL_SECONDS);
}

function markDirty(docId: string) {
  dirtyDocs.add(docId);
}

function cancelRedisCleanup(docId: string) {
  const timer = redisCleanupTimers.get(docId);
  if (timer) {
    clearTimeout(timer);
    redisCleanupTimers.delete(docId);
  }
}

async function flushDocRedisToPostgres(docId: string) {
  const redisDoc = await redis.getBuffer(redisStateKey(docId));
  if (redisDoc == null || redisDoc.byteLength === 0) return;

  await prisma.document.update({
    where: { id: docId },
    data: { state: Buffer.from(redisDoc) },
  });
  pendingDbFlush.delete(docId);
  console.log(`flushed doc:${docId}:state to postgres`);
}

async function cleanupRedisAfterLeave(docId: string) {
  // Someone re-joined meanwhile — keep the cache.
  const room = rooms.get(docId);
  if (room && room.size > 0) return;

  try {
    // Persist any in-memory edits to Redis first, then Redis → Postgres.
    const doc = activeDocs.get(docId);
    if (doc && dirtyDocs.has(docId)) {
      const state = Buffer.from(Y.encodeStateAsUpdate(doc));
      await setRedisState(docId, state);
      dirtyDocs.delete(docId);
    }

    await flushDocRedisToPostgres(docId);
    await redis.del(redisStateKey(docId));

    activeDocs.delete(docId);
    dirtyDocs.delete(docId);
    pendingDbFlush.delete(docId);
    console.log(`removed redis key ${redisStateKey(docId)} after room empty`);
  } catch (error) {
    console.error(`failed to cleanup redis for doc ${docId}`, error);
  }
}

function scheduleRedisCleanup(docId: string) {
  cancelRedisCleanup(docId);

  const timer = setTimeout(() => {
    redisCleanupTimers.delete(docId);
    void cleanupRedisAfterLeave(docId);
  }, REDIS_CLEANUP_DELAY_MS);

  redisCleanupTimers.set(docId, timer);
}

async function persistDirtyDocs() {
  if (dirtyDocs.size === 0) return;

  const docIds = [...dirtyDocs];
  dirtyDocs.clear();

  await Promise.all(
    docIds.map(async (docId) => {
      const doc = activeDocs.get(docId);
      if (!doc) return;

      const state = Buffer.from(Y.encodeStateAsUpdate(doc));
      await setRedisState(docId, state);
      pendingDbFlush.add(docId);
      console.log(`persisted ${redisStateKey(docId)}`);
    }),
  );
}

async function flushRedisToPostgres() {
  if (pendingDbFlush.size === 0) return;

  const docIds = [...pendingDbFlush];
  pendingDbFlush.clear();

  await Promise.all(
    docIds.map(async (docId) => {
      try {
        await flushDocRedisToPostgres(docId);
      } catch (error) {
        console.error(`failed to flush doc ${docId} to postgres`, error);
        pendingDbFlush.add(docId);
      }
    }),
  );
}

setInterval(() => {
  void persistDirtyDocs().catch((error) => {
    console.error("failed to persist docs to redis", error);
  });
}, PERSIST_INTERVAL_MS);

setInterval(() => {
  void flushRedisToPostgres().catch((error) => {
    console.error("failed to flush redis → postgres", error);
  });
}, DB_FLUSH_INTERVAL_MS);

function leaveRoom(docId: string | undefined, ws: WebSocket) {
  if (!docId) return;

  const room = rooms.get(docId);
  if (!room) return;

  room.delete(ws);

  if (room.size === 0) {
    rooms.delete(docId);
    scheduleRedisCleanup(docId);
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

  const docId = ws.docId as string | undefined;
  console.log(docId);

  if (docId) {
    joinRoom(docId, ws);
  }

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
        doc = new Y.Doc();
        const redisDoc = await redis.getBuffer(redisStateKey(docId));
        // getBuffer returns null when the key is missing — never apply null to Yjs
        if (redisDoc != null && redisDoc.byteLength > 0) {
          Y.applyUpdate(doc, new Uint8Array(redisDoc));
        }
        activeDocs.set(docId, doc);
      }

      // Client sends data as number[] over JSON — convert to Uint8Array
      const updateBytes = Uint8Array.from(
        parsedData.payload.data as unknown as number[],
      );
      if (updateBytes.byteLength === 0) return;

      Y.applyUpdate(doc, updateBytes);
      markDirty(docId);
      broadcastToRoom(docId, ws, updateBytes);
    }
  });
});

function joinRoom(docId: string, socket: WebSocket) {
  cancelRedisCleanup(docId);

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
