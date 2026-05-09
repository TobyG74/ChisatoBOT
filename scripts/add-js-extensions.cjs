const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
let fixedCount = 0;

function resolveImport(fileDir, importPath) {
    const resolved = path.resolve(fileDir, importPath);

    if (fs.existsSync(resolved + ".js")) {
        return importPath + ".js";
    }

    const indexJs = path.join(resolved, "index.js");
    if (fs.existsSync(indexJs)) {
        return importPath + "/index.js";
    }

    return null;
}

function fixImportPath(fileDir, match, prefix, importPath, suffix) {
    if (importPath.endsWith(".js") || importPath.endsWith(".mjs") || importPath.endsWith(".cjs") || importPath.endsWith(".json")) {
        return match;
    }
    const resolved = resolveImport(fileDir, importPath);
    if (resolved) {
        return prefix + resolved + suffix;
    }
    return match;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, "utf8");
    const original = content;
    const fileDir = path.dirname(filePath);

    content = content.replace(
        /(from\s+['"])(\.\.?[^'"]*?)(['"])/g,
        (m, p, i, s) => fixImportPath(fileDir, m, p, i, s)
    );

    content = content.replace(
        /(import\s+['"])(\.\.?[^'"]*?)(['"])/g,
        (m, p, i, s) => fixImportPath(fileDir, m, p, i, s)
    );

    content = content.replace(
        /(export\s+\*\s+from\s+['"])(\.\.?[^'"]*?)(['"])/g,
        (m, p, i, s) => fixImportPath(fileDir, m, p, i, s)
    );

    content = content.replace(
        /(export\s+\{[^}]*\}\s*from\s+['"])(\.\.?[^'"]*?)(['"])/g,
        (m, p, i, s) => fixImportPath(fileDir, m, p, i, s)
    );

    content = content.replace(
        /(import\s*\(\s*['"])(\.\.?[^'"]*?)(['"]\s*\))/g,
        (m, p, i, s) => fixImportPath(fileDir, m, p, i, s)
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content, "utf8");
        fixedCount++;
    }
}

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else if (entry.name.endsWith(".js")) {
            processFile(fullPath);
        }
    }
}

walk(distDir);
console.log(`Fixed ${fixedCount} files`);
