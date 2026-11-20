# CODE.view

Display source with syntax highlighting, language selection, line numbers, wrapping, and copy controls.

![CODE.view preview](prev.jpg)

## Index

1. [Quick start](#quick-start)
2. [Try it](#try-it)
3. [Downloads](#downloads)
4. [API and options](#api-and-options)
5. [Themes](#themes)
6. [Checks and releases](#checks-and-releases)
7. [Related projects](#related-projects)
8. [License](#license)

## Quick start

```html
<link href="https://cdn.jsdelivr.net/gh/byuwur/code.view@latest/code.min.css" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/gh/byuwur/code.view@latest/code.min.js" defer></script>
<div id="viewer" data-theme="light"></div>
<script>
  document.addEventListener("DOMContentLoaded", () => {
    byCODEviewer(document.getElementById("viewer"), 'const greeting = "Hello";', {
      language: "javascript",
      lineNumbers: true,
      wordWrap: true
    });
  });
</script>
```

Pin a published tag in place of `@latest` for a fixed version.

### Offline use and Content Security Policy

The renderer loads no remote scripts, fonts, or styles. Local library files work without a CDN, including in a `file://` host. Host optional `code.themes.css` locally for extra palettes. The online playground and exported CDN starter still require internet access; a local starter requires all referenced files beside it. Playground fetches and clipboard permissions remain subject to browser restrictions.

Allow the script and style origins in your CSP. Authorize inline initialization and custom theme CSS separately, or move them into local files. The controls use static HTML templates and do not support enforced Trusted Types.

## Try it

[Playground](https://code.byuwur.co/)

The library contains no tracking. The [privacy policy](https://byuwur.co/privacy/dotview) and [cookie policy](https://byuwur.co/cookies/dotview) apply only to the hosted landing page and playground.

Open [index.html](index.html) locally. Its host assets use the network. Exported starters use the default settings. The playground accepts local files up to 6 MiB.

## Downloads

[ZIP](https://github.com/byuwur/code.view/releases/latest/download/code.view.zip) · [Minified ZIP](https://github.com/byuwur/code.view/releases/latest/download/code.view.minified.zip)

## API and options

1. [API](#api)
2. [Code options](#code-options)
3. [Supported languages](#supported-languages)
4. [Stateful highlighting architecture](#stateful-highlighting-architecture)
5. [Limits and known gaps](#limits-and-known-gaps)
6. [Optional Markdown integration contract](#optional-markdown-integration-contract)
7. [Shared controls and lifecycle](#shared-controls-and-lifecycle)

### API

`byCODEviewer(element, source?, options?)` accepts a string; omitted input uses the target's text. Invalid source/target types throw `TypeError`. Empty input displays one line; unsupported languages use plain text. Display splits LF/CRLF lines, while Copy preserves the source, including CR characters and final newlines. Size/token-limit errors display a message and resolve `ready` false.

`byCODEviewer.highlight(source, language = "plain", options = {})` synchronously returns a `DocumentFragment` with one `.byCODEhighlight` wrapper. Its textContent exactly preserves the source, including whitespace and CRLF. It creates no controls, changes no caller DOM, and never evaluates input.

`byCODEviewer.tokenize(source, language = "plain")` returns a lazy iterator of `{ type, text }` tokens using the same scanner. Joining their text reproduces the source exactly. Editors can consume it in short slices without creating a viewer or DOM. Validation and token-limit errors occur during iteration; the same highlighting limits apply.

```javascript
const tokens = byCODEviewer.tokenize("const answer = 42;\r\n", "js");
const original = [...tokens].map((token) => token.text).join("");
// Consuming all tokens here is synchronous; editors can iterate in scheduled slices.
```

Load `code.css` to style fragments, even without a viewer instance. Unthemed fragments inherit `--by-code-*` colors from any container; missing colors use Monokai Light.

Pass `{ theme: "dark", palette: "github" }` as the third argument to set the fragment's mode and palette, including unclassified text. Both options follow the viewer's validation rules. Omit them to inherit the host's colors.

You can also use `.light` / `.dark` with a named `data-theme` on the returned wrapper. The `data-theme="light"` / `"dark"` aliases remain supported. Explicit themes override inherited colors.

Pass `{ lineNumbers: true, statusBar: true }` as the third argument for a compact framed block. Both options default to `false` and work independently. Line numbers and status are presentation labels; `textContent` still preserves the exact source, including final newlines. Set `highlighting: false` to keep the language label without coloring tokens. The block creates no viewer instance, toolbar, or asynchronous lifecycle.

Invalid source/size throws `TypeError`/`RangeError` before returning a fragment. Unsupported languages use plain text.

```javascript
const code = document.querySelector("pre code");
const fragment = byCODEviewer.highlight(code.textContent, "javascript", { theme: "dark" });
code.replaceChildren(fragment);
```

`byCODEviewer.languages` is the frozen array of 80 canonical language names. Names and aliases are case-insensitive; surrounding whitespace is ignored. There is no automatic language detection. All languages are built in: no extra script, network lookup, or grammar dependency is needed.

The playground includes a source sample for every language, using the same canonical names as the viewer's language selector. Selecting a sample never executes its code.

### Code options

| Option           | Default   | Behavior                                                                    |
| ---------------- | --------- | --------------------------------------------------------------------------- |
| `language`       | `"plain"` | Canonical name or alias from the tables below. Unsupported names use plain. |
| `languageSelect` | `false`   | Show a language selector. Changing it supersedes unfinished rendering.      |
| `lineNumbers`    | `true`    | Show a separate, non-copying line-number gutter.                            |
| `wordWrap`       | `true`    | Wrap long lines; `false` keeps horizontal scrolling inside the viewer.      |

### Supported languages

| Family | Canonical languages |
| --- | --- |
| Web | HTML + CSS + JavaScript (`html`), JavaScript (`javascript`), TypeScript (`typescript`), JSX (`jsx`), TSX (`tsx`), CSS (`css`), SCSS (`scss`), Less (`less`), PHP + HTML (`php`) |
| Data | XML (`xml`), JSON (`json`), JSON with comments (`jsonc`), JSON5 (`json5`), YAML (`yaml`), SQL (`sql`), GraphQL (`graphql`), Protocol Buffers (`protobuf`) |
| Scripting | Python (`python`), Ruby (`ruby`), Perl (`perl`), Lua (`lua`) |
| Shell & build | Bash (`bash`), PowerShell (`powershell`), Windows Batch (`batch`), AWK (`awk`), Dockerfile (`dockerfile`), Makefile (`makefile`), CMake (`cmake`) |
| Systems | C (`c`), C++ (`cpp`), Go (`go`), Rust (`rust`), Zig (`zig`), D (`d`), Nim (`nim`), Solidity (`solidity`), Assembly (x86) (`assembly`), V (`v`), Odin (`odin`) |
| Application languages | C# (`csharp`), Java (`java`), Kotlin (`kotlin`), Scala (`scala`), Swift (`swift`), Objective-C (`objectivec`), Dart (`dart`), Groovy (`groovy`), Crystal (`crystal`), GDScript (`gdscript`), GameMaker Language (`gml`) |
| Scientific | R (`r`), Julia (`julia`), MATLAB (`matlab`), Fortran (`fortran`) |
| Functional | Haskell (`haskell`), Elixir (`elixir`), Erlang (`erlang`), F# (`fsharp`), OCaml (`ocaml`), Clojure (`clojure`), Common Lisp (`lisp`), Scheme (`scheme`), Racket (`racket`) |
| Classic | Pascal (`pascal`), COBOL (`cobol`), Visual Basic .NET (`vbnet`), Ada (`ada`) |
| Hardware & shaders | Verilog (`verilog`), SystemVerilog (`systemverilog`), VHDL (`vhdl`), GLSL (`glsl`), HLSL (`hlsl`), WGSL (`wgsl`) |
| Configuration | TOML (`toml`), INI (`ini`), Nginx (`nginx`), Terraform / HCL (`hcl`) |
| Documents | Markdown (`markdown`), Unified diff (`diff`), Plain text (`plain`) |

Common aliases include `js`, `ts`, `htm`, `py`, `sh`, `c++`/`cc`/`cxx`, `c#`/`cs`, `golang`, `rs`, `kt`, `objc`, `rb`, `pl`, `jl`, `ps1`/`pwsh`, `bat`/`cmd`, `hs`, `ex`, `erl`, `f#`/`fs`, `clj`, `ml`, `pas`, `f90`, `vb`, `sol`, `sv`, `vhd`, `frag`/`vert`, `gql`, `proto`, `tf`/`terraform`, `md`, `patch`, `asm`/`nasm`, and `gd`. `text`, `txt`, and `plaintext` select uncolored source. Unknown names also fall back to plain text.

### Stateful highlighting architecture

Language profiles provide keywords, literals, comment delimiters, quote rules, and common variable/directive forms to the shared scanner. Strings and comments own their contents before keyword matching. Lookup sets are created once; tokenization still yields original source slices lazily, with the existing source/token limits.

Dedicated boundaries handle HTML/XML, PHP inside an HTML host, JSX/TSX markup and brace expressions, Markdown, and unified diffs. JavaScript templates and JSX expressions share a nesting limit of 32. JSX text stays text, while braces return to the JavaScript or TypeScript scanner.

The scanner handles nested comments where applicable, Lua long brackets, Rust and Swift raw strings, C++ delimited raw strings, C# verbatim and variable-length raw strings, triple-quoted strings, Bash/Ruby heredocs, PowerShell here-strings, and Verilog based numbers. These are lexical rules, not compiler grammars. Raw-string boundaries follow the [Rust reference](https://doc.rust-lang.org/reference/tokens.html#raw-string-literals) and [C# reference](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/tokens/raw-string).

### Limits and known gaps

Lexical highlighting does not validate or format code. Ambiguous/incomplete syntax may be colored incorrectly; JavaScript regex/division detection uses heuristics.

The added languages provide lexical highlighting, not full parsing, validation, or compilation. Interpolation inside most non-JavaScript strings is colored as part of the string. Advanced macro systems, Ruby/Perl quote operators, MATLAB transpose ambiguity, fixed-column Fortran/COBOL, assembler dialects, and language-specific semantic rules are not resolved. Markdown coloring covers headings, lists, quotes, links, emphasis, inline code, and fenced regions; it does not replace MD.view.

JS decorators, Python f-string expression highlighting, Bash command-substitution parsing and full expansion support, SQL dialect extensions, PHP interpolation in strings, and YAML semantic validation remain outside the scanner. HTML script bodies use JavaScript regardless of `type`; style bodies use CSS. XML declarations/DTDs are colored as text; CSS selectors have no semantic resolution.

Limits: 2 million source characters, 20,000 LF-delimited display lines, 100,000 lexical tokens, 32 nested JS template-expression scanner levels. Rendering yields while processing token/line chunks and cancels obsolete work; an individual long token or string scan is synchronous. `.highlight()` is synchronous and builds a full fragment, so callers should keep code fences reasonably small.

All accepted lines are mounted; large snippets can create substantial DOMs.

Customize `--by-code-comment`, `--by-code-keyword`, `--by-code-string`, `--by-code-number`, `--by-code-property`, and `--by-code-tag` on `.byCODEdocument` or `.byCODEhighlight`, alongside the shared appearance options below. The returned fragment owns token colors; its caller owns typography, whitespace, theme selection, and block layout.

### Optional Markdown integration contract

Load `code.js` and `code.css` alongside `md.js` and `md.css` before rendering. [MD.view](https://github.com/byuwur/md.view) uses `highlight()` for fenced blocks by default when available. Fence labels select the language; inline code stays plain. Use `{ codeHighlighting: false }` in the Markdown options to disable it.

Fragments inherit Markdown's palette, Light/Dark mode, and custom `--by-code-*` colors, including High Contrast. Markdown's `codeLineNumbers` and `codeStatusBar` options add the optional frame, gutter, and language/line-count row. No nested viewer instance or toolbar is created. Highlighting errors leave the original fence text intact, and Markdown works independently when this library is absent.

For other host pages, call `highlight(source, language)` and insert its fragment into your existing `<pre><code>`. The fragment API adds no controls or shared runtime state. No other viewer loads this library automatically.

[MD.edit](https://github.com/byuwur/md.edit) uses `tokenize()` while editing and the Markdown viewer's `highlight()` integration in Preview. Load the companion scripts before creating the editor.

### Shared controls and lifecycle

| Option             | Default     | Behavior                                                                                                                                                   |
| ------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `animations`       | `true`      | Animate controls, disclosures and theme backgrounds. Overrides the system motion preference.                                                               |
| `appearAnimation`  | `false`     | Fade the viewer in on each render when `animations` is enabled. Initial rendering remains immediate by default.                                            |
| `toolbar`          | `true`      | Show the viewer header; secondary tools are configured separately.                                                                                         |
| `credits`          | `true`      | Show attribution in the header.                                                                                                                            |
| `displayContainer` | `true`      | Show the content panel frame and inner horizontal padding. `false` also hides status information.                                                          |
| `statusBar`        | `true`      | Show counts and metadata when `displayContainer` is true. With `statusBar: false`, loading and empty results remain visible; errors always remain visible. |
| `wrapControl`      | `false`     | Show the word-wrap switch; wordWrap also works without it.                                                                                                 |
| `theme`            | Container   | Initial `"light"` or `"dark"` mode class.                                                                                                                  |
| `palette`          | Container   | Initial `data-theme` palette, including custom CSS names.                                                                                                  |
| `fontSize`         | Container   | Number in rem or a CSS size such as `"1.25em"` or `"20px"`; bounded to `0.5rem`-`3rem`.                                                                    |
| `themeToggle`      | `true`      | Show the theme toggle.                                                                                                                                     |
| `fontSizeControls` | `true`      | Show text-size controls.                                                                                                                                   |
| `copyButton`       | `true`      | Show full source copy button.                                                                                                                              |
| `controlsSize`     | `"regular"` | `"xs"` (0.5rem), `"small"` (0.7rem), `"regular"` (0.875rem), `"large"` (1rem), or `"xl"` (1.25rem); invalid values use `"regular"`.                        |
| `controlsCompact`  | `true`      | Keep credits beside controls; `false` stacks them. Wraps as needed.                                                                                        |
| `controlsPosition` | `"top"`     | Sticky `"top"` or `"bottom"` toolbar; invalid values use `"top"`.                                                                                          |

The controller exposes `ready`, `setOptions(changes)`, and `destroy()`. `ready` resolves `true` after initial rendering, or `false` on a displayed data error or cancellation. Invalid targets/options can throw synchronously.

`ready` describes the initial render only; it does not track later language selections.

```javascript
const viewer = byCODEviewer(target, source, { language: "js" });
const rendered = await viewer.ready; // false on data errors or cancellation.
viewer.destroy(); // Call when the host panel is removed.
```

Re-rendering disposes the previous instance. `destroy()` cancels pending work and clears the target only if the instance still owns it. Duplicate script loads preserve the API. Read its version with `byCODEviewer.VERSION`.

Input is displayed as text, never executed. Style `.byCODEdocument` with `--by-view-bg`, `--by-view-text`, `--by-view-muted`, `--by-view-border`, `--by-view-accent`, `--by-view-alt`, `--by-view-string`, and `--by-view-literal`. The container uses system-ui; source/tree content uses monospace. Override the class or target's inline font/size as needed.

Copy requires clipboard permission in a secure context.

Requires a modern browser with async functions, WeakMap, ES2022 array methods, and CSS variables. The browser suites can run in Chromium, Firefox, and WebKit (see Checks).

`--by-view-content-font` and `--by-view-line-height` set source/tree typography.

The playground disables header-only settings while Viewer header is off, preserving their values. Appearing animation is disabled while Animations is off.

Use `toolbar: false` to hide the header, or disable `credits`, `themeToggle`, `fontSizeControls`, and `copyButton` individually. Content actions such as search and format-specific buttons use their own options.

Controls use monospace by default; override `--by-view-controls-font` to change it.

## Themes

Use `theme` for light or dark mode and `palette` for the color scheme. Monokai, GitHub, Solarized and High Contrast are built in. Load [code.themes.css](code.themes.css) after the base stylesheet for the other palettes.

Options override container settings. Omit an option or pass `null` to keep its current value. Call `setOptions(changes)` on the returned viewer to apply settings immediately. Presentation changes preserve the displayed document. The text controls resize content in `0.125rem` steps. Content padding stays fixed. The document frame, toolbar, and status line keep their size. Reset restores the configured or inherited size. Numeric `fontSize` uses rem. CSS sizes such as `20px` also work within the `0.5rem` to `3rem` range. Invalid appearance values throw `RangeError` before replacing the document.

```html
<div id="viewer" class="dark" data-theme="github"></div>
```

Use **Copy CSS** in the playground to export appearance settings. Set `--by-view-document-bg` for the outer background and `--by-view-container-bg` for panels and controls. Define custom palette variables on the component’s mode class and `[data-theme]` selector. For example:

```css
.byCODEdocument.dark[data-theme="my-ocean"] {
  --by-view-bg: #102a43;
  --by-view-text: #f0f6fc;
}
```

### Palette names

`monokai`, `github`, `solarized`, `high-contrast`, `dracula`, `darcula`, `nord`, `catppuccin`, `catppuccin-frappe`, `catppuccin-macchiato`, `rose-pine`, `rose-pine-moon`, `gruvbox`, `gruvbox-material`, `tokyo-night`, `tokyo-storm`, `tokyo-moon`, `one`, `material`, `material-ocean`, `night-owl`, `synthwave`, `ayu`, `everforest`, `kanagawa`, `selenized`, `vscode`, `monokai-dimmed`, `discord`, `slack`, `bonyur`, `sakura`, `bubblegum`, `candy`, `rose-gold`, `lavender`, `cyberpunk`, `sunset`, `volcano`, `amber`, `terminal`, `paper`, `ink`, `ocean`, `forest`, `mint`, `ice`, `sepia`.

High Contrast text colors target at least [7:1 contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html), with [3:1 contrast for control boundaries and focus cues](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Check contrast again when you override colors.

Legacy integrations can use `#byVIEWtheme` or a detected `code.light.css` / `code.dark.css` link. The toggle keeps its path, query, and hash and updates viewers sharing the link. Explicit container themes stay independent. Separate theme files are no longer shipped; retain your hosted legacy files to use this alternative. Standalone `.byCODEhighlight` wrappers accept the same palette.

## Checks and releases

Use Node.js 22+ and run these commands from the repository root. For playground checks, place sibling checkouts of `spa.js` at `v20.16` next to this repository.

```sh
npm --prefix .github ci --ignore-scripts --no-audit --no-fund
node .github/node_modules/playwright/cli.js install chromium
export NODE_PATH="$PWD/.github/node_modules"
node --test --test-concurrency=1 __tests__/rendering.cjs __tests__/playground.cjs
node .github/scripts/build.mjs --tag v0.0.0-local
npm --prefix .github run release:test
```

In PowerShell, replace the `export` line with `$env:NODE_PATH = "$PWD/.github/node_modules"`. [CI](.github/workflows/rendering.yml) runs Chromium, Firefox and WebKit by default. Manual runs can target one browser.

The [release workflow](.github/workflows/release.yml) tests the regular and minified ZIPs. Both contain the runtime files, README and license. The build manifest records the version and source commit. The local build writes `dist/assets/` and `dist/RELEASE_NOTES.md`. Use `--offline` for local minification. Publish by pushing a version tag matching the library’s `VERSION` (for example, `v2` for version 2).

## Related projects

[CSV.view](https://github.com/byuwur/csv.view) · [DIFF.view](https://github.com/byuwur/diff.view) · [JSON.view](https://github.com/byuwur/json.view) · [LOG.view](https://github.com/byuwur/log.view) · [MD.edit](https://github.com/byuwur/md.edit) · [MD.view](https://github.com/byuwur/md.view) · [XML.view](https://github.com/byuwur/xml.view) · [YAML.view](https://github.com/byuwur/yaml.view)

## License

MIT (c) 2026 Andres Trujillo [Mateus] byUwUr. See [LICENSE](LICENSE.md).
