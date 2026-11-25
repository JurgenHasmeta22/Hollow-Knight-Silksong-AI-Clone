# Project conventions

## JavaScript spacing (applies to all new and edited JS)

Keep code readable by separating logical blocks with **one blank line** (never two, never trailing whitespace on the blank line):

- Between a group of variable declarations and the code that follows it (and before a declaration that follows other code).
- Before and after every `if` / `for` / `while` / `do` / `switch` / `try` block that spans more than one line.
- Before and after any other multi-line statement (multi-line call, object/array literal assignment, nested function, ...).
- Before a `return` / `throw`, unless it is the first statement in its block.
- Between statements of different kinds, e.g. `if` guards, then a loop, then assignments, then a call.

Keep together (no blank line):

- Consecutive single-line declarations (`const a = ...; const b = ...;`).
- Consecutive single-line `if` guards (`if (!x) return null;`).
- Consecutive single-line assignments or calls of the same kind.
- The first statement of a block directly under `{`, and `else` / `catch` / `finally` directly after `}`.
- `break` / `continue` after the statement they end in a `switch` case.

Example:

```js
const d = new Date(iso);

if (isNaN(d)) return '';

for (const k of keys) out[k] = d[k];

d.x = 1;
d.y = 2;

return d;
```

## Formatting

Prettier + EditorConfig are the source of truth (`.prettierrc`, `.editorconfig`): 4 spaces, single quotes, 120 columns, LF.
Run Prettier after editing; it keeps the blank lines described above.
