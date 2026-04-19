export default {
  entry: [
    "homeworks/**/benchmark.ts",
    "homeworks/008-data-formats/fixtures-generator.ts",
    "homeworks/002-bytecode-interpreter/server.ts",
    "homeworks/002-bytecode-interpreter/index.html",
    "homeworks/002-bytecode-interpreter/frontend.tsx",
  ],
  ignoreFiles: ["styles/globals.css"],
  exclude: ["exports", "nsExports", "types", "nsTypes", "enumMembers"],
};
