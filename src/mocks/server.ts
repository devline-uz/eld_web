// The shared MSW node server. A test imports this, adds `server.use(...)` for its own case, and
// never builds a second server (web/tz.md §18).
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
export { handlers };
export { ok, fail, url } from './envelope';
export { fixture, OPENAPI_EXAMPLES } from './fixtures.generated';
