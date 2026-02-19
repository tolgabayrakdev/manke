import express from "express";
import morgan from "morgan";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.use(cors({ credentials: true }))

app.listen(1234, () => {
    console.log("Server is running...");
})

