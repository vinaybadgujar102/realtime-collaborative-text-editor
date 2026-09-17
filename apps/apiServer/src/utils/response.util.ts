import type { Response } from "express";

export function successResponse<T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T,
) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}
export function errorResponse(
  res: Response,
  statusCode: number,
  errorMessage: string,
) {
  return res.status(statusCode).json({
    success: false,
    error: errorMessage,
  });
}
