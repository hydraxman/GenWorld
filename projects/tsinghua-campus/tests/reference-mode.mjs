import test from 'node:test';

export function referenceTest(name, fn) {
  return test(`local reference bytes: ${name}`, {
    skip: process.env.CAMPUS_TEST_REFERENCES === '1' ? false
      : 'Image bytes were NOT checked; optional local photos are not distributed. Run npm run test:references explicitly.',
  }, fn);
}
