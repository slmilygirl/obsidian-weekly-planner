/* Official Obsidian lint rules.

   The submission pipeline runs these same rules against every released version
   and pulls a plugin out of search within 24 hours if a version fails, so run
   this locally before tagging a release:

     npm install
     npm run lint

   See test/lint.py if you would rather not install the toolchain locally. */
import obsidianmd from "eslint-plugin-obsidianmd";

export default [
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        /* main.js is plain JavaScript and this repo has no tsconfig.json, so the
           type-aware project service has to be told which files to accept. */
        projectService: {
          allowDefaultProject: ["*.js", "eslint.config.*"],
        },
      },
    },
  },
];
