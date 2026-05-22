# Git Ignore Manager

Manage project and local Git ignore rules from VS Code.

Git Ignore Manager adds Explorer context menu commands for writing repository-relative ignore patterns to `.gitignore` or `.git/info/exclude`, opening those files, untracking already tracked resources, and explaining why a selected resource is ignored.

## Quick Start

1. Open a folder or workspace that contains a Git repository.
2. Right-click a file or folder in the Explorer.
3. Choose `Git Ignore Manager: Add to .gitignore` to share the rule with the repository, or `Git Ignore Manager: Add to .git/info/exclude` to keep the rule local.
4. If the selected resource is already tracked by Git, choose whether to add only the ignore rule or run `Untrack and Ignore`.

The extension writes repository-relative patterns, normalizes paths to forward slashes, adds trailing `/` for folders, and avoids duplicate exact rules.

## Commands

- `Git Ignore Manager: Add to .gitignore`
- `Git Ignore Manager: Add to .git/info/exclude`
- `Git Ignore Manager: Open .gitignore`
- `Git Ignore Manager: Open .git/info/exclude`
- `Git Ignore Manager: Why Is This Ignored?`

The add commands and `Why Is This Ignored?` are also available from the Explorer context menu. Multiple selected Explorer resources can be added in one batch.

## .gitignore vs .git/info/exclude

Use `.gitignore` for rules that should be committed and shared with everyone working in the repository. This is the right place for build output, dependency folders, generated files, and other project-wide ignore rules.

Use `.git/info/exclude` for local-only rules that should stay on your machine. This is useful for personal scratch files, local tool output, or editor-specific files that the project does not want to commit as shared ignore policy.

## Tracked Files

Git ignore rules only affect untracked files. If a file or folder is already tracked, adding an ignore rule does not stop Git from reporting changes to it.

When Git Ignore Manager detects tracked selected resources, it warns before writing the rule. The `Untrack and Ignore` action removes the selected tracked files from the Git index with `git rm --cached` and then writes the ignore rule, leaving the files on disk.

## Why Is This Ignored?

Run `Git Ignore Manager: Why Is This Ignored?` from the Explorer context menu or Command Palette to inspect Git's native ignore decision for a selected resource.

The command uses `git check-ignore -v` and reports the ignore source, line number, and matching pattern when Git can explain the match. Use `Open Rule` from the result to open the file that contains the matching ignore rule.

## Known Limitations

- Global Git ignore files are not managed yet.
- Custom pattern input is not available yet.
- Removing ignore patterns is not available yet.
- `Why Is This Ignored?` depends on Git's `git check-ignore -v` output and only reports matches Git can explain for the selected path.
- Multi-root and nested repository support resolves actions from the selected resource; unusual workspace layouts may still require checking that the intended repository was selected.
