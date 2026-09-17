import type { NextFunction, Request, Response } from "express";
import type { ZodObject } from "zod";
import { errorResponse } from "../utils/response.util";
import { StatusCodes } from "http-status-codes";

export function validator(schema: ZodObject) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      return errorResponse(res, StatusCodes.BAD_REQUEST, "Invalid Request");
    }
  };
}
