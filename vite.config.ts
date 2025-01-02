import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { defineConfig as defineVitestConfig } from 'vitest/config';

export default defineConfig(
	defineVitestConfig({
		build: {
			lib: {
				entry: 'src/index.ts',
				formats: ['es', 'cjs', 'umd'],
				name: 'crossfilter',
				fileName: (format) => `crossfilter.${format}.js`
			},
			sourcemap: true,
			minify: true,
			rollupOptions: {
				external: ['d3'],
				output: {
					globals: {
						d3: 'd3'
					}
				}
			}
		},
		plugins: [dts()],
		test: {
			globals: true,
			environment: 'node'
		}
	})
);
