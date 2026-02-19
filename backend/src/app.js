import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";
import usersRouter from "./routes/users.js";
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.use(cors({ credentials: true }));

app.use("/api/users", usersRouter);

app.use(errorHandler);

app.listen(1234, () => {
  console.log("Server is running on http://localhost:1234");
});

