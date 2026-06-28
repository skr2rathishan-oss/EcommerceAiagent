import { processRequest } from "../services/core/requestPipeline.service.mjs";

export const chatStream = async (req, res) => {
  return processRequest(req, res, true);
};
