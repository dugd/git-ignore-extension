# Git Ignore Manager

Manage Git ignore rules from VS Code.

This extension focuses on the two ignore targets needed for the first MVP:

- `.gitignore` for project rules shared with the repository.
- `.git/info/exclude` for local-only rules that should not be committed.

## Commands

- `Git Ignore Manager: Add to .gitignore`
- `Git Ignore Manager: Add to .git/info/exclude`
- `Git Ignore Manager: Open .gitignore`
- `Git Ignore Manager: Open .git/info/exclude`
- `Git Ignore Manager: Why Is This Ignored?`

The add and explanation commands are also available from the Explorer context menu.

## MVP Behavior

- Generates repository-relative ignore patterns.
- Uses forward slashes across platforms.
- Adds trailing `/` for folders.
- Prevents duplicate exact patterns.
- Warns before adding already tracked files and can untrack them with explicit confirmation.
- Supports basic multi-root workspaces by resolving the Git repository for the selected resource.
- Explains ignored files using Git's native `git check-ignore -v` output.

## Not Yet Included

- Global Git ignore support.
- Custom pattern input.
- Remove ignore pattern workflow.
