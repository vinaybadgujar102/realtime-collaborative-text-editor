import { Router } from "express";
import authRouter from "./auth.router";
import documentRouter from "./document.router";
import authMiddleware from "../middlewares/auth.middleware";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/document", authMiddleware, documentRouter);

export default v1Router;
