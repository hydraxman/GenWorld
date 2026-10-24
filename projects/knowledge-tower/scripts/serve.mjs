import { startServer } from './server.mjs';

const port = process.env.PORT === undefined ? 8785 : Number(process.env.PORT);
const server = await startServer({ port });
console.log(`Knowledge tower: http://127.0.0.1:${server.address().port}`);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
