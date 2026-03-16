const js = require("@eslint/js");

module.exports = [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**"
    ]
  },
  {
    files: ["eslint.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        module: "readonly",
        require: "readonly"
      }
    }
  },
  js.configs.recommended,
  {
    files: ["src/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        Blob: "readonly",
        DOMParser: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        Image: "readonly",
        URL: "readonly",
        XMLSerializer: "readonly",
        console: "readonly",
        document: "readonly",
        globalThis: "readonly",
        module: "readonly",
        require: "readonly",
        window: "readonly"
      }
    }
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        Buffer: "readonly",
        URL: "readonly",
        console: "readonly",
        process: "readonly"
      }
    }
  },
  {
    files: ["playwright.config.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        process: "readonly"
      }
    }
  },
  {
    files: ["test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        Event: "readonly",
        Buffer: "readonly",
        console: "readonly",
        document: "readonly",
        localStorage: "readonly",
        process: "readonly"
      }
    }
  }
];
