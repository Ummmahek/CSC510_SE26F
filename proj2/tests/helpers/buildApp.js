// Assembles a minimal Express app out of just the router(s) a given test file needs.
//
// Why not require server/index.js directly: it calls app.listen() unconditionally at module
// scope and never exports `app`, so it can't be require()'d by supertest without also starting
// a real network listener as a side effect of the import. Rather than patch production source
// to export `app` (out of scope for a testing task), each test file mounts only the router(s)
// relevant to its use case on a fresh app instance -- the routers themselves are the real,
// unmodified production code from server/routes/*.js.
const express = require('express');

function buildApp(routesMap) {
  const app = express();
  app.use(express.json());
  for (const [mountPath, router] of Object.entries(routesMap)) {
    app.use(mountPath, router);
  }
  return app;
}

module.exports = { buildApp };
