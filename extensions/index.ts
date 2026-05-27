/**
 * pi-go-review — Code review powered by "100 Go Mistakes and How to Avoid Them"
 *
 * Registers a go_review tool that reads Go code changes (git diff) and returns
 * them alongside the complete 100 Go Mistakes checklist from https://100go.co/
 * The LLM reviews the diff against all 100 mistakes, producing categorized suggestions.
 *
 * Features:
 *   - Reviews staged, unstaged, commit, or range diffs filtered to .go files
 *   - Embeds ALL 100 Go mistakes as the review rubric (11 categories)
 *   - Categorizes findings: Bug/Critical, Suggestion, Nit, Good pattern
 *   - Custom TUI rendering for call + result
 *   - System prompt injection so the agent auto-invokes when reviewing Go code
 *   - Companion go_pkgsite tool (pkgsite.ts) for live pkg.go.dev lookups
 *
 * Based on: "100 Go Mistakes and How to Avoid Them" — https://100go.co/
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import { Text } from "@mariozechner/pi-tui";

const GO_MISTAKES = [
"## 100 Go Mistakes Review Checklist (https://100go.co/)",
"### Code and Project Organization",
"#1 Unintended variable shadowing — Redeclaring in inner block silently references wrong var. Use govet -shadow.",
"#2 Unnecessary nested code — Happy path left-aligned. If returns, omit else. Return early.",
"#3 Misusing init functions — Limits error handling, complicates testing. Use explicit init functions.",
"#4 Overusing getters/setters — Not idiomatic Go. Use only when adding value.",
"#5 Interface pollution — Discover abstractions, do not create them prematurely.",
"#6 Interface on producer side — Keep interfaces on consumer side.",
"#7 Returning interfaces — Return concrete types. Accept interfaces, return structs.",
"#8 any says nothing — Only use any when genuinely needed. Kills type safety.",
"#9 Confused about generics — Use only for concrete needs. Premature generics add complexity.",
"#10 Type embedding problems — Promotes fields/methods. Can expose hidden behaviors.",
"#11 Not using functional options — type Option func(*options) error for optional config.",
"#12 Project misorganization — Follow go.dev/doc/modules/layout. Be consistent.",
"#13 Creating utility packages — Name packages after what they provide, not contain.",
"#14 Package name collisions — Avoid variable-package name collisions. Use import aliases.",
"#15 Missing code documentation — Document every exported element starting with its name.",
"#16 Not using linters — govet, errcheck, golangci-lint, gofmt. Automate in CI.",
"### Data Types",
"#17 Octal literal confusion — Prefix with 0o. Bare 0-prefix is octal.",
"#18 Neglecting integer overflows — Silent at runtime. Implement overflow checks.",
"#19 Not understanding floating-points — Approximate. Compare within delta. Order operations.",
"#20 Slice length vs capacity — Length = elements; Capacity = backing array.",
"#21 Inefficient slice initialization — make([]T, len) or make([]T, 0, cap) when known.",
"#22 nil vs empty slice — Different things. encoding/json and reflect distinguish them.",
"#23 Checking slice emptiness — len(s)==0, not s==nil. Works for nil and empty.",
"#24 Slice copy mistakes — copy() uses min(len(dst),len(src)). Dst needs length.",
"#25 Slice append side effects — Sub-slice with capacity: append mutates original. Use s[l:h:m].",
"#26 Slices and memory leaks — Slicing keeps backing array. copy() to release.",
"#27 Inefficient map initialization — make(map[K]V, size) when count known.",
"#28 Maps and memory leaks — Maps never shrink. Recreate or use pointers.",
"#29 Comparing values incorrectly — == only for comparable. reflect.DeepEqual for complex.",
"### Control Structures",
"#30 Range copies elements — Value is copy. Access via index to mutate.",
"#31 Range expression evaluated once — Copied before loop. Changes not reflected.",
"#32 Range loop pointer issue (Go<1.22) — Loop var reuse. Fixed in Go 1.22+.",
"#33 Map iteration assumptions — No order, non-deterministic, additions may not appear.",
"#34 Break terminates wrong statement — Hits innermost for/switch/select. Use labeled break.",
"#35 Defer inside loop — Runs on function return. Extract to function for per-iteration.",
"### Strings",
"#36 Rune concept — Unicode code point 1-4 bytes. len()=bytes not runes.",
"#37 Inaccurate string iteration — range by byte pos. s[i]=byte. Use range value.",
"#38 Misusing trim — TrimRight/Left=rune set. TrimSuffix/Prefix=exact string.",
"#39 Under-optimized concatenation — strings.Builder in loops, not +=. Grow(n).",
"#40 Useless string conversions — bytes pkg mirrors strings. Use []byte for I/O.",
"#41 Substring memory leaks — Share backing array. strings.Clone() or copy.",
"### Functions and Methods",
"#42 Wrong receiver type — Pointer: mutating/large. Value: immutable/small. Default pointer.",
"#43 Named result parameters — Readability for same-type. Zero-initialized.",
"#44 Named result side effects — Zero-init error returned as nil. Subtle bug.",
"#45 Returning nil receiver — Typed nil ptr is non-nil interface. Return explicit nil.",
"#46 Filename as function input — Accept io.Reader for reusability/testability.",
"#47 Defer argument evaluation — Evaluated immediately. Use pointer/closure.",
"### Error Management",
"#48 Panicking — Only unrecoverable. Return errors for everything else.",
"#49 When to wrap errors — %w for context+unwrap. %v to prevent dependency.",
"#50 Error type comparison — errors.As not type assertion with wrapped errors.",
"#51 Error value comparison — errors.Is not == with wrapped sentinel errors.",
"#52 Handling error twice — Log OR return, not both. Use %w wrapping.",
"#53 Not handling errors — _ = fn() to explicitly ignore.",
"#54 Defer errors — Do not ignore. Propagate or _ = with comment.",
"### Concurrency: Foundations",
"#55 Concurrency vs parallelism — Structure vs execution. Concurrency enables parallelism.",
"#56 Not always faster — Overhead. Benchmark to validate.",
"#57 Channels vs mutexes — Parallel=mutexes. Concurrent=channels.",
"#58 Race problems — Data race: simultaneous write. Race condition: timing. Different.",
"#59 Workload type — CPU-bound: ~GOMAXPROCS. I/O-bound: external dependent.",
"#60 Go contexts — Deadlines, cancellation, key-values. Accept in blocking funcs.",
"### Concurrency: Practice",
"#61 Inappropriate context — HTTP ctx cancels on response. Use WithoutCancel for bg.",
"#62 Goroutine without stop plan — Every goroutine needs shutdown. context/close/defer.",
"#63 Goroutines+loop vars (Go<1.22) — Vars reused. Pass as args. Fixed 1.22+.",
"#64 Non-deterministic select — Multiple ready: random pick. No order guarantee.",
"#65 Notification channels — chan struct{} for signals. Zero-size.",
"#66 Nil channels — Block forever. Remove select cases dynamically.",
"#67 Channel size — Unbuffered=sync. Default to 1. Queues rarely balanced.",
"#68 String formatting deadlocks — fmt calls String() may acquire locks.",
"#69 Data races with append — Shared slice+capacity: race. Copy or separate.",
"#70 Mutex with slices/maps — Assignment copies header not data. Deep-copy.",
"#71 WaitGroup misuse — Add() before spawn, not inside goroutine.",
"#72 Forgetting sync.Cond — Broadcast signaling to multiple goroutines.",
"#73 Not using errgroup — Goroutine groups with error handling.",
"#74 Copying sync types — Never copy after use. Pointer. go vet.",
"### Standard Library",
"#75 Wrong time duration — time.NewTicker(1000)=1000ns. Use time.Second.",
"#76 time.After leaks — New timer each call. Use NewTimer+Reset in loops.",
"#77 JSON mistakes — Embedded fields, time format, float64 numbers.",
"#78 SQL mistakes — Placeholders, close Rows, pool config, context.",
"#79 Not closing resources — HTTP bodies, sql.Rows, os.File. defer.",
"#80 Missing return after HTTP reply — Handler continues. Return after write.",
"#81 Default HTTP client — No timeout=hangs. Configure all timeouts.",
"### Testing",
"#82 Not categorizing tests — Build tags, env vars, testing.Short().",
"#83 Not enabling -race — Always in CI. Catches data races.",
"#84 Not using parallel/shuffle — t.Parallel(), -shuffle. Quality+speed.",
"#85 Not using table-driven tests — Struct with inputs/expected. Easy to add.",
"#86 Sleeping in tests — Slow/flaky. Use channels, sync, polling.",
"#87 Time API in tests — Abstract behind interface. Inject clock.",
"#88 Not using httptest/iotest — httptest.NewServer, iotest.ErrReader.",
"#89 Inaccurate benchmarks — ResetTimer, prevent elimination, RunParallel.",
"#90 Not exploring testing features — Helper, Cleanup, testdata, TempDir.",
"#91 Not using fuzzing — Go 1.18+ native. Discovers edge cases.",
"### Optimizations",
"#92 CPU cache ignorance — Data locality. Structs-of-arrays.",
"#93 False sharing — Adjacent writes same cache line. Pad 64 bytes.",
"#94 Instruction-level parallelism — Enable ILP. Avoid data dependencies.",
"#95 Data alignment — Largest fields first. Minimize padding.",
"#96 Stack vs heap — Stack fast. Escape analysis. Minimize pointer indirection.",
"#97 Reducing allocations — sync.Pool, preallocate, value types.",
"#98 Inlining — Small funcs inlined. Keep hot functions small.",
"#99 Diagnostics tooling — pprof, tracer, benchmarks. Profile first.",
"#100 GC understanding — Concurrent mark-sweep. GOGC. Reduce allocations.",
"#101 Go in Docker/K8s — GOMAXPROCS=host CPUs. Use automaxprocs.",
].join("\n");

interface GoReviewDetails {
	mode: string;
	ref?: string;
	path?: string;
	filesChanged: number;
	insertions: number;
	deletions: number;
	goFilesFound: number;
	truncated: boolean;
	projectGoVersion?: string;
	latestGoVersion?: string;
}

async function fetchLatestGoVersion(signal?: AbortSignal): Promise<string | undefined> {
	try {
		const resp = await fetch("https://go.dev/dl/?mode=json", {
			signal,
			headers: { Accept: "application/json" },
		});
		if (!resp.ok) return undefined;
		const releases: any[] = await resp.json();
		const stable = releases.find((r) => r.stable);
		if (!stable?.version) return undefined;
		// "go1.24.3" -> "1.24.3"
		return stable.version.replace(/^go/, "");
	} catch {
		return undefined;
	}
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "go_review",
		label: "Go Review",
		description:
			"Review Go code changes against the 100 Go Mistakes checklist by Teivah. " +
			"Reads git diffs (staged, unstaged, commits, or ranges), filters to .go files, " +
			"and returns the diff alongside the complete 100-mistake rubric for analysis. " +
			"Use this whenever reviewing Go code, PRs, or changes before committing.",
		promptSnippet: "Review Go code changes using the 100 Go Mistakes checklist",
		promptGuidelines: [
			"Use go_review when the user asks to review Go code, check Go changes, or audit a Go PR.",
			"After receiving the diff and checklist, analyze every changed file against relevant mistakes.",
			"Categorize each finding: Bug/Critical, Suggestion, Nit, Good pattern.",
			"Always cite the mistake number (e.g. #39) and the specific file and line/code fragment.",
			"End with a verdict: Approve, Request Changes, or Needs Discussion.",
			"Check the Go version section — flag if the project's go.mod version is significantly behind the latest stable release.",
			"After reviewing, use go_pkgsite with action='vulns' to check newly added dependencies for known vulnerabilities.",
			"Use go_pkgsite with action='versions' to check if added dependencies are pinned to the latest version.",
		],
		parameters: Type.Object({
			mode: StringEnum(["working", "staged", "commit", "range", "all"] as const, {
				description: "working=unstaged, staged=cached, commit=specific SHA, range=two refs, all=HEAD diff",
			}),
			ref: Type.Optional(Type.String({ description: "Commit SHA, branch, or range (e.g. main..HEAD). Required for commit/range." })),
			path: Type.Optional(Type.String({ description: "Limit to file or directory (e.g. internal/auth)" })),
		}),
		async execute(_toolCallId, params, signal, _onUpdate, _ctx) {
			const { mode, ref, path: filePath } = params;

			// Read go.mod version + fetch latest stable in parallel
			const [goModResult, latestGoVersion] = await Promise.all([
				pi.exec("go", ["mod", "edit", "-json"], { signal, timeout: 5000 }).catch(() => null),
				fetchLatestGoVersion(signal),
			]);

			let projectGoVersion: string | undefined;
			if (goModResult?.code === 0) {
				try {
					const modJson = JSON.parse(goModResult.stdout);
					projectGoVersion = modJson.Go || modJson.Toolchain?.replace(/^go/, "");
				} catch { /* parse failed, skip */ }
			}

			const gitArgs: string[] = [];

			switch (mode) {
				case "working":
					gitArgs.push("diff", "--stat", "--patch", "--", "*.go");
					break;
				case "staged":
					gitArgs.push("diff", "--cached", "--stat", "--patch", "--", "*.go");
					break;
				case "all":
					gitArgs.push("diff", "HEAD", "--stat", "--patch", "--", "*.go");
					break;
				case "commit":
					if (!ref) throw new Error("ref required for commit mode");
					gitArgs.push("show", "--stat", "--patch", ref, "--", "*.go");
					break;
				case "range":
					if (!ref) throw new Error("ref required for range mode");
					gitArgs.push("diff", "--stat", "--patch", ref, "--", "*.go");
					break;
			}

			if (filePath) {
				gitArgs[gitArgs.length - 1] = filePath.endsWith(".go") ? filePath : filePath + "/**/*.go";
				if (!filePath.endsWith(".go")) gitArgs.push(filePath + "/*.go");
			}

			const result = await pi.exec("git", gitArgs, { signal, timeout: 30000 });
			if (result.code !== 0) throw new Error(`git failed (${result.code}): ${result.stderr}`);

			if (!result.stdout.trim()) {
				return {
					content: [{ type: "text" as const, text: "No Go file changes found. Try: staged, working, all, commit, or range." }],
					details: { mode, ref, path: filePath, filesChanged: 0, insertions: 0, deletions: 0, goFilesFound: 0, truncated: false } as GoReviewDetails,
				};
			}

			// Parse diff stats
			const statLine = result.stdout.split("\n").find((line) => /\d+ files? changed/.test(line)) || "";
			const filesChanged = parseInt((statLine.match(/(\d+) files? changed/) || [])[1] || "0");
			const insertions = parseInt((statLine.match(/(\d+) insertions?/) || [])[1] || "0");
			const deletions = parseInt((statLine.match(/(\d+) deletions?/) || [])[1] || "0");

			const goFileMatches = result.stdout.match(/^diff --git a\/.*\.go b\/.*\.go$/gm);
			const goFilesFound = goFileMatches ? goFileMatches.length : 0;

			// Truncate large diffs
			const MAX_LINES = 1500;
			const lines = result.stdout.split("\n");
			let truncated = false;
			let diffText = result.stdout;
			if (lines.length > MAX_LINES) {
				diffText = lines.slice(0, MAX_LINES).join("\n");
				truncated = true;
			}

			// Build review prompt
			let output = `## Go Code Review: ${mode}${ref ? " " + ref : ""}${filePath ? " (" + filePath + ")" : ""}\n\n`;
			output += `**${goFilesFound}** Go files, **+${insertions}** / **-${deletions}**\n\n`;

			// Go version check
			if (projectGoVersion || latestGoVersion) {
				output += `### Go Version\n\n`;
				output += `- **Project (go.mod):** ${projectGoVersion || "unknown"}\n`;
				output += `- **Latest stable:** ${latestGoVersion || "unknown"}\n`;
				if (projectGoVersion && latestGoVersion && projectGoVersion !== latestGoVersion) {
					const projParts = projectGoVersion.split(".").map(Number);
					const latestParts = latestGoVersion.split(".").map(Number);
					const projMinor = projParts[1] || 0;
					const latestMinor = latestParts[1] || 0;
					if (projMinor < latestMinor - 1) {
						output += `- \u26a0\ufe0f **Project is ${latestMinor - projMinor} minor versions behind.** Consider upgrading.\n`;
					} else if (projMinor < latestMinor || (projParts[2] || 0) < (latestParts[2] || 0)) {
						output += `- \ud83d\udca1 A newer Go version is available.\n`;
					}
				} else if (projectGoVersion && latestGoVersion && projectGoVersion === latestGoVersion) {
					output += `- \u2705 Up to date.\n`;
				}
				output += `\n`;
			}

			output += `### Diff\n\n\`\`\`diff\n${diffText}\n\`\`\`\n\n`;
			if (truncated) output += `> Truncated to ${MAX_LINES} lines. Use path param to focus.\n\n`;
			output += "---\n\n### Review Instructions\n\n";
			output += "Analyze the diff against the 100 Go Mistakes checklist below.\n";
			output += "For each issue: cite **mistake #**, **file:line/fragment**, categorize (Bug/Suggestion/Nit).\n";
			output += "Note Good patterns. End with **Verdict**: Approve / Request Changes / Needs Discussion.\n";
			output += "Only flag mistakes **actually present**. Most impactful first.\n\n";
			output += "**Also check:**\n";
			output += "- Go version in go.mod — flag if significantly behind latest stable\n";
			output += "- Use `go_pkgsite` action=`vulns` for any newly added or changed dependencies\n";
			output += "- Use `go_pkgsite` action=`versions` to verify dependency pins are current\n\n";
			output += GO_MISTAKES;

			return {
				content: [{ type: "text" as const, text: output }],
				details: { mode, ref, path: filePath, filesChanged, insertions, deletions, goFilesFound, truncated, projectGoVersion, latestGoVersion } as GoReviewDetails,
			};
		},
		renderCall(args, theme, _ctx) {
			const modeColors: Record<string, string> = {
				working: "warning",
				staged: "accent",
				commit: "success",
				range: "success",
				all: "warning",
			};
			let label = theme.fg("toolTitle", theme.bold("go_review "));
			label += theme.fg(modeColors[args.mode] || "accent", args.mode);
			if (args.ref) label += theme.fg("muted", " " + args.ref);
			if (args.path) label += theme.fg("dim", " — " + args.path);
			label += theme.fg("dim", "  (100 Go Mistakes)");
			return new Text(label, 0, 0);
		},
		renderResult(result, { expanded, isPartial }, theme, _ctx) {
			if (isPartial) return new Text(theme.fg("warning", "Scanning Go changes..."), 0, 0);
			const details = result.details as GoReviewDetails | undefined;
			if (!details || details.goFilesFound === 0) return new Text(theme.fg("dim", "No Go changes found"), 0, 0);

			let summary = theme.fg("accent", details.goFilesFound + " Go files");
			summary += theme.fg("dim", " | ") + theme.fg("success", "+" + details.insertions) + theme.fg("dim", "/") + theme.fg("error", "-" + details.deletions);
			summary += theme.fg("dim", " | ") + theme.fg("muted", "100 Go Mistakes checklist");
			if (details.projectGoVersion) {
				const goColor = details.latestGoVersion && details.projectGoVersion !== details.latestGoVersion ? "warning" : "success";
				summary += theme.fg("dim", " | go ") + theme.fg(goColor, details.projectGoVersion);
			}
			if (details.truncated) summary += theme.fg("warning", " (truncated)");

			if (expanded) {
				summary += "\n" + theme.fg("dim", "─".repeat(50));
				const content = result.content[0];
				if (content && content.type === "text") {
					const statLines = content.text.split("\n").filter((line: string) => line.includes("|") && line.includes("+")).slice(0, 8);
					for (const line of statLines) summary += "\n" + theme.fg("dim", "  " + line.trim());
					if (statLines.length === 0) summary += "\n" + theme.fg("dim", "  (expand for diff + checklist)");
				}
			}
			return new Text(summary, 0, 0);
		},
	});
}
