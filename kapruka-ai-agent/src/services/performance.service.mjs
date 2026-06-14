// src/services/performance.service.mjs
// Simple in-memory performance metrics collector.
// Each stage records an array of durations (ms). Functions provide recording, reset, and average calculations.

const metrics = {
  intentDetection: [], // time to detect intent
  memoryLoad: [], // time to load memory/context (includes MongoDB reads)
  mongoRead: [], // alias for memoryLoad (Mongo reads)
  qwenResponse: [], // time for primary LLM call
  mcpSearch: [], // time for MCP product search
  formatting: [], // time to format recommendations / final payload
  total: [] // total request time
};

function _push(metricName, duration) {
  if (typeof duration === 'number' && duration >= 0) {
    metrics[metricName].push(duration);
  }
}

export function recordIntentDetection(duration) { _push('intentDetection', duration); }
export function recordMemoryLoad(duration) { _push('memoryLoad', duration); }
export function recordMongoRead(duration) { _push('mongoRead', duration); }
export function recordQwenResponse(duration) { _push('qwenResponse', duration); }
export function recordMcpSearch(duration) { _push('mcpSearch', duration); }
export function recordFormatting(duration) { _push('formatting', duration); }
export function recordTotal(duration) { _push('total', duration); }

export function resetMetrics() {
  for (const key in metrics) {
    if (Array.isArray(metrics[key])) {
      metrics[key] = [];
    }
  }
}

function _average(arr) {
  if (!arr.length) return 0;
  const sum = arr.reduce((a, b) => a + b, 0);
  return sum / arr.length;
}

export function getAllAverages() {
  return {
    averageIntentDetection: _average(metrics.intentDetection),
    averageMemoryLoad: _average(metrics.memoryLoad),
    averageMongoRead: _average(metrics.mongoRead),
    averageQwenResponse: _average(metrics.qwenResponse),
    averageMcpSearch: _average(metrics.mcpSearch),
    averageFormatting: _average(metrics.formatting),
    averageTotalRequest: _average(metrics.total)
  };
}

// Export raw metrics for possible advanced analysis
export function getRawMetrics() {
  return { ...metrics };
}
