// ── Session Management ───────────────────────────────────────────────────────
// Generate and persist a stable session ID across page reloads.
// This ties the frontend conversation to the backend's per-session memory.

function getSessionId(): string {
    let id = sessionStorage.getItem("velora_session_id");
    if (!id) {
        id = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
        sessionStorage.setItem("velora_session_id", id);
    }
    return id;
}

const API_URL = "/api/chat";

let activeAbortController: AbortController | null = null;

export const abortActiveRequest = () => {
    if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
    }
};

// Helper to handle streaming POST requests to /api/chat
const fetchStream = async (body: any, onProgress?: (payload: any) => void): Promise<any> => {
    if (activeAbortController) {
        activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-session-id": getSessionId(),
            },
            body: JSON.stringify(body),
            signal: activeAbortController.signal,
        });

        if (!response.ok) {
            throw new Error("Failed to fetch response");
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error("ReadableStream not supported by browser");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let finalResult: any = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                if (trimmedLine.startsWith("data: ")) {
                    try {
                        const payload = JSON.parse(trimmedLine.slice(6));
                        if (payload.type === "progress") {
                            onProgress?.(payload);
                        } else if (payload.type === "complete") {
                            finalResult = payload.data;
                        }
                    } catch (err) {
                        console.error("Failed to parse SSE line:", trimmedLine, err);
                    }
                }
            }
        }

        // Process any remaining buffered text
        if (buffer && buffer.trim().startsWith("data: ")) {
            try {
                const payload = JSON.parse(buffer.trim().slice(6));
                if (payload.type === "progress") {
                    onProgress?.(payload);
                } else if (payload.type === "complete") {
                    finalResult = payload.data;
                }
            } catch (err) {
                console.error("Failed to parse trailing buffer:", buffer, err);
            }
        }

        if (!finalResult) {
            throw new Error("Stream closed without complete response");
        }

        return finalResult;
    } finally {
        activeAbortController = null;
    }
};

// ── General Chat / Intent Message ────────────────────────────────────────────
export const sendMessage = async (
    message: string,
    onProgress?: (payload: any) => void,
    commerceState?: any
) => {
    return fetchStream({
        message,
        sessionId: getSessionId(),
        commerceState,
    }, onProgress);
};

export const sendIntentMessage = async (
    message: string,
    intent: string,
    parameters: any,
    onProgress?: (payload: any) => void,
    commerceState?: any
) => {
    return fetchStream({
        message,
        sessionId: getSessionId(),
        intent,
        parameters,
        commerceState,
    }, onProgress);
};

// ── Product Selection ─────────────────────────────────────────────────────────
// Called when the user clicks a product card. Sends the selected product
// to the backend so it can be saved to session memory and a follow-up
// conversational response (product_selected type) is returned.

export interface SelectedProductPayload {
    id: string;
    name: string;
    price: number;
    currency?: string;
    image?: string;
    images?: string[];
    inStock?: boolean;
    url?: string;
    [key: string]: unknown;
}

export const selectProduct = async (product: SelectedProductPayload): Promise<unknown> => {
    return fetchStream({
        message: `select_product:${product.id}`,
        sessionId: getSessionId(),
        intent: "select_product",
        product,
    });
};

// ── Get Product Details ───────────────────────────────────────────────────────
// Called when user clicks "View Full Details" from the action popup.
// Returns a product_details type response with formatted markdown content.

export const fetchProductDetails = async (productId: string): Promise<unknown> => {
    return fetchStream({
        message: `get_product_details:${productId}`,
        sessionId: getSessionId(),
        intent: "get_product_details",
        parameters: { productId },
    });
};