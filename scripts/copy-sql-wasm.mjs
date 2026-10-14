// Copie le moteur SQLite WebAssembly utilisé par jeep-sqlite (mode navigateur uniquement :
// sur Android, SQLite est natif). jeep-sqlite le charge depuis /assets/sql-wasm.wasm.
//
// jeep-sqlite embarque son propre code JavaScript sql.js : le .wasm doit venir de la MÊME
// version de sql.js, sinon le navigateur échoue avec
// "LinkError: WebAssembly.instantiate(): ... function import requires a callable".
// Ce script vérifie donc que les fonctions importées par le .wasm correspondent.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";

const src = "node_modules/sql.js/dist/sql-wasm.wasm";
const dest = "public/assets/sql-wasm.wasm";
const jeepEntry = "node_modules/jeep-sqlite/dist/esm/jeep-sqlite.entry.js";

/** Noms des fonctions que le code sql.js embarqué dans jeep-sqlite fournit au .wasm. */
function jeepImportNames() {
  if (!existsSync(jeepEntry)) return null;
  const code = readFileSync(jeepEntry, "utf8");
  const start = code.indexOf("Vc={");
  if (start < 0) return null;
  let depth = 0;
  let end = start + 3;
  for (; end < code.length; end++) {
    if (code[end] === "{") depth++;
    else if (code[end] === "}" && --depth === 0) break;
  }
  const body = code.slice(start + 4, end);
  const names = [];
  let d = 0;
  let token = "";
  for (const c of body) {
    if ("({[".includes(c)) d++;
    else if (")}]".includes(c)) d--;
    if (d === 0 && c === ":" && /^[A-Za-z$_]+$/.test(token.trim())) names.push(token.trim());
    if (d === 0 && (c === "," || c === ":")) token = "";
    else if (d === 0) token += c;
  }
  return names.sort();
}

if (!existsSync(src)) {
  console.warn(`[copy-sql-wasm] ${src} introuvable : le mode navigateur de SQLite ne fonctionnera pas.`);
} else {
  const expected = jeepImportNames();
  const actual = WebAssembly.Module.imports(new WebAssembly.Module(readFileSync(src)))
    .map((i) => i.name)
    .sort();
  if (expected && JSON.stringify(expected) !== JSON.stringify(actual)) {
    console.error(
      `[copy-sql-wasm] ATTENTION : ${src} (${actual.length} imports) est incompatible avec jeep-sqlite ` +
        `(${expected.length} attendus). Installez la version de sql.js correspondant à jeep-sqlite ` +
        `(sql.js 1.12.0 pour jeep-sqlite 2.8.0). Le mode navigateur ne fonctionnera pas.`
    );
  }
  mkdirSync("public/assets", { recursive: true });
  copyFileSync(src, dest);
  console.log(`[copy-sql-wasm] ${src} -> ${dest}`);
}
