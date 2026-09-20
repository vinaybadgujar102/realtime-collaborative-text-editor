import { Router, type Request, type Response } from "express";
import * as yjs from "yjs";
import { validator } from "../validators";
import {
  createDocumentSchema,
  type createDocumentSchemaType,
} from "../validators/document.validator";
import { prisma } from "@repo/database";
import { successResponse } from "../utils/response.util";
import { StatusCodes } from "http-status-codes";
import { redis } from "bun";

const documentRouter = Router();

documentRouter.get("/", async (req: Request, res: Response) => {
  try {
    // add paginatinon later
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        userId: true,
        updatedAt: true,
        createdAt: true,
        name: true,
      },
    });

    return successResponse(res, StatusCodes.OK, "Docs created successfully!", {
      documents,
    });
  } catch (error) {
    throw new Error("Internal Server Error");
  }
});

documentRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };
    const documents = await prisma.document.findUnique({
      where: {
        id,
      },
    });

    if (!documents) {
      return res.sendStatus(201);
    }

    if (documents.state) {
      console.log("added state");
      // Cache with 1h TTL — WS refresh/extend this while the doc is active.
      await redis.set(
        `doc:${documents.id}:state`,
        documents.state,
        "EX",
        60 * 60,
      );
    }

    // Prisma Bytes is Uint8Array; JSON.stringify(Uint8Array) becomes {"0":n,...}.
    // Buffer serializes as { type: "Buffer", data: number[] } for the client.
    return successResponse(res, StatusCodes.OK, "Docs created successfully!", {
      documents: {
        ...documents,
        state: documents.state ? Buffer.from(documents.state) : null,
      },
    });
  } catch (error) {
    throw new Error("Internal Server Error");
  }
});

documentRouter.post(
  "/",
  validator(createDocumentSchema),
  async (req: Request, res: Response) => {
    try {
      const { name } = req.body as createDocumentSchemaType;
      const userId = req.user?.id!;

      const newDocument = await prisma.document.create({
        data: {
          name,
          userId,
        },
        select: {
          id: true,
        },
      });

      return successResponse(
        res,
        StatusCodes.CREATED,
        "Docs created successfully!",
        {
          documentId: newDocument.id,
        },
      );
    } catch (error) {
      throw new Error("Internal Server Error");
    }
  },
);

documentRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params as { id: string };

    await prisma.document.delete({
      where: {
        id,
        userId: req.user?.id,
      },
    });

    return successResponse(
      res,
      StatusCodes.OK,
      "Document deleted successfully",
    );
  } catch (error) {
    throw new Error("Internal Server Error");
  }
});
export default documentRouter;
