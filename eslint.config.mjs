import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  // 1. Les dossiers à ignorer globalement
  {
    ignores: [
      "venv/",
      "app/static/vendor/",
      "app/static/js/lib/",
      "tests/e2e/artifacts/"
    ]
  },

  // 2. Environnement (navigateur, node pour tests) et variables globales
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        tooltip: "readonly",
        bootstrap: "readonly",
        $: "readonly",
        jQuery: "readonly",
        Treant: "readonly",
        DOMPurify: "readonly"
      }
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      "no-unused-vars": [
        "error",
        {
          "args": "after-used",
          "argsIgnorePattern": "^_",
          "varsIgnorePattern": "^_"
        }
      ],
      "no-undef": "error",
      "no-console": ["warn", { "allow": ["warn", "error"] }]
    }
  }
];
