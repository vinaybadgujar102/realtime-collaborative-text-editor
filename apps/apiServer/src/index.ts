import Express from "express";
import { config } from "./config";
import cors from "cors";
import v1Router from "./router";

const app = Express();

app.use(Express.json());
app.use(cors());

app.use("/api/v1", v1Router);

app.listen(config.PORT, () => {
  console.log(`Api Server running on port ${config.PORT}`);
});
