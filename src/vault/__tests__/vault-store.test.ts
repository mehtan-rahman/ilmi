// `vault.test.ts` again, over a collection's store in memory instead of a
// directory (milestone 59): `disk.ts` reads the flag and opens the corpus
// imported into a `storeFs`.

(globalThis as { ILMI_TEST_STORE?: boolean }).ILMI_TEST_STORE = true;
await import('./vault.test.js');

export {};
