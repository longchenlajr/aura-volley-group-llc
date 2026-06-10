// Runs once before the integration project. Fails fast with an actionable
// message if the local dev stack isn't running, rather than letting every test
// time out against a dead connection.
export default async function setup() {
  const url = "http://127.0.0.1:54321/rest/v1/";
  try {
    const res = await fetch(url, { method: "GET" });
    // PostgREST answers the root with 200; the proxy forwards it.
    if (!res.ok && res.status !== 404) {
      throw new Error(`unexpected status ${res.status}`);
    }
  } catch (err) {
    throw new Error(
      `Local dev stack not reachable at ${url} (${(err as Error).message}). ` +
        `Run \`npm run db:start\` before the integration tests.`,
    );
  }
}
