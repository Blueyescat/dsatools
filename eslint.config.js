import { FlatCompat } from "@eslint/eslintrc"
import js from "@eslint/js"
import globals from "globals"
import path from "node:path"
import { fileURLToPath } from "node:url"
import tsParser from "@typescript-eslint/parser"
import tsPlugin from "@typescript-eslint/eslint-plugin"

const compat = new FlatCompat({
	baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all
})

export default [...compat.extends("eslint:recommended"), {
	ignores: ["**/dist/**"]
}, {
	languageOptions: {
		ecmaVersion: 2022,
		sourceType: "module"
	},
	rules: {
		indent: ["error", "tab", {
			SwitchCase: 1
		}],
		quotes: ["error", "double", {
			allowTemplateLiterals: true
		}],
		semi: ["error", "never"],
		"prefer-const": "warn",
		"@typescript-eslint/no-this-alias": "off"
	}
}, {
	files: ["**/*.ts"],
	languageOptions: {
		parser: tsParser
	},
	plugins: {
		"@typescript-eslint": tsPlugin
	},
	rules: {
		...tsPlugin.configs.recommended.rules,
		"no-undef": "off",
		"no-redeclare": "off",
		"@typescript-eslint/no-redeclare": "off",
		"@typescript-eslint/no-explicit-any": "off",
		"@typescript-eslint/no-unused-vars": ["error", {
			argsIgnorePattern: "^_",
			varsIgnorePattern: "^_"
		}],
		"no-unused-expressions": "off",
		"@typescript-eslint/no-unused-expressions": ["error", {
			allowTernary: true,
			allowShortCircuit: true
		}]
	}
}, {
	files: ["server/**/*.js", "server/**/*.ts"],
	languageOptions: {
		globals: {
			...globals.node,
			...globals.worker
		}
	}
}, {
	files: ["client/**/*.js", "client/**/*.ts"],
	languageOptions: {
		globals: {
			...globals.browser,
			...globals.worker
		}
	}
}, {
	files: ["client/build.js"],
	languageOptions: {
		globals: {
			...globals.node
		}
	}
}]
