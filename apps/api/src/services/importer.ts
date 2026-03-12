import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import {
  normalizePageSchema,
  slugify,
  type PageDocument,
  type PageSchema,
  type PageSourceKind,
  type PageSourceReference
} from "@seo-localization/shared";
import { config } from "../config.js";
import {
  buildSchemaFromJsonDocument,
  extractJsonTextBlocks,
  parseJsonDocument
} from "./json-document.js";
import { parsePageInput } from "./parser.js";

const supportedExtensions = new Set([".md", ".markdown", ".html", ".htm", ".tsx", ".jsx", ".ts", ".js", ".json"]);
const ignoredDirectories = new Set(["node_modules", ".git", ".next", "dist", "build", "coverage"]);
const maxImportedFiles = 600;
const visiblePropertyNames = new Set([
  "title",
  "description",
  "subtitle",
  "heading",
  "label",
  "text",
  "content",
  "message",
  "placeholder",
  "helpertext",
  "helptext",
  "emptytext",
  "caption",
  "alt",
  "arialabel",
  "tooltip",
  "question",
  "answer",
  "cta",
  "buttontext",
  "confirmtext",
  "canceltext",
  "oktext",
  "successmessage",
  "errormessage"
]);
const visibleAttributeNames = new Set([
  "title",
  "placeholder",
  "aria-label",
  "label",
  "alt",
  "helpertext",
  "caption"
]);
const visibleCallNames = new Set([
  "toast",
  "alert",
  "confirm",
  "prompt",
  "notify",
  "notification",
  "message",
  "modal",
  "dialog"
]);

export interface UploadedImportFile {
  name: string;
  relativePath?: string;
  content: string;
}

export interface ImportedSourceFile {
  kind: PageSourceKind;
  label: string;
  relativePath: string;
  absolutePath?: string;
  rootPath?: string;
  repoUrl?: string;
  branch?: string;
  content: string;
}

export interface ImportScanResult {
  rootPath?: string;
  files: ImportedSourceFile[];
  skipped: Array<{ path: string; reason: string }>;
}

export interface ImportedPageDraft {
  rawContent: string;
  schema: PageSchema;
  sourceReference: PageSourceReference;
  extractedTextBlocks: string[];
  sourceDocument?: PageDocument;
}

export function scanFolderImport(folderPath: string): ImportScanResult {
  const absoluteRoot = path.resolve(folderPath.trim());
  if (!fs.existsSync(absoluteRoot)) {
    throw new Error(`Folder does not exist: ${absoluteRoot}`);
  }

  if (!fs.statSync(absoluteRoot).isDirectory()) {
    throw new Error(`Path is not a folder: ${absoluteRoot}`);
  }

  return scanTree(absoluteRoot, "folder", path.basename(absoluteRoot));
}

export function scanGitImport(input: { repoUrl: string; branch?: string }): ImportScanResult {
  const repoUrl = input.repoUrl.trim();
  if (!repoUrl) {
    throw new Error("repoUrl is required.");
  }

  const repoName = slugify(path.basename(repoUrl).replace(/\.git$/i, "")) || `repo-${randomUUID().slice(0, 8)}`;
  const targetRoot = path.join(config.dataRoot, "imports", `${repoName}-${Date.now()}`);
  fs.mkdirSync(path.dirname(targetRoot), { recursive: true });

  const args = ["clone", "--depth", "1"];
  if (input.branch?.trim()) {
    args.push("--branch", input.branch.trim());
  }
  args.push(repoUrl, targetRoot);

  const result = spawnSync("git", args, {
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || result.stdout.trim() || "git clone failed.");
  }

  const scanResult = scanTree(targetRoot, "git", repoName);
  scanResult.files = scanResult.files.map((file) => ({
    ...file,
    repoUrl,
    branch: input.branch?.trim()
  }));
  return scanResult;
}

export function prepareUploadedImport(files: UploadedImportFile[]): ImportScanResult {
  const importedFiles: ImportedSourceFile[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];

  for (const file of files.slice(0, maxImportedFiles)) {
    const relativePath = normalizeRelativePath(file.relativePath || file.name);
    const extension = path.extname(relativePath).toLowerCase();

    if (!supportedExtensions.has(extension)) {
      skipped.push({ path: relativePath, reason: "不支持的文件类型" });
      continue;
    }

    importedFiles.push({
      kind: "upload",
      label: file.name,
      relativePath,
      content: file.content
    });
  }

  return {
    files: importedFiles,
    skipped
  };
}

export function createImportedPageDraft(file: ImportedSourceFile): ImportedPageDraft | null {
  const extension = path.extname(file.relativePath).toLowerCase();
  const absolutePath = file.absolutePath ? path.resolve(file.absolutePath) : undefined;
  const sourceDocument = extension === ".json" ? parseJsonDocument(file.content) : undefined;
  const extractedTextBlocks = sourceDocument ? extractJsonTextBlocks(sourceDocument.value) : extractTextBlocks(file.content, extension);

  let schema: PageSchema | null = null;
  if (extension === ".md" || extension === ".markdown") {
    schema = parsePageInput({
      slug: slugify(path.basename(file.relativePath, extension)),
      content: file.content
    });
  } else if (extension === ".html" || extension === ".htm") {
    schema = parseHtmlPage(file.content, file.relativePath);
  } else if (sourceDocument) {
    schema = buildSchemaFromJsonDocument(file.relativePath, sourceDocument.value);
  } else if (extractedTextBlocks.length) {
    schema = buildSchemaFromCodeText(file.relativePath, extractedTextBlocks);
  }

  if (!schema) {
    return null;
  }

  return {
    rawContent: file.content,
    schema,
    extractedTextBlocks,
    sourceDocument,
    sourceReference: {
      kind: file.kind,
      label: file.label,
      rootPath: file.rootPath,
      absolutePath,
      relativePath: file.relativePath,
      repoUrl: file.repoUrl,
      branch: file.branch
    }
  };
}

function scanTree(rootPath: string, kind: PageSourceKind, label: string): ImportScanResult {
  const files: ImportedSourceFile[] = [];
  const skipped: Array<{ path: string; reason: string }> = [];
  const scanRoots = resolveScanRoots(rootPath);

  for (const scanRoot of scanRoots) {
    if (!fs.existsSync(scanRoot)) {
      continue;
    }
    walk(scanRoot, rootPath, kind, label, files, skipped);
  }

  return {
    rootPath,
    files,
    skipped
  };
}

function walk(
  currentPath: string,
  rootPath: string,
  kind: PageSourceKind,
  label: string,
  files: ImportedSourceFile[],
  skipped: Array<{ path: string; reason: string }>
): void {
  if (files.length >= maxImportedFiles) {
    return;
  }

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    if (files.length >= maxImportedFiles) {
      return;
    }

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      walk(path.join(currentPath, entry.name), rootPath, kind, label, files, skipped);
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = normalizeRelativePath(path.relative(rootPath, absolutePath));
    const extension = path.extname(entry.name).toLowerCase();

    if (!shouldScanFile(relativePath, extension)) {
      skipped.push({ path: relativePath, reason: "不支持的文件类型" });
      continue;
    }

    const content = fs.readFileSync(absolutePath, "utf8");
    files.push({
      kind,
      label,
      rootPath,
      absolutePath,
      relativePath,
      content
    });
  }
}

function resolveScanRoots(rootPath: string): string[] {
  if (isKusaPicsProject(rootPath)) {
    return [
      path.join(rootPath, "app"),
      path.join(rootPath, "components"),
      path.join(rootPath, "constants"),
      path.join(rootPath, "content"),
      path.join(rootPath, "hooks"),
      path.join(rootPath, "lib")
    ];
  }

  return [rootPath];
}

function isKusaPicsProject(rootPath: string): boolean {
  const packageJsonPath = path.join(rootPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { name?: string };
    if (packageJson.name === "kusa-pics") {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function shouldScanFile(relativePath: string, extension: string): boolean {
  if (!supportedExtensions.has(extension)) {
    return false;
  }

  const normalized = normalizeRelativePath(relativePath);

  if (normalized.startsWith("app/api/")) {
    return false;
  }

  if (normalized.startsWith("app/")) {
    return /(?:^|\/)(page|layout|template|loading|error)\.(tsx|ts|jsx|js|md|markdown)$/i.test(normalized);
  }

  if (normalized.startsWith("components/") || normalized.startsWith("constants/") || normalized.startsWith("hooks/")) {
    return /\.(tsx|ts|jsx|js|json)$/i.test(normalized);
  }

  if (normalized.startsWith("lib/")) {
    return /\.(tsx|ts|jsx|js|json)$/i.test(normalized);
  }

  if (normalized.startsWith("content/")) {
    return /\.(md|markdown|json)$/i.test(normalized);
  }

  return true;
}

function parseHtmlPage(content: string, filePath: string): PageSchema {
  const title = matchTag(content, "title") ?? humanizeFileName(filePath);
  const description = matchMetaDescription(content) ?? title;
  const h1 = matchTag(content, "h1") ?? title;
  const headings = Array.from(content.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi), (match) => cleanInlineText(match[1]));
  const paragraphs = Array.from(content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi), (match) => cleanInlineText(match[1]))
    .filter(Boolean);

  const sections = (headings.length ? headings : ["页面文案"])
    .map((heading, index) => ({
      heading,
      content: paragraphs[index] ?? paragraphs.slice(index * 2, index * 2 + 2).join(" ")
    }))
    .filter((section) => section.content.trim());

  return normalizePageSchema({
    slug: slugify(path.basename(filePath, path.extname(filePath))),
    title,
    description,
    h1,
    sections,
    faq: []
  });
}

function buildSchemaFromCodeText(filePath: string, extractedTextBlocks: string[]): PageSchema {
  const title = extractedTextBlocks[0] ?? humanizeFileName(filePath);
  const description = (extractedTextBlocks[1] ?? extractedTextBlocks[0] ?? title).slice(0, 160);
  const sections = extractedTextBlocks.slice(0, 24).map((text, index) => ({
    heading: index === 0 ? "页面标题" : `文案 ${index}`,
    content: text
  }));

  return normalizePageSchema({
    slug: slugify(path.basename(filePath, path.extname(filePath))),
    title,
    description,
    h1: title,
    sections,
    faq: []
  });
}

function extractTextBlocks(content: string, extension: string): string[] {
  if (extension === ".md" || extension === ".markdown") {
    const parsed = parsePageInput({ content });
    return flattenPageSchema(parsed);
  }

  if (extension === ".html" || extension === ".htm") {
    return extractHtmlTextBlocks(content);
  }

  if (extension === ".json") {
    const document = parseJsonDocument(content);
    return document ? extractJsonTextBlocks(document.value) : [];
  }

  return extractCodeTextBlocks(content, extension);
}

function flattenPageSchema(page: PageSchema): string[] {
  return dedupeStrings(
    [
      page.title,
      page.description,
      page.h1,
      ...page.sections.flatMap((section) => [section.heading, section.content]),
      ...page.faq.flatMap((item) => [item.question, item.answer])
    ].filter(isProbablyDisplayText)
  );
}

function matchTag(content: string, tagName: string): string | undefined {
  const match = content.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match?.[1] ? cleanInlineText(match[1]) : undefined;
}

function matchMetaDescription(content: string): string | undefined {
  const match = content.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i);
  return match?.[1] ? cleanInlineText(match[1]) : undefined;
}

function extractHtmlTextBlocks(content: string): string[] {
  return dedupeStrings(
    [
      ...(Array.from(content.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi), (match) => cleanInlineText(match[1]))),
      ...(Array.from(content.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi), (match) => cleanInlineText(match[1]))),
      ...(Array.from(content.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi), (match) => cleanInlineText(match[1]))),
      ...(Array.from(content.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi), (match) => cleanInlineText(match[1]))),
      ...(Array.from(content.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi), (match) => cleanInlineText(match[1]))),
      ...(Array.from(content.matchAll(/<label[^>]*>([\s\S]*?)<\/label>/gi), (match) => cleanInlineText(match[1]))),
      ...(Array.from(content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi), (match) => cleanInlineText(match[1]))),
      ...(Array.from(content.matchAll(/<(input|textarea)[^>]+placeholder=["']([^"']+)["']/gi), (match) => cleanInlineText(match[2]))),
      ...(Array.from(content.matchAll(/<(img|source)[^>]+alt=["']([^"']+)["']/gi), (match) => cleanInlineText(match[2]))),
      matchMetaDescription(content)
    ].filter((value): value is string => Boolean(value && isProbablyDisplayText(value)))
  ).slice(0, 120);
}

