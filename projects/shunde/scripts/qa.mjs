// Back-compatible entry; tests real browser geometry and GLB readback.
process.argv.push('--export');
await import('./capture.mjs');
