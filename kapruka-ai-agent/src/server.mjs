import express from "express";
import chatRoutes from "./routes/chat.routes.mjs";
import morgan from "morgan";

const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.use("/api/chat", chatRoutes);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});