module.exports = {
  root: true,
  ignorePatterns: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    // TypeScript + editor formatting sometimes introduces mixed indentation in TSX; keep lint focused on correctness.
    "no-mixed-spaces-and-tabs": "off"
  },
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
        "react/react-in-jsx-scope": "off",
        // TS types are sufficient for props validation.
        "react/prop-types": "off"
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
