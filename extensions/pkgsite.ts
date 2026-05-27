/**
 * go_pkgsite — Query the official pkg.go.dev API (v1beta)
 *
 * Provides programmatic access to Go package/module metadata:
 *   - Package info, documentation, imports
 *   - Module info with README and licenses
 *   - Module versions (tagged + pseudo-versions)
 *   - Package symbols (types, funcs, methods)
 *   - Package search
 *   - Imported-by (reverse dependencies)
 *   - Known vulnerabilities
 *   - Module packages listing
 *
 * API docs: https://pkg.go.dev/api
 * OpenAPI spec: https://pkg.go.dev/v1beta/openapi.yaml
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";

const BASE_URL = "https://pkg.go.dev/v1beta";

type PkgsiteAction =
	| "package"
	| "module"
	| "versions"
	| "packages"
	| "search"
	| "symbols"
	| "imported_by"
	| "vulns";

interface PkgsiteDetails {
	action: PkgsiteAction;
	path?: string;
	query?: string;
	version?: string;
	itemCount: number;
	error?: string;
}

async function pkgsiteFetch(url: string, signal?: AbortSignal): Promise<any> {
	const resp = await fetch(url, {
		signal,
		headers: { Accept: "application/json" },
	});
	if (!resp.ok) {
		const body = await resp.text().catch(() => "");
		let parsed: any;
		try {
			parsed = JSON.parse(body);
		} catch {
			/* not JSON */
		}
		const msg = parsed?.message || `HTTP ${resp.status}: ${body.slice(0, 200)}`;
		throw new Error(msg);
	}
	return resp.json();
}

function buildUrl(endpoint: string, path: string | undefined, params: Record<string, string | number | boolean | undefined>): string {
	const base = path ? `${BASE_URL}/${endpoint}/${encodeURI(path)}` : `${BASE_URL}/${endpoint}`;
	const qs = Object.entries(params)
		.filter(([, v]) => v !== undefined && v !== "")
		.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
		.join("&");
	return qs ? `${base}?${qs}` : base;
}

// ── Formatters ────────────────────────────────────────────

function fmtPackage(data: any): string {
	let out = `## Package: ${data.path || data.packagePath || "unknown"}\n\n`;
	out += `- **Module:** ${data.modulePath || "—"}\n`;
	out += `- **Version:** ${data.version || "—"}${data.isLatest ? " (latest)" : ""}\n`;
	out += `- **Name:** ${data.name || "—"}\n`;
	if (data.synopsis) out += `- **Synopsis:** ${data.synopsis}\n`;
	out += `- **Std lib:** ${data.isStandardLibrary ? "yes" : "no"}\n`;
	out += `- **Redistributable:** ${data.isRedistributable ? "yes" : "no"}\n`;
	if (data.goos && data.goos !== "all") out += `- **GOOS:** ${data.goos}\n`;
	if (data.goarch && data.goarch !== "all") out += `- **GOARCH:** ${data.goarch}\n`;
	if (data.imports?.length) {
		out += `\n### Imports (${data.imports.length})\n`;
		for (const imp of data.imports) out += `- ${imp}\n`;
	}
	if (data.docs) {
		out += `\n### Documentation\n\n${data.docs}\n`;
	}
	return out;
}

function fmtModule(data: any): string {
	let out = `## Module: ${data.path || "unknown"}\n\n`;
	out += `- **Version:** ${data.version || "—"}${data.isLatest ? " (latest)" : ""}\n`;
	if (data.repoUrl) out += `- **Repository:** ${data.repoUrl}\n`;
	out += `- **Has go.mod:** ${data.hasGoMod ? "yes" : "no"}\n`;
	out += `- **Redistributable:** ${data.isRedistributable ? "yes" : "no"}\n`;
	out += `- **Std lib:** ${data.isStandardLibrary ? "yes" : "no"}\n`;
	if (data.commitTime) out += `- **Commit time:** ${data.commitTime}\n`;
	if (data.licenses?.length) {
		out += `\n### Licenses\n`;
		for (const lic of data.licenses) {
			out += `- ${lic.types?.join(", ") || "unknown"} (${lic.filePath || "—"})\n`;
		}
	}
	if (data.readme?.contents) {
		out += `\n### README\n\n${data.readme.contents}\n`;
	}
	return out;
}