function extractCodeTextBlocks(content: string, extension: string): string[] {
  const sourceFile = ts.createSourceFile(
    `imported${extension}`,
    content,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(extension)
  );

  const collector: string[] = [];
  const scopes: Array<Map<string, ts.Expression>> = [new Map()];

  const pushString = (value: string | undefined) => {
    if (!value) {
      return;
    }

    const cleaned = cleanInlineText(value);
    if (isProbablyDisplayText(cleaned)) {
      collector.push(cleaned);
    }
  };

  const resolveIdentifier = (name: string): ts.Expression | undefined => {
    for (let index = scopes.length - 1; index >= 0; index -= 1) {
      const value = scopes[index].get(name);
      if (value) {
        return value;
      }
    }
    return undefined;
  };

  const evaluateExpression = (expression: ts.Expression, depth = 0): string[] => {
    if (depth > 4) {
      return [];
    }

    if (ts.isStringLiteralLike(expression)) {
      return [expression.text];
    }

    if (ts.isNoSubstitutionTemplateLiteral(expression)) {
      return [expression.text];
    }

    if (ts.isTemplateExpression(expression)) {
      let current = expression.head.text;
      for (const span of expression.templateSpans) {
        const resolved = evaluateExpression(span.expression, depth + 1);
        current += resolved[0] ?? "";
        current += span.literal.text;
      }
      return [current];
    }

    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      return combineValues(evaluateExpression(expression.left, depth + 1), evaluateExpression(expression.right, depth + 1));
    }

    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
      return evaluateExpression(expression.expression, depth + 1);
    }

    if (ts.isConditionalExpression(expression)) {
      return [...evaluateExpression(expression.whenTrue, depth + 1), ...evaluateExpression(expression.whenFalse, depth + 1)];
    }

    if (ts.isArrayLiteralExpression(expression)) {
      return expression.elements.flatMap((element) => (ts.isExpression(element) ? evaluateExpression(element, depth + 1) : []));
    }

    if (ts.isObjectLiteralExpression(expression)) {
      const values: string[] = [];
      for (const property of expression.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const propertyName = getPropertyName(property.name);
        const resolved = evaluateExpression(property.initializer, depth + 1);
        if (!propertyName || visiblePropertyNames.has(normalizePropertyName(propertyName))) {
          values.push(...resolved);
        }
      }
      return values;
    }

    if (ts.isIdentifier(expression)) {
      const resolved = resolveIdentifier(expression.text);
      return resolved ? evaluateExpression(resolved, depth + 1) : [];
    }

    if (ts.isCallExpression(expression)) {
      const calleeName = getCallName(expression.expression);
      if (calleeName && visibleCallNames.has(calleeName)) {
        return expression.arguments.flatMap((argument) => evaluateExpression(argument, depth + 1));
      }

      if (calleeName === "t" || calleeName === "translate") {
        return expression.arguments.slice(1).flatMap((argument) => evaluateExpression(argument, depth + 1));
      }
    }

    if (ts.isPropertyAccessExpression(expression)) {
      return [];
    }

    return [];
  };

  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) {
          scopes[scopes.length - 1].set(declaration.name.text, declaration.initializer);
        }
      }
    }

    if (ts.isFunctionLike(node)) {
      scopes.push(new Map());
      ts.forEachChild(node, visit);
      scopes.pop();
      return;
    }

    if (ts.isJsxText(node)) {
      pushString(node.getFullText(sourceFile));
    }

    if (ts.isJsxAttribute(node)) {
      const attributeName = ts.isIdentifier(node.name) ? node.name.text : node.name.name.text;
      if (!visibleAttributeNames.has(attributeName)) {
        ts.forEachChild(node, visit);
        return;
      }

      if (node.initializer && ts.isStringLiteral(node.initializer)) {
        pushString(node.initializer.text);
      } else if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        for (const value of evaluateExpression(node.initializer.expression)) {
          pushString(value);
        }
      }
    }

    if (ts.isJsxExpression(node) && node.expression) {
      for (const value of evaluateExpression(node.expression)) {
        pushString(value);
      }
    }

    if (ts.isPropertyAssignment(node)) {
      const propertyName = getPropertyName(node.name);
      if (propertyName && visiblePropertyNames.has(normalizePropertyName(propertyName))) {
        for (const value of evaluateExpression(node.initializer)) {
          pushString(value);
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const calleeName = getCallName(node.expression);
      if (calleeName && visibleCallNames.has(calleeName)) {
        for (const argument of node.arguments) {
          for (const value of evaluateExpression(argument)) {
            pushString(value);
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return dedupeStrings(collector).slice(0, 160);
}

function combineValues(leftValues: string[], rightValues: string[]): string[] {
  if (!leftValues.length) {
    return rightValues;
  }
  if (!rightValues.length) {
    return leftValues;
  }

  const combined: string[] = [];
  for (const left of leftValues) {
    for (const right of rightValues) {
      combined.push(`${left}${right}`);
    }
  }
  return combined;
}

function getScriptKind(extension: string): ts.ScriptKind {
  switch (extension) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function getPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }

  return undefined;
}

function normalizePropertyName(value?: string): string {
  return (value ?? "").replace(/[-_\s]/g, "").toLowerCase();
}

function getCallName(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) {
    return expression.text.toLowerCase();
  }

  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text.toLowerCase();
  }

  return undefined;
}

function cleanInlineText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLiteral(value: string): string {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\$\{[^}]+\}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isProbablyDisplayText(value: string): boolean {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length < 3 || cleaned.length > 220) {
    return false;
  }

  if (/^(use client|use server)$/i.test(cleaned)) {
    return false;
  }

  if (!/[A-Za-z\u4e00-\u9fff]/.test(cleaned)) {
    return false;
  }

  if (/https?:\/\//i.test(cleaned) || /[{}<>]/.test(cleaned)) {
    return false;
  }

  if (/^[./#@A-Za-z0-9_-]+$/.test(cleaned) && !/[A-Z][a-z]|[a-z][A-Z]|\s|[\u4e00-\u9fff]/.test(cleaned)) {
    return false;
  }

  return true;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function humanizeFileName(filePath: string): string {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/");
}
