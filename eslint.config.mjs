import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: ["**/lib/**", "app/static/js/lib/**/*.js"]
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                $: "readonly",
                bootstrap: "readonly",
                tooltip: "readonly",
                Treant: "readonly"
            }
        },
        rules: {
            "no-unused-vars": ["warn"],
            "no-undef": "error"
        }
    }
];
