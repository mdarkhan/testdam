// Runs once when the server process starts (not during `next build`).
// Fills an empty database with the reference catalogue and creates the first admin — see lib/bootstrap.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { bootstrap } = await import("./lib/bootstrap");
    await bootstrap();
  } catch (e) {
    // Never block the server from starting; the admin can still log in and fix things.
    console.error("[bootstrap] failed", e);
  }
}
