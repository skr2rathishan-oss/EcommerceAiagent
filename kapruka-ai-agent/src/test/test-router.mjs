import { routeIntent } from "../agent/intentRouter.mjs";

const run = async () => {
  const result = await routeIntent(
    "search_products",
    {
      query: "chocolate cake"
    }
  );

  console.log(result);
};

run();