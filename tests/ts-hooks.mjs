import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

function hasExtension(specifier) {
  return /\.[a-zA-Z0-9]+$/.test(specifier.split("?")[0]);
}

export async function load(url, context, nextLoad) {
  if (!url.endsWith(".ts") && !url.endsWith(".tsx")) return nextLoad(url, context);
  const source = readFileSync(fileURLToPath(url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      verbatimModuleSyntax: false,
    },
    fileName: url,
  }).outputText;
  return { format: "module", source: js, shortCircuit: true };
}

export async function resolve(specifier, context, nextResolve) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !hasExtension(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      try {
        return await nextResolve(`${specifier}.tsx`, context);
      } catch {
        return nextResolve(specifier, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
