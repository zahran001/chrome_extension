// Mock chrome.storage.local for unit tests
const chromeMock = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  runtime: {
    connect: vi.fn(),
    sendMessage: vi.fn(),
    openOptionsPage: vi.fn(),
    getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`),
    lastError: null,
  },
};

// @ts-ignore — mock global chrome object
globalThis.chrome = chromeMock;
