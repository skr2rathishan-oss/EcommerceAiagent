export const searchProducts = async (query) => {
  console.log("Searching Kapruka for:", query);

  return {
    success: true,
    tool: "kapruka_search_products",
    query
  };
};

export const processMessage = async (message) => {
  console.log("Service received:", message);

  return await searchProducts(message);
};