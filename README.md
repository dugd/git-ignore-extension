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

The add commands are also available from the Explorer context menu.

## MVP Behavior

- Generates repository-relative ignore patterns.
- Uses forward slashes across platforms.
- Adds trailing `/` for folders.
- Prevents duplicate exact patterns.
- Warns before adding already tracked files.
- Supports basic multi-root workspaces by resolving the Git repository for the selected resource.

## Not Yet Included

- Global Git ignore support.
- `Why Is This Ignored?`
- Custom pattern input.
- Remove ignore pattern workflow.
- `git rm --cached` guided action.
