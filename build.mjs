// Build: compila src/app.jsx (React + JSX) e gera um index.html autossuficiente,
// com TODO o JavaScript embutido (sem CDN, sem Babel no navegador).
//
// Uso:
//   node build.mjs            -> gera index.html uma vez
//   node build.mjs --watch    -> recompila a cada alteracao em src/
import { build, context } from "esbuild";
import { writeFileSync } from "fs";

const watch = process.argv.includes("--watch");

const buildOptions = {
  entryPoints: ["src/app.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  define: { "process.env.NODE_ENV": '"production"' },
  loader: { ".jsx": "jsx" },
  write: false, // pegamos o resultado em memoria para embutir no HTML
};

function emitHtml(js) {
  // Evita que algum "</script>" dentro do bundle encerre o <script> antes da hora
  const safe = js.replace(/<\/script>/g, "<\\/script>");
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<title>Fala, Papagaio! &mdash; Pronuncia em ingles</title>
<meta name="description" content="App infantil para praticar pronuncia em ingles, estilo Duolingo." />
<style>html,body{margin:0;padding:0;background:#E2F6F0;}</style>
</head>
<body>
<div id="root"></div>
<script>
${safe}
</script>
</body>
</html>
`;
  writeFileSync("index.html", html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  console.log(`\u2713 index.html gerado (${kb} KB) \u2014 ${new Date().toLocaleTimeString()}`);
}

if (watch) {
  // Plugin que regenera o HTML ao fim de cada compilacao
  const htmlPlugin = {
    name: "html-inline",
    setup(b) {
      b.onEnd((res) => {
        if (res.errors.length === 0 && res.outputFiles?.length) {
          emitHtml(res.outputFiles[0].text);
        }
      });
    },
  };
  const ctx = await context({ ...buildOptions, plugins: [htmlPlugin] });
  await ctx.watch();
  console.log("Observando src/ ... (Ctrl+C para sair)");
} else {
  const result = await build(buildOptions);
  emitHtml(result.outputFiles[0].text);
}