function fmtVersions(data: any, modulePath: string): string {
	const items = data?.items || [];
	let out = `## Versions: ${modulePath}\n\n`;
	if (data.total !== undefined) out += `Total: ${data.total}\n\n`;
	if (!items.length) return out + "No versions found.\n";
	for (const v of items) {
		let line = `- **${v.version || v}**`;
		if (v.deprecated) line += ` ⚠️ DEPRECATED${v.deprecationReason ? ": " + v.deprecationReason : ""}`;
		if (v.retracted) line += ` 🚫 RETRACTED${v.retractionReason ? ": " + v.retractionReason : ""}`;
		if (v.latestVersion && v.version !== v.latestVersion) line += ` (latest: ${v.latestVersion})`;
		out += line + "\n";
	}
	if (data.nextPageToken) out += `\n_More available — use token: ${data.nextPageToken}_\n`;
	return out;
}

function fmtPackages(data: any): string {
	let out = `## Packages in module: ${data.modulePath || "unknown"}\n\n`;
	out += `- **Version:** ${data.version || "—"}\n`;
	out += `- **Std lib:** ${data.isStandardLibrary ? "yes" : "no"}\n\n`;
	const pkgs = data.packages?.items || [];
	if (data.packages?.total !== undefined) out += `Total: ${data.packages.total}\n\n`;
	if (!pkgs.length) return out + "No packages found.\n";
	for (const p of pkgs) {
		out += `- **${p.path || p.packagePath || "?"}** — ${p.synopsis || p.name || "—"}\n`;
	}
	if (data.packages?.nextPageToken) out += `\n_More available — use token: ${data.packages.nextPageToken}_\n`;
	return out;
}

function fmtSearch(data: any, query: string): string {
	const items = data?.items || [];
	let out = `## Search: "${query}"\n\n`;
	if (data.total !== undefined) out += `Total: ${data.total}\n\n`;
	if (!items.length) return out + "No results.\n";
	for (const r of items) {
		out += `### ${r.packagePath || r.modulePath || "?"}\n`;
		out += `- Module: ${r.modulePath || "—"} @ ${r.version || "—"}\n`;
		if (r.synopsis) out += `- ${r.synopsis}\n`;
		out += "\n";
	}
	if (data.nextPageToken) out += `_More available — use token: ${data.nextPageToken}_\n`;
	return out;
}

function fmtSymbols(data: any): string {
	let out = `## Symbols: ${data.modulePath || "unknown"} @ ${data.version || "—"}\n\n`;
	const syms = data.symbols?.items || [];
	if (data.symbols?.total !== undefined) out += `Total: ${data.symbols.total}\n\n`;
	if (!syms.length) return out + "No symbols found.\n";
	// Group by kind
	const grouped: Record<string, any[]> = {};
	for (const s of syms) {
		const kind = s.kind || "other";
		(grouped[kind] ??= []).push(s);
	}
	for (const [kind, symbols] of Object.entries(grouped)) {
		out += `### ${kind} (${symbols.length})\n`;
		for (const s of symbols) {
			let line = `- \`${s.name}\``;
			if (s.parent && s.parent !== s.name) line += ` (on ${s.parent})`;
			if (s.synopsis) line += ` — ${s.synopsis}`;
			out += line + "\n";
		}
		out += "\n";
	}
	if (data.symbols?.nextPageToken) out += `_More available — use token: ${data.symbols.nextPageToken}_\n`;
	return out;
}

function fmtImportedBy(data: any): string {
	let out = `## Imported by: ${data.modulePath || "unknown"} @ ${data.version || "—"}\n\n`;
	const items = data.importedBy?.items || [];
	if (data.importedBy?.total !== undefined) out += `Total: ${data.importedBy.total}\n\n`;
	if (!items.length) return out + "No importers found.\n";
	for (const item of items) {
		out += `- ${typeof item === "string" ? item : item.path || item.packagePath || JSON.stringify(item)}\n`;
	}
	if (data.importedBy?.nextPageToken) out += `\n_More available — use token: ${data.importedBy.nextPageToken}_\n`;
	return out;
}

