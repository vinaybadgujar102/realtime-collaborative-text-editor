import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { validator } from "../validators";
import {
  loginSchema,
  signupSchema,
  type loginSchemaType,
  type signupSchemaType,
} from "../validators/auth.validator";
import { prisma } from "@repo/database";
import { errorResponse, successResponse } from "../utils/response.util";
import { StatusCodes } from "http-status-codes";
import { config } from "../config";

const authRouter = Router();

authRouter.post(
  "/signup",
  validator(signupSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as signupSchemaType;

      const userExists = await prisma.user.findFirst({
        where: {
          email,
        },
      });

      if (userExists) {
        return errorResponse(res, StatusCodes.CONFLICT, "User already exists");
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      return successResponse(
        res,
        StatusCodes.CREATED,
        "User successfully created",
      );
    } catch (error) {
      throw error;
    }
  },
);

authRouter.post(
  "/login",
  validator(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as loginSchemaType;

      const user = await prisma.user.findFirst({
        where: {
          email,
        },
      });

      if (!user) {
        return errorResponse(res, StatusCodes.NOT_FOUND, "User not found");
      }

      const isPasswordCorrect = await bcrypt.compare(password, user.password);

      if (!isPasswordCorrect) {
        return errorResponse(
          res,
          StatusCodes.UNAUTHORIZED,
          "Incorrect password",
        );
      }

      const token = jwt.sign({ id: user.id }, config.JWT_SECRET!);

      return successResponse(res, StatusCodes.OK, "Logged in", {
        token,
      });
    } catch (error) {
      throw error;
    }
  },
);

export default authRouter;
