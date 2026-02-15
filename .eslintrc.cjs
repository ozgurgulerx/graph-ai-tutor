module.exports = {
  root: true,
  ignorePatterns: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  overrides: [
    {
      files: ["**/*.tsx"],
      plugins: ["react", "react-hooks", "react-refresh"],
      extends: [
        "plugin:react/recommended",
        "plugin:react-hooks/recommended",
      ],
      settings: {
        react: { version: "detect" },
      },
      rules: {
        "react/react-in-jsx-scope": "off"
      }
    },
    {
      files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
      env: {
        jest: true
      }
    }
  ]
};

