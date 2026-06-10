const API_URL = "/api/chat";

export const sendMessage = async (message: string) => {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            message,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to fetch products");
    }

    return response.json();
};