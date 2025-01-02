import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
	{
		ignores: ['dist/**', 'node_modules/**']
	},
	{
		files: ['**/*.{js,ts}'],
		languageOptions: {
			ecmaVersion: 2020,
			sourceType: 'module',
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2020
			},
			globals: {
				Uint8Array: true,
				Uint16Array: true,
				Uint32Array: true
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			...tsPlugin.configs.recommended.rules
		},
		env: {
			browser: true,
			es6: true,
			node: true
		}
	}
];
