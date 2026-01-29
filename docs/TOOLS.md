**Core Tools**
- `set_project`: Initialize a project for context tracking (run this first).
- `remember`: Store context (active work, constraints, problems, goals, decisions, notes, caveats).
- `recall`: Retrieve context for the current project.
- `read_file`: Read a file with rich context.
- `search`: Search for files or content.
- `structure`: Summarize project structure.
- `git`: Git status, context, hotspots, coupling, blame, analysis.
- `notion`: Read-only Notion access (`search`, `read`).

**Minimal Workflow**
```text
1) set_project({ path: "/abs/path/to/project" })
2) recall()
3) read_file({ path: "src/index.ts" })
4) remember({ type: "decision", content: "Use SQLite for local storage" })
```

**Important**
- Always call `set_project` before using other tools.

**Remember Types**
- `active_work`: Current task and context.
- `constraint`: Architectural or process rules.
- `problem`: Blockers or issues.
- `goal`: Targets or milestones.
- `decision`: Key decisions and rationale.
- `note`: General information.
- `caveat`: Mistakes, shortcuts, unverified work.

**Git Actions**
```text
git({ action: "status" })
git({ action: "context" })
git({ action: "hotspots" })
git({ action: "coupling" })
git({ action: "blame", path: "src/server.ts" })
git({ action: "analysis" })
```

**Notion Actions**
```text
notion({ action: "search", query: "architecture" })
notion({ action: "read", pageId: "..." })
```
