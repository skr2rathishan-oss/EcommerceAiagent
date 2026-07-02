import { getSearchProductsController } from './kapruka-ai-agent/src/controllers/products.controller.mjs';

const req = {
  body: { query: 'phone', category: 'Electronics', budget: 50000 }
};

const res = {
  status(code) {
    return {
      json(payload) {
        console.error(`STATUS ${code}`);
        console.error(JSON.stringify(payload));
        process.exitCode = 1;
      }
    };
  },
  json(payload) {
    console.log('RESULT');
    console.log(JSON.stringify(payload));
    if (!Array.isArray(payload) || payload.length === 0) {
      process.exitCode = 1;
    }
  }
};

await getSearchProductsController(req, res);
