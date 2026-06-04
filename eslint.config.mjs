import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  // 1. Les dossiers à ignorer globalement (doit être son propre objet)
  {
    ignores: [
      "venv/",
      "app/static/vendor/",
      "app/static/js/lib/"
    ]
  },

  // 2. Ton environnement (navigateur) et variables globales
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        tooltip: "readonly",
        bootstrap: "readonly",
        $: "readonly",
        jQuery: "readonly",
        Treant: "readonly"
      }
    }
  },

  // 3. Les règles recommandées standards de JavaScript
  pluginJs.configs.recommended
];
