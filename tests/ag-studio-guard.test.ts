import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("AG Studio Removal Guard", () => {
  it("ensures ag-studio and ag-studio-react are not in package.json dependencies", () => {
    const pkgPath = path.resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const allDeps = [...deps, ...devDeps];

    expect(allDeps).not.toContain("ag-studio");
    expect(allDeps).not.toContain("ag-studio-react");
  });

  it("ensures no source files in src/ import ag-studio or AgStudioEmbed", () => {
    const srcDir = path.resolve(process.cwd(), "src");

    function scanFiles(dir: string): string[] {
      const files: string[] = [];
      const list = fs.readdirSync(dir);
      for (const item of list) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          files.push(...scanFiles(fullPath));
        } else if (/\.(ts|tsx|js|jsx)$/.test(item)) {
          files.push(fullPath);
        }
      }
      return files;
    }

    const srcFiles = scanFiles(srcDir);
    const violatingFiles: string[] = [];

    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf-8");
      if (
        content.includes("from 'ag-studio'") ||
        content.includes('from "ag-studio"') ||
        content.includes("from 'ag-studio-react'") ||
        content.includes('from "ag-studio-react"') ||
        content.includes("AgStudioEmbed")
      ) {
        violatingFiles.push(path.relative(process.cwd(), file));
      }
    }

    expect(violatingFiles).toEqual([]);
  });
});
