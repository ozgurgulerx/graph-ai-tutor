import { buildServer } from "./server";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "127.0.0.1";

const app = buildServer();

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

