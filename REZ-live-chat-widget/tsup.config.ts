import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/widget.ts'],
  format: ['cjs', 'esm', 'umd'],
  dts: true,
  external: ['react', 'preact'],
  splitting: false,
  sourcemap: true,
  clean: true,
  banner: {
    js: '/* @rezmedia/live-chat-widget v1.0.0 */',
  },
});
