import express from "express";
import chatRoutes from "./routes/chat.routes.mjs";
import productsRoutes from "./routes/products.routes.mjs";
import deliveryRoutes from "./routes/delivery.routes.mjs";
import orderTrackingRoutes from "./routes/orderTracking.routes.mjs";
import morgan from "morgan";

const app = express();

app.use(morgan("dev"));
app.use(express.json());

app.use("/api/chat", chatRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/orders", orderTrackingRoutes);

app.listen(5000, () => {
  console.log("Server running on port 5000");
});

