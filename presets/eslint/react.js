// Rules only: eslint-config-next registers the react, react-hooks and jsx-a11y plugins (and enables the React hooks and
// React Compiler rules). Registering them again would fail with "Cannot redefine plugin".
import jsxA11y from "eslint-plugin-jsx-a11y";

/** React standards from the lint catalog, plus jsx-a11y's full recommended set (Next enables only a few of them). */
export const react = [
  {
    files: ["**/*.tsx"],
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/no-multi-comp": "error",
      "react/destructuring-assignment": ["error", "always"],
      "react/function-component-definition": [
        "error",
        { namedComponents: "arrow-function", unnamedComponents: "arrow-function" },
      ],
      "react/jsx-handler-names": [
        "error",
        { checkLocalVariables: true, checkInlineFunction: false },
      ],
      "@typescript-eslint/no-restricted-types": [
        "error",
        {
          types: {
            "React.FC": "Type the props directly: ({ title }: CardProps) => …",
            FC: "Type the props directly: ({ title }: CardProps) => …",
          },
        },
      ],
    },
  },
];
