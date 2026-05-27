# pi-go-review

> Review Go code changes against the **100 Go Mistakes** checklist — [100go.co](https://100go.co/)

A [Pi](https://github.com/mariozechner/pi) extension that registers a `go_review` tool. It reads git diffs, filters to `.go` files, and provides the complete 101-mistake rubric for the LLM to analyze your code.

## Install

```bash
pi install npm:pi-go-review
```

## Usage

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

## What it does

1. Reads the git diff filtered to `*.go` files
2. Attaches the full **100 Go Mistakes** checklist (101 entries across 11 categories)
3. The LLM produces a structured review with categorized findings:
   - 🔴 **Bug / Critical** — Must fix
   - 🟡 **Suggestion** — Should consider
   - 🔵 **Nit** — Minor improvement
   - ✅ **Good pattern** — Well done
4. Each finding cites the mistake number (e.g. **#39**) and the specific file + code fragment
5. Ends with a **Verdict**: Approve / Request Changes / Needs Discussion

## Categories covered

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

## Custom TUI rendering

The extension includes custom rendering for both the tool call and result in Pi's TUI — showing mode, file count, insertions/deletions, and truncation status at a glance.

## Credits

Based on [100 Go Mistakes and How to Avoid Them](https://100go.co/) by [Teivah](https://github.com/teivah).

## License

MIT
