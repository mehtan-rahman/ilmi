import { describe, expect, it } from 'vitest';
import { isNetwork } from '../sync.js';

// a token the remote refuses was taken for no network: the strip said offline and the reason was never shown
describe('a sync error', () => {
  it('is offline when the remote is not reached', () => {
    expect(isNetwork(new Error('failed to resolve address for github.com: nodename nor servname provided; class=Net (12)'))).toBe(true);
    expect(isNetwork('connection timed out; class=Net (12)')).toBe(true);
  });
  it('is said when the remote refuses the token', () => {
    expect(isNetwork(new Error('the remote does not accept this token: it may be mistyped, expired or replaced by a new one (too many redirects or authentication replays; class=Http (34))'))).toBe(false);
    expect(isNetwork('this token may not read or write this repository: on github, give it contents read and write on it (unexpected http status code: 403; class=Http (34))')).toBe(false);
  });
});
