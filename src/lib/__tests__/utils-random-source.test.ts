/**
 * generateId / generateInviteCode must draw their randomness from expo-crypto,
 * not from `uuid` (which requires a global `crypto.getRandomValues` that Hermes
 * does not provide, so every insert threw on device) and not from Math.random
 * (not a CSPRNG — the invite code is the only thing gating a family join).
 *
 * The web preset has a global crypto, so the device failure cannot be
 * reproduced here; instead expo-crypto is mocked and the tests assert the
 * helpers return what it produced.
 */

const mockRandomUUID = jest.fn();
const mockGetRandomValues = jest.fn();

jest.mock('expo-crypto', () => ({
  randomUUID: () => mockRandomUUID(),
  getRandomValues: (arr: Uint8Array) => mockGetRandomValues(arr),
}));

import { generateId, generateInviteCode, INVITE_CODE_CHARSET } from '../utils';

beforeEach(() => {
  mockRandomUUID.mockReset();
  mockGetRandomValues.mockReset();
});

describe('generateId random source', () => {
  it('returns the id expo-crypto generated', () => {
    mockRandomUUID.mockReturnValue('11111111-2222-4333-8444-555555555555');
    expect(generateId()).toBe('11111111-2222-4333-8444-555555555555');
    expect(mockRandomUUID).toHaveBeenCalledTimes(1);
  });
});

describe('generateInviteCode random source', () => {
  it('maps each expo-crypto byte onto the charset', () => {
    mockGetRandomValues.mockImplementation((arr: Uint8Array) => {
      arr.set([0, 1, 2, 3, 30, 31]);
      return arr;
    });
    expect(generateInviteCode()).toBe('ABCD89');
    expect(mockGetRandomValues).toHaveBeenCalledTimes(1);
  });

  it('wraps bytes above the charset length without leaving the charset', () => {
    // 32 divides 256 exactly, so `byte % 32` is unbiased: 32 -> 'A', 255 -> '9'.
    expect(256 % INVITE_CODE_CHARSET.length).toBe(0);
    mockGetRandomValues.mockImplementation((arr: Uint8Array) => {
      arr.set([32, 64, 255, 224, 33, 63]);
      return arr;
    });
    expect(generateInviteCode()).toBe('AA9AB9');
  });
});
