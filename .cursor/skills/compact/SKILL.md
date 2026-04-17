---
name: compact
description: >-
  Produces a dense handoff summary of the current chat thread for context limits
  or a new agent. Use when the user invokes /compact, asks to compact, summarize
  the thread for handoff, shrink context, or prepare a continuation prompt.
---

# Compact (thread handoff)

## When to apply

- User says **`/compact`**, **compact this thread**, **summarize for handoff**, **context for the next agent**, or similar.
- Goal: one readable artifact that preserves **decisions**, **scope**, **what shipped**, and **what is left** without replaying the whole chat.

## Instructions

1. **Do not** re-run tools or re-implement work unless the user explicitly asks in the same message.
2. Read the **full conversation arc** (not only the last user line). Infer the underlying goal and constraints from earlier turns.
3. Output **only** the compact handoff block below (no preamble like “Here is a summary”). If something is unknown, write **Unknown** or omit the subsection.
4. Use **complete sentences** in bullets where it helps clarity; avoid filler.
5. Prefer **paths** (`app/api/...`, `lib/...`) and **identifiers** (migration filenames, enum values) over vague references.
6. If the task was **cancelled** or **blocked**, state that and list the **blocker** explicitly.
7. **Do not** paste secrets, tokens, or full env values.

## Output template

Use this structure (markdown). Adjust headings only if a section truly does not apply.

```markdown
## Conversation summary (for handoff)

### Goal
[One or two sentences: what the user wanted to achieve.]

### Decisions / constraints
- [Policy, stack, or product choices that matter for the next turn.]

### Done (delivered in thread)
- [Files, APIs, migrations, UI — concrete.]
- …

### Status / errors
- [Build/test failures, unresolved bugs, or “clean”.]

### Remaining work
- [Numbered or bulleted next steps. If none: **None — task complete.**]

### Notes for the next assistant
- [Optional: repo-specific reminders, SSOT docs, flags, or “do not touch X”.]
```

## Examples

**Example trigger:** “/compact” after a long implementation thread.

**Good:** Fills every subsection with repo paths and migration names.

**Bad:** A generic paragraph with no file paths, no “remaining work,” or repeating the entire code diff.

## Anti-patterns

- Dumping large code blocks into the summary (cite paths instead).
- Claiming “task complete” when the user only asked a question and no implementation was requested.
- Inventing file names or behaviors not present in the conversation.
