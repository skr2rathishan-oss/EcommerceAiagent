import dotenv from "dotenv";
dotenv.config();

import express from "express";
import chatRoutes from "./routes/chat.routes.mjs";
import productsRoutes from "./routes/products.routes.mjs";
import deliveryRoutes from "./routes/delivery.routes.mjs";
import orderTrackingRoutes from "./routes/orderTracking.routes.mjs";
import morgan from "morgan";
import cors from "cors";
import { connectDB } from "./database/mongo.mjs";
await connectDB();

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

app.use("/api/chat", chatRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/orders", orderTrackingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});


