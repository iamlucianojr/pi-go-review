# pi-go-review

> Review Go code changes against the **100 Go Mistakes** checklist — [100go.co](https://100go.co/)
> Query the **pkg.go.dev API** for package metadata, versions, symbols, and vulnerabilities.

A [Pi](https://github.com/mariozechner/pi) extension that registers two tools:

- **`go_review`** — Reads git diffs, filters to `.go` files, and provides the complete 101-mistake rubric for the LLM to analyze your code.
- **`go_pkgsite`** — Queries the official [pkg.go.dev API](https://pkg.go.dev/api) (v1beta) for Go package/module metadata, versions, symbols, vulnerability scanning, and more.

## Install

```bash
pi install npm:pi-go-review
```

## Tools

### `go_review` — Code Review

Just ask Pi: **"review my Go changes"**

The tool supports 5 diff modes:

| Mode | Description | Requires `ref` |
|------|-------------|-----------------|
| `working` | Unstaged changes | No |
| `staged` | Staged (cached) changes | No |
| `all` | All changes vs HEAD | No |
| `commit` | Specific commit | Yes (SHA) |
| `range` | Commit range | Yes (e.g. `main..HEAD`) |

You can also narrow the scope with the `path` parameter to focus on a specific file or directory.

#### What it does

1. Reads the git diff filtered to `*.go` files
2. Attaches the full **100 Go Mistakes** checklist (101 entries across 11 categories)
3. The LLM produces a structured review with categorized findings:
   - 🐛 **Bug / Critical** — Must fix
   - 💡 **Suggestion** — Should consider
   - 🔧 **Nit** — Minor improvement
   - ✅ **Good pattern** — Well done
4. Each finding cites the mistake number (e.g. **#39**) and the specific file + code fragment
5. Ends with a **Verdict**: Approve / Request Changes / Needs Discussion
6. **Automatically checks** newly added dependencies for vulnerabilities and outdated versions via `go_pkgsite`

#### Categories covered

- Code & Project Organization (#1–#16)
- Data Types (#17–#29)
- Control Structures (#30–#35)
- Strings (#36–#41)
- Functions & Methods (#42–#47)
- Error Management (#48–#54)
- Concurrency: Foundations (#55–#60)
- Concurrency: Practice (#61–#74)
- Standard Library (#75–#81)
- Testing (#82–#91)
- Optimizations (#92–#101)

### `go_pkgsite` — pkg.go.dev API

Query the official [pkg.go.dev API](https://pkg.go.dev/api) for Go ecosystem data:

| Action | Description | Requires |
|--------|-------------|----------|
| `package` | Package info, docs, imports | `path` |
| `module` | Module metadata, README, licenses | `path` |
| `versions` | List module versions (tagged + pseudo) | `path` |
| `packages` | List packages in a module | `path` |
| `search` | Search packages by keyword | `query` |
| `symbols` | List exported symbols (types, funcs) | `path` |
| `imported_by` | Reverse dependencies | `path` |
| `vulns` | Known vulnerabilities | `path` |

#### Examples

```
# Ask Pi:
"look up the go-cmp package"
"what versions does google/uuid have?"
"check vulnerabilities for golang.org/x/crypto"
"search pkgsite for uuid packages"
"what symbols does the slog package export?"
"who imports github.com/google/go-cmp/cmp?"
```

#### Parameters

| Param | Description |
|-------|-------------|
| `action` | One of: package, module, versions, packages, search, symbols, imported_by, vulns |
| `path` | Package or module path (e.g. `github.com/google/go-cmp/cmp`) |
| `query` | Search query (for search action) |
| `version` | Specific version (`v1.2.3`), `master`, `main`, or omit for latest |
| `module` | Explicit module path when package is ambiguous |
| `doc` | Docs format for package action: `text`, `html`, `md` |
| `imports` | Include imported packages (package action) |
| `limit` | Max items for paginated results |
| `token` | Pagination token from `nextPageToken` |
| `filter` | Regex filter for list endpoints |

## Custom TUI rendering

Both tools include custom rendering for call + result in Pi's TUI — showing mode, file count, insertions/deletions, action icons, and item counts at a glance.

## Credits

- **100 Go Mistakes** checklist by [Teivah](https://github.com/teivah) — [100go.co](https://100go.co/)
- **pkg.go.dev API** by the Go team — [pkg.go.dev/api](https://pkg.go.dev/api)

## License

MIT
