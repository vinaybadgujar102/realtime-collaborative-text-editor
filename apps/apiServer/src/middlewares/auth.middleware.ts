import type { NextFunction, Request, Response } from "express";
import { errorResponse } from "../utils/response.util";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";
import { config } from "../config";

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("Authorization");
  const token = authHeader?.split(" ")[1];

  if (!authHeader || !token)
    return errorResponse(
      res,
      StatusCodes.FORBIDDEN,
      "Not authorized to perform this action!",
    );

  try {
    console.log(config.JWT_SECRET);
    const decoded = jwt.verify(token, config.JWT_SECRET!) as { id: string };

    req.user = decoded;
    next();
  } catch (error) {
    console.log("error here");
    return errorResponse(
      res,
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Something went wrong while decoding token",
    );
  }
}

export default authMiddleware;
