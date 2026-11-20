/**
 * Compare mirrored functions when all nine standalone projects are checked out side by side.
 * Run node .github/scripts/check-family.mjs from CODE.view.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workspace = new URL("../../../", import.meta.url);
const viewers = ["code", "csv", "diff", "json", "log", "md", "xml", "yaml"];
const family = [...viewers, "md.edit"];
const sources = new Map();
const playgrounds = new Map();

for (const name of family) {
  const repo = name === "md.edit" ? name : name + ".view";
  const read = (filename) => readFileSync(new URL(repo + "/" + filename, workspace), "utf8").replaceAll("\r\n", "\n");
  sources.set(name, read(name + ".js"));
  if (name !== "md.edit") playgrounds.set(name, read("index.html"));
}

function checkHelpers(projects, names) {
  for (const name of names) {
    // Standalone helpers are top-level const arrows inside each library's wrapper.
    const declaration = new RegExp(`^  const ${name} = (?:[^\\n]+;$|[^\\n]*=> \\{\\n[\\s\\S]*?^  \\};$)`, "m");
    const bodies = projects.map((project) => {
      const match = sources.get(project).match(declaration);
      assert.ok(match, `${project}: missing declaration for ${name}`);
      // Mount uses its public entry point for the error message and displayed version.
      return name === "mount" ? match[0].replaceAll(`by${project.toUpperCase()}viewer`, "byViewer") : match[0];
    });
    for (const [i, project] of projects.entries()) {
      assert.equal(bodies[i], bodies[0], `${project}: ${name} differs from ${projects[0]}`);
    }
  }
}

checkHelpers(family, ["node", "warnMissingThemes", "getLocalTheme", "setLocalTheme", "applyAppearance", "syncMotion", "createThemeButton"]);
checkHelpers(viewers, ["applyContentAppearance", "appendThemeToggle", "appendFontSizeControls", "appendCopyButton", "mountControls"]);
checkHelpers(["code", "csv", "diff", "log", "xml", "yaml"], ["pause"]);
checkHelpers(["code", "csv", "diff", "xml", "yaml"], ["mount"]);
checkHelpers(["csv", "diff", "log", "xml", "yaml"], ["button"]);
checkHelpers(["csv", "diff", "log"], ["positive"]);
checkHelpers(["diff", "log", "xml", "yaml"], ["copyButton"]);

// The iframe target, CSS export selector and format defaults belong to the caller.
const appearance = /^      \(function appearance\([\s\S]*?^      }\)/m;
for (const [name, html] of playgrounds) {
  const match = html.match(appearance);
  assert.ok(match, `${name}: missing playground appearance function`);
  assert.equal(match[0], playgrounds.get("code").match(appearance)[0], `${name}: playground appearance differs from code`);
}
console.log("Shared runtime and playground functions match across the nine projects.");
