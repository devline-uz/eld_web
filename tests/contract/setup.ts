// MSW lifecycle for the contract suite. `onUnhandledRequest: 'error'` is deliberate: a request
// to an endpoint without a handler is a missing contract test, not a passing one.
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../../src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
