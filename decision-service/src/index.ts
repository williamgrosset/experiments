import { buildServer } from "./server.js";

const PORT = parseInt(process.env.DECISION_SERVICE_PORT || "3002", 10);

async function main() {
  const app = buildServer();

  try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
