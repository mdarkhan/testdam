// Local development database: a real PostgreSQL server run from npm binaries (embedded-postgres).
// Data lives in ./.pgdata (git-ignored). Run `npm run db:start` in its own terminal and leave it open.
// Port, user and password match DATABASE_URL in .env.example.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".pgdata");
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "testdam",
  password: "testdam",
  port: 54329,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale-provider=builtin", "--builtin-locale=C.UTF-8", "--locale=C"],
});

const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) {
  await pg.createDatabase("testdam");
  await pg.createDatabase("testdam_test");
}
console.log("PostgreSQL running on localhost:54329 (databases: testdam, testdam_test). Ctrl+C to stop.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
