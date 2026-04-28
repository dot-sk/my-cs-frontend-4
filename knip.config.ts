export default {
  entry: [
    "homeworks/**/benchmark.ts",
    "homeworks/**/benchmark-*.ts",
    "homeworks/008-data-formats/fixtures-generator.ts",
    "homeworks/002-bytecode-interpreter/server.ts",
    "homeworks/002-bytecode-interpreter/index.html",
    "homeworks/002-bytecode-interpreter/frontend.tsx",
    "homeworks/009-2d-matrix/web/server.ts",
    "homeworks/009-2d-matrix/web/index.html",
    "homeworks/009-2d-matrix/web/frontend.tsx",
  ],
  ignoreFiles: ["styles/globals.css"],
  exclude: ["exports", "nsExports", "types", "nsTypes", "enumMembers"],
};
