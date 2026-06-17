/**
 * sse.utils.mjs — SSE (Server-Sent Events) progress streaming helpers.
 * Used by the chat controller to stream workflow progress to the frontend.
 */

/**
 * Builds the initial `logs` array based on detected intent.
 * @param {string} intent
 * @param {string[]} intentDetails
 * @returns {Array}
 */
export function buildInitialLogs(intent, intentDetails = []) {
  if (intent === "search_products") {
    return [
      { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: intentDetails },
      { id: "SEARCHING",     title: "Searching catalog",       status: "active",    details: [] },
      { id: "FILTERING",     title: "Applying filters",        status: "pending",   details: [] },
      { id: "RANKING",       title: "Ranking products",        status: "pending",   details: [] },
      { id: "READY",         title: "Recommendations ready",   status: "pending",   details: [] }
    ];
  }
  return [
    { id: "UNDERSTANDING", title: "Understanding request", status: "completed", details: intentDetails },
    { id: "READY",         title: "Preparing response",   status: "active",    details: [] }
  ];
}

/**
 * Extracts a human-readable text payload from various result shapes.
 * @param {*} payload
 * @returns {string}
 */
export function extractText(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (payload.text) return payload.text;
  if (payload.message) return payload.message;
  if (payload.content) return payload.content;
  return "";
}

/**
 * Creates an `updateProgress` closure tied to the given `res` stream and `logs` array.
 * Mutates `logs` in place and writes SSE progress events.
 *
 * @param {import("express").Response} res
 * @param {Array} logs  - shared mutable logs array
 * @returns {Function} updateProgress(stepId, status, details?)
 */
export function createProgressUpdater(res, logs) {
  return function updateProgress(stepId, status, details = null) {
    for (const step of logs) {
      if (step.id === stepId) {
        step.status = status;
        if (details !== null) step.details = details;
      }
    }
    // Mark all earlier steps completed
    if (status === "active" || status === "completed") {
      const index = logs.findIndex(s => s.id === stepId);
      for (let i = 0; i < index; i++) {
        if (logs[i].status !== "completed") logs[i].status = "completed";
      }
    }

    const activeStep = logs.find(s => s.status === "active") || logs.find(s => s.id === stepId);
    const activeMsg = activeStep
      ? (activeStep.id === "READY" ? "Recommendations ready" : activeStep.title + "...")
      : "Recommendations ready";

    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: "progress",
        step: activeStep ? activeStep.id : stepId,
        message: activeMsg,
        logs
      })}\n\n`);
    }
  };
}

/**
 * Writes an SSE error frame and ends the response.
 * @param {import("express").Response} res
 * @param {Array} logs
 * @param {string} message
 */
export function sendErrorAndEnd(res, logs, message = "Internal Server Error") {
  const activeStep =
    logs.find(s => s.status === "active") ||
    logs.find(s => s.status === "pending") ||
    logs[logs.length - 1];

  if (activeStep) {
    activeStep.status = "error";
    if (!activeStep.details) activeStep.details = [];
    if (!activeStep.details.includes(message)) activeStep.details.push(message);
  }

  try {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({
        type: "progress",
        step: "ERROR",
        message,
        logs,
        error: true
      })}\n\n`);
      res.end();
    }
  } catch (sendErr) {
    // Response already closed
  }
}

/**
 * Writes a complete SSE event and ends the response.
 * @param {import("express").Response} res
 * @param {*} data
 */
export function sendCompleteAndEnd(res, data) {
  res.write(`data: ${JSON.stringify({ type: "complete", data })}\n\n`);
  res.end();
}

/**
 * Sets the standard SSE response headers.
 * @param {import("express").Response} res
 */
export function setSSEHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
}