function fmtVulns(data: any, path: string): string {
	const items = data?.items || [];
	let out = `## Vulnerabilities: ${path}\n\n`;
	if (data.total !== undefined) out += `Total: ${data.total}\n\n`;
	if (!items.length) return out + "✅ No known vulnerabilities.\n";
	for (const v of items) {
		out += `### ${v.id || "?"}\n`;
		if (v.summary) out += `**Summary:** ${v.summary}\n`;
		if (v.details) out += `${v.details}\n`;
		if (v.fixedVersion) out += `**Fixed in:** ${v.fixedVersion}\n`;
		out += "\n";
	}
	if (data.nextPageToken) out += `_More available — use token: ${data.nextPageToken}_\n`;
	return out;
}

// ── Tool registration ────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "go_pkgsite",
		label: "Go Pkgsite",
		description:
			"Query the official pkg.go.dev API (v1beta). " +
			"Look up Go package info, module metadata, versions, symbols, " +
			"search packages, check reverse dependencies, and scan for known vulnerabilities. " +
			"Use this when you need Go ecosystem data — package docs, available versions, " +
			"vulnerability checks, or to discover packages.",
		promptSnippet: "Query pkg.go.dev for Go package/module metadata",
		promptGuidelines: [
			"Use go_pkgsite to look up Go packages, modules, versions, symbols, or vulnerabilities.",
			"During go_review, use go_pkgsite with action='vulns' to check if imported packages have known vulnerabilities.",
			"Use action='package' with doc='md' to get full package documentation.",
			"Use action='symbols' to see what a package exports — useful when reviewing API usage.",
			"Use action='versions' to check if a dependency is outdated or has retracted versions.",
			"Use action='search' to find packages by keyword when the exact import path is unknown.",
		],
		parameters: Type.Object({
			action: StringEnum(
				["package", "module", "versions", "packages", "search", "symbols", "imported_by", "vulns"] as const,
				{
					description:
						"API action: package=pkg info, module=module info, versions=list versions, " +
						"packages=module's packages, search=find packages, symbols=list exported symbols, " +
						"imported_by=reverse deps, vulns=known vulnerabilities",
				}
			),
			path: Type.Optional(
				Type.String({
					description:
						"Package or module path (e.g. 'github.com/google/go-cmp/cmp'). " +
						"Required for all actions except search.",
				})
			),
			query: Type.Optional(
				Type.String({
					description: "Search query (required for search action).",
				})
			),
			version: Type.Optional(
				Type.String({
					description:
						"Module version: semver (v1.2.3), 'master', 'main', or omit for latest.",
				})
			),
			module: Type.Optional(
				Type.String({
					description:
						"Explicit module path when package path is ambiguous (e.g. package exists in multiple modules).",
				})
			),
			doc: Type.Optional(
				Type.String({
					description:
						"Documentation format for package action: 'text', 'html', 'md'/'markdown'. Omit to skip docs.",
				})
			),
			imports: Type.Optional(
				Type.Boolean({
					description: "Include imported packages (for package action).",
				})
			),
			limit: Type.Optional(
				Type.Number({
					description: "Max items to return (for paginated endpoints).",
				})
			),
			token: Type.Optional(
				Type.String({
					description: "Pagination token from a previous response's nextPageToken.",
				})
			),
			filter: Type.Optional(
				Type.String({
					description: "Regex filter applied to results (supported by most list endpoints).",
				})
			),
		}),
		async execute(_toolCallId, params, signal) {
			const { action, path, query, version, module: modulePath, doc, imports, limit, token, filter } = params;

			// Validate required params
			if (action === "search" && !query) {
				throw new Error("query is required for search action");
			}
			if (action !== "search" && !path) {
				throw new Error("path is required for " + action + " action");
			}

			let url: string;
			let data: any;
			let text: string;
			let itemCount = 0;

			switch (action) {
				case "package": {
					url = buildUrl("package", path!, {
						version,
						module: modulePath,
						doc,
						imports: imports ? "true" : undefined,
					});
					data = await pkgsiteFetch(url, signal);
					text = fmtPackage(data);
					itemCount = 1;
					break;
				}
				case "module": {
					url = buildUrl("module", path!, { version, readme: "true", licenses: "true" });
					data = await pkgsiteFetch(url, signal);
					text = fmtModule(data);
					itemCount = 1;
					break;
				}
				case "versions": {
					url = buildUrl("versions", path!, { limit, token, filter });
					data = await pkgsiteFetch(url, signal);
					text = fmtVersions(data, path!);
					itemCount = data?.items?.length || 0;
					break;
				}
				case "packages": {
					url = buildUrl("packages", path!, { version, limit, token, filter });
					data = await pkgsiteFetch(url, signal);
					text = fmtPackages(data);
					itemCount = data?.packages?.items?.length || 0;
					break;
				}
				case "search": {
					url = buildUrl("search", undefined, { q: query!, limit, token, filter });
					data = await pkgsiteFetch(url, signal);
					text = fmtSearch(data, query!);
					itemCount = data?.items?.length || 0;
					break;
				}
				case "symbols": {
					url = buildUrl("symbols", path!, { version, module: modulePath, limit, token, filter });
					data = await pkgsiteFetch(url, signal);
					text = fmtSymbols(data);
					itemCount = data?.symbols?.items?.length || 0;
					break;
				}
				case "imported_by": {
					url = buildUrl("imported-by", path!, { version, module: modulePath, limit, token, filter });
					data = await pkgsiteFetch(url, signal);
					text = fmtImportedBy(data);
					itemCount = data?.importedBy?.items?.length || 0;
					break;
				}
				case "vulns": {
					url = buildUrl("vulns", path!, { version, module: modulePath, limit, token, filter });
					data = await pkgsiteFetch(url, signal);
					text = fmtVulns(data, path!);
					itemCount = data?.items?.length || 0;
					break;
				}
			}

			return {
				content: [{ type: "text" as const, text: text! }],
				details: {
					action,
					path,
					query,
					version,
					itemCount,
				} as PkgsiteDetails,
			};
		},
		renderCall(args, theme) {
			const actionColors: Record<string, string> = {
				package: "accent",
				module: "accent",
				versions: "success",
				packages: "success",
				search: "warning",
				symbols: "accent",
				imported_by: "success",
				vulns: "error",
			};
			let label = theme.fg("toolTitle", theme.bold("go_pkgsite "));
			label += theme.fg(actionColors[args.action] || "accent", args.action);
			if (args.path) label += theme.fg("muted", " " + args.path);
			if (args.query) label += theme.fg("muted", ' "' + args.query + '"');
			if (args.version) label += theme.fg("dim", " @" + args.version);
			label += theme.fg("dim", "  (pkg.go.dev)");
			return new Text(label, 0, 0);
		},
		renderResult(result, { isPartial }, theme) {
			if (isPartial) return new Text(theme.fg("warning", "Querying pkg.go.dev..."), 0, 0);
			const details = result.details as PkgsiteDetails | undefined;
			if (!details) return new Text(theme.fg("dim", "No result"), 0, 0);

			if (details.error) return new Text(theme.fg("error", "Error: " + details.error), 0, 0);

			const actionIcons: Record<string, string> = {
				package: "📦",
				module: "📦",
				versions: "🏷️",
				packages: "📚",
				search: "🔍",
				symbols: "🔣",
				imported_by: "⬅️",
				vulns: "🛡️",
			};
			const icon = actionIcons[details.action] || "📦";
			let summary = `${icon} ${details.action}`;
			if (details.path) summary += ` ${details.path}`;
			if (details.query) summary += ` "${details.query}"`;
			if (details.version) summary += ` @${details.version}`;
			summary += theme.fg("dim", ` — ${details.itemCount} item(s)`);

			return new Text(summary, 0, 0);
		},
	});
}
