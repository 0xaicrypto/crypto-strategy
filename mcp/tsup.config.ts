import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  clean: true,
  dts: false,
  sourcemap: false,
  minify: false,
  outExtension() {
    return {
      js: '.js',
    };
  },
  noExternal: [/.*/],
});
