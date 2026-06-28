# crud_doc_diagram

Create or update an Excalidraw architecture diagram for a completed task and commit it to `docs/diagrams/`.

## Usage

```
/crud_doc_diagram [task-number] [create|update]
```

- `task-number`: the task number (e.g. `1`, `02`, `5`). If omitted, infer from the current git branch.
- `create|update`: whether to create a new diagram or update an existing one. Defaults to `create` if no file exists, `update` if one does.

---

## Instructions

### Step 1 — Determine the task

If a task number was passed as an argument, use it. Otherwise read the current git branch name (`git branch --show-current`) and extract the task number from the `task/NN-*` pattern.

Zero-pad the number to two digits (e.g. `1` → `01`). The diagram file path is:

```
docs/diagrams/task-NN-architecture.excalidraw
```

### Step 2 — Load context

Read the spec files required for this task from the Agent Context Map in `CLAUDE.md`. Also read the existing file if this is an update operation.

Scan the task branch for what was actually built:
- What files and directories were created
- What services, routes, models, or components exist
- What the data flow looks like

### Step 3 — Plan the diagram

Design an architecture diagram that shows:
- **All services / containers** introduced or relevant to this task
- **Data flow** between components (arrows with labels showing protocol/method: HTTP, asyncpg, LangChain, etc.)
- **Layered zones** grouping related components:
  - Frontend zone (blue `#dbe4ff`)
  - Backend zone (purple `#e5dbff`)
  - Data layer zone (green `#d3f9d8`)
  - Docker Compose outer boundary (orange `#ffd8a8`, opacity 25)
- **Annotations** for non-obvious details (ports, healthchecks, env-driven config)

For an **update**, load the existing `.excalidraw` file, identify what changed, and add/modify/remove only the elements that reflect the new task's additions. Preserve unchanged elements.

### Step 4 — Generate valid Excalidraw JSON

Produce a complete, valid `.excalidraw` file. Every element MUST follow the native Excalidraw JSON format — NOT the MCP `create_view` shorthand.

#### Required fields on every element

```json
{
  "type": "rectangle|text|arrow|ellipse|diamond",
  "id": "unique_string",
  "x": 0, "y": 0, "width": 200, "height": 80,
  "angle": 0,
  "strokeColor": "#1e1e1e",
  "backgroundColor": "transparent",
  "fillStyle": "solid",
  "strokeWidth": 2,
  "strokeStyle": "solid",
  "roughness": 1,
  "opacity": 100,
  "groupIds": [],
  "frameId": null,
  "isDeleted": false,
  "boundElements": [],
  "updated": 1,
  "link": null,
  "locked": false,
  "seed": 101,
  "version": 1,
  "versionNonce": 101
}
```

#### Text inside a shape (containerId pattern — REQUIRED)

Do NOT use a `label` field on shapes. Instead:

1. On the **shape**: add `"boundElements": [{"id": "txt_id", "type": "text"}]`
2. Create a **separate text element**:

```json
{
  "type": "text",
  "id": "txt_id",
  "containerId": "shape_id",
  "text": "My Label\nSecond line",
  "fontSize": 16,
  "fontFamily": 1,
  "textAlign": "center",
  "verticalAlign": "middle",
  "originalText": "My Label\nSecond line",
  "lineHeight": 1.25,
  "x": "<shape.x>",
  "y": "<shape.y + (shape.height - textHeight) / 2>",
  "width": "<shape.width>",
  "height": "<fontSize * 1.25 * numLines>"
}
```

#### Arrow bindings — use focus/gap, NOT fixedPoint

```json
{
  "type": "arrow",
  "startBinding": {"elementId": "source_id", "focus": 0, "gap": 1},
  "endBinding": {"elementId": "target_id", "focus": 0, "gap": 1},
  "startArrowhead": null,
  "endArrowhead": "arrow",
  "points": [[0, 0], [dx, dy]],
  "lastCommittedPoint": null
}
```

`focus` ranges -1 to 1 (0 = center of edge). `gap` is pixel distance from the shape edge.

Arrow labels follow the same containerId pattern — create a text element with `"containerId": "arrow_id"`.

#### Color palette

| Zone / Element | Background | Border |
|---|---|---|
| Docker Compose outer zone | `#ffd8a8` opacity 25 | `#f59e0b` |
| Frontend zone | `#dbe4ff` opacity 70 | `#4a9eed` |
| Frontend boxes | `#a5d8ff` | `#4a9eed` |
| Backend zone | `#e5dbff` opacity 70 | `#8b5cf6` |
| Backend boxes | `#d0bfff` | `#8b5cf6` |
| Data layer zone | `#d3f9d8` opacity 60 | `#22c55e` |
| Postgres | `#c3fae8` | `#22c55e` |
| Ollama | `#b2f2bb` | `#22c55e` |
| Notes / annotations | `#fff3bf` | `#f59e0b` |
| External (Browser) | `#a5d8ff` | `#4a9eed` |

#### File wrapper

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [...],
  "appState": {"viewBackgroundColor": "#ffffff", "gridSize": null},
  "files": {}
}
```

### Step 5 — Write and export

1. Write the file to `docs/diagrams/task-NN-architecture.excalidraw`
2. Call `mcp__claude_ai_Excalidraw__export_to_excalidraw` with the full JSON string to get a shareable URL
3. Add the share URL as a comment in the file (inside `appState` as `"shareUrl"`) and also mention it in the commit message

### Step 6 — Commit

Stage only the diagram file and commit on the current branch:

```
git add docs/diagrams/task-NN-architecture.excalidraw
git commit -m "Task NN: add/update architecture diagram

docs/diagrams/task-NN-architecture.excalidraw
Share: <excalidraw_url>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Quality checklist before committing

- [ ] File opens correctly on excalidraw.com (no blank canvas)
- [ ] No `label` fields on shape elements
- [ ] No `fixedPoint` in arrow bindings
- [ ] Every shape with text has a matching bound text element with `containerId`
- [ ] All element IDs are unique
- [ ] File passes JSON syntax check
- [ ] Diagram reflects what was actually built in this task, not a generic template
