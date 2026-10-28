// Mocks de módulos nativos do Expo / React Native para execução em ambiente Node (Jest)
const memoryStore = new Map();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key) => memoryStore.get(key) ?? null),
    setItem: jest.fn(async (key, value) => {
      memoryStore.set(key, value);
    }),
    removeItem: jest.fn(async (key) => {
      memoryStore.delete(key);
    }),
    clear: jest.fn(async () => {
      memoryStore.clear();
    }),
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key) => memoryStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key, value) => {
    memoryStore.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key) => {
    memoryStore.delete(key);
  }),
}));

jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));
