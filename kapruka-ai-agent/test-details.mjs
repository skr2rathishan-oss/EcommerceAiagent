import { getProductDetails } from "./src/services/integration/mcp.service.mjs";
import dotenv from "dotenv";

dotenv.config();

async function run() {
  try {
    console.log("Fetching details...");
    const details = await getProductDetails("EF_PC_ELEC0V701POD00603");
    console.log("Success:", JSON.stringify(details, null, 2));
  } catch (err) {
    console.error("Error fetching details:", err);
  } finally {
    process.exit(0);
  }
}

run();
