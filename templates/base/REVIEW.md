# Code review

How to review a pull request in this project. Judge the code against `docs/standards/`.

## What failure looks like here

<!-- Name the failures that matter most in this project, e.g. "a price shown without currency". -->

- Behavior that breaks for a caller or a user
- New logic without a `.spec.ts` that tests it
- Code that breaks a rule in `docs/standards/`

## Evidence

Cite `file:line` for every finding.

## Summary

Start with the number of findings. When there are none, say "no issues".

## Skip

Lockfiles, generated files and `docs/standards/`.
