# Changelog

All notable changes to the "Git Ignore Manager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Added VS Code commands for adding selected resources to `.gitignore` and `.git/info/exclude`.
- Added VS Code commands for opening `.gitignore` and `.git/info/exclude`.
- Added Explorer context menu entries for ignore actions.
- Added repository-relative ignore pattern generation with cross-platform path normalization.
- Added trailing slash handling for folder ignore patterns.
- Added duplicate pattern prevention.
- Added tracked-file warning before adding ignore rules.
- Added basic multi-root workspace handling.
- Added a `.git/info/exclude` file watcher that refreshes VS Code Git and Explorer state when local exclude rules change.

### Changed

- Replaced the generated `Hello World` extension scaffold with the initial Git Ignore Manager structure.
- Updated README to describe the current MVP scope.
- Added explicit Node.js and VS Code ambient types to the TypeScript configuration.
- Improved tracked-file warnings for folders that contain tracked files.
