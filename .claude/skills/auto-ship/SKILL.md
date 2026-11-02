---
name: auto-ship
description: End-to-end delivery of one change to this repo, tracked through a GitHub issue. Find or create the issue (checking for duplicates and unmet dependencies first), implement it, run the repo's own checks plus the issue's acceptance steps, have a fresh subagent review the diff, open a PR that closes the issue, babysit it to green and merge it. Use when someone asks to "ship", "auto-ship", "just get this done", "build and merge", or says "auto-ship <feature>" or "auto-ship #NN". Don't use it for exploration, questions, or anything the caller wants to review before it lands.
---

# Auto-ship

In this skill, **the caller** is the person who invoked it. They own the run: questions go to them, the PR is credited to them, and they are its assignee and reviewer. Asking to auto-ship is the caller's request to merge without waiting for a separate review, but only for the branch and PR this run creates. It does not cover other branches, other people's PRs, repo settings, or review rules the repo enforces (step 8).

Every run is tracked through exactly one GitHub issue in this repo (the `origin` remote), from before the first line of code to the merge. The issue records what was asked and what happened.

This skill doesn't assume a stack. Wherever it says "the repo's checks" or "the repo's conventions", find them in the repo as it is on `main` today (step 4), not from memory or from another project. Don't skip the verification, review or documentation steps to get to the merge faster: a fast merge of something broken isn't a win.

## 1. Find or create the tracking issue

Work out what is being asked from the request ("auto-ship passkeys" means passkey login; "auto-ship #35" means issue 35; "auto-ship S05" means the issue whose title contains `S05`; a bare "ship this" means the fuller description earlier in the conversation).

- **An issue number was given.** Confirm it exists and is open with `issue_read`.
- **Otherwise, search first.** Run `list_issues` (open first) or `search_issues` on this repo with keywords from the request. Planned work often already has an issue, so reuse it rather than filing a duplicate.
  - A clear open match: use it.
  - The best match is closed as completed: it probably shipped already. Say so and ask the caller before redoing it.
  - Several plausible matches: ask if it's genuinely ambiguous, otherwise create a new issue.
- **No match.** Create one with `issue_write` (`method: create`): a title from the request and a short body saying what was asked and who asked (the caller).

**Check dependencies.** If the issue body names other issues it waits on (lines like `Depends on:`, `Blocked by:`, or a parent/sub-issue order), check each one with `issue_read`. If any is still open, tell the caller what it waits on and ask before going on. A dependency that's open but has a merged PR closing it counts as done.

**Check it isn't taken.** If the issue is assigned to someone other than the caller, or has an open PR linked to it, stop and tell the caller who holds it. If the repo has a `CONTRIBUTING.md` (or `CLAUDE.md`/`AGENTS.md` points to a workflow) that defines how to claim work, follow it. Otherwise claim it by assigning the caller and commenting that auto-ship is picking it up.

If `list_issue_fields` shows a project `Status` field, move the issue to In Progress. Re-check that each run; a project may get wired up later.

## 2. Read the issue as the spec

Treat the issue body as the spec. Note, if present:

- **Files / Touches**: the files the change is meant to touch. Keep the diff to those (plus lockfiles for named dependencies). If the work genuinely needs another file, say so in the PR body.
- **Steps**: what to build.
- **Acceptance** checkboxes and **Verify** commands: these become part of step 5.
- **Conventions** sections, here or in a parent/index issue the body links to: follow them as repo rules.

If the issue is too vague to build without guessing at a product decision, ask the caller and keep building any part that doesn't depend on the answer.

## 3. Branch

Use the session's designated branch if the environment names one ("Git Development Branch Requirements"). If that branch's earlier PR is already merged, restart it from the default branch (`git fetch origin main && git checkout -B <branch> origin/main`, substituting the real default branch). Otherwise branch off the default branch with a short descriptive name matching the convention `git log --oneline -20` shows.

**Empty repo.** If the remote has no branches at all, there is no base to open a PR against. Ask the caller before pushing anything to `main`; the usual fix is to seed `main` with an empty initial commit and open the PR against it.

## 4. Learn the repo's conventions, then implement

Before writing code, read whichever of these exist on the default branch:

- `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` and `README.md`: conventions, layout and how to run things.
- `docs/LESSONS.md` (or another pre-ship checklist those files point to): rules from past bugs. Skim its headings and read the sections your change touches.
- Architecture and decision docs those files point to (for example `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` or ADRs): don't fight a recorded decision without asking.
- Other skills in `.claude/skills/` whose description matches the work.

Then work out **the repo's checks**, the commands CI runs, in this order:

1. Commands those docs name as the pre-push checks.
2. The jobs in `.github/workflows/*.yml` (or other CI config), run the same way locally.
3. The project's own task runner: `package.json` scripts (`lint`, `typecheck`, `test`, `build`) with the package manager its lockfile implies, a `Makefile`, `justfile`, `Cargo.toml`, `pyproject.toml`, `go.mod`, and so on.

If the repo has no checks yet (early on, it may not), say so in the PR body and rely on the issue's own Verify steps.

Build the change. Follow the patterns already in the surrounding code, keep the diff to what the issue asks for, and add or update tests where the change touches logic worth locking down. Don't add dependencies the issue doesn't name unless the change can't be done without them, and say why in the PR body if you do.

## 5. Verify, then review

Run the repo's checks from step 4, then every **Verify** command and **Acceptance** item from the issue. Fix failures here: a local red run is cheap, a CI red run costs a round trip. Keep the commands and their key output for the PR body. If something can't run in this environment (no network for an install, no browser, no device), say what you couldn't run and what you checked instead.

For a UI change, run the app and look at it if the repo has a way to (a `run`/`dev` script or a run skill), and take a screenshot for the PR.

**Then review the diff in a fresh agent.** The implementer is the worst-placed to spot its own mistakes, so the review pass goes to someone who sees only the diff. Spawn one `general-purpose` subagent with this prompt, filling in the base branch, the docs you read in step 4 and the issue number:

> You are reviewing a diff for this repo before it merges. Run `git diff origin/<base>...HEAD`. Read these docs and apply every rule in them that touches the diff: <docs from step 4, or "CLAUDE.md/AGENTS.md if present">. Then read issue #NN with its Files, Steps, Acceptance and Conventions sections, and check that the diff does what it asks, touches only the files it lists (or explains why not), and adds no unnamed dependencies. Also look for real bugs: wrong logic, unhandled errors, secrets or credentials in the diff, tests skipped or weakened. Report only real problems, each with file and line, the rule or requirement it breaks, and the fix. Reply "No findings" if there are none. Don't edit files.

The review is done when every finding is fixed in the branch or answered in the PR body under "Review" with why it doesn't apply. Re-run the checks after fixes.

**If this run fixes a bug**, add the rule that would have caught it to `docs/LESSONS.md` (create it with a one-line intro if it doesn't exist), under a heading for the area it belongs to, in the same PR.

## 6. Update the docs

In the same branch:

- Update `README.md` or other docs whose described setup, layout or behavior this change made wrong (new commands, new env vars, new directories).
- Tick off anything the run finished in a tracking/index issue only if the repo's workflow says to; otherwise the closing keyword is enough.
- File follow-up work the run uncovered as new issues and link them in the PR body.
- Update project memory if this run settles a fact a later session would otherwise have to ask again.

## 7. Open the PR

Commit with a clear message and push with `git push -u origin <branch>`. Check for a PR template (`.github/pull_request_template.md` and the other usual spots) and fill it if there is one. Otherwise structure the body as:

- the PR attribution block from the session context (if there is one) as the first lines, crediting the caller
- **Summary**: what changed and why, in a few sentences
- **How I verified**: each command run and its key output, each Acceptance item and whether it passed, and anything that couldn't run here
- **Review**: the review subagent's result, and the answer to any finding left unfixed
- a screenshot, for a UI change
- `Fixes #NN`

The closing keyword links the PR in the issue's Development panel and closes the issue the moment the PR merges. That means there's no open window after merge for the caller to check it live; reopening the issue is how they flag a problem. Then assign the caller and request their review (`issue_write` with `assignees: ["<caller's GitHub login>"]`, `update_pull_request` with `reviewers` the same), and comment on the issue with the PR link.

## 8. Babysit to green, then merge

Subscribe to the PR's activity. The harness's PR-driving rules cover merge conflicts, red CI and review-bot findings; follow those as given. The one thing this skill changes: once the PR is genuinely green, **merge it** rather than leaving it waiting on review. The caller asked for shipped, not opened.

- If the repo has CI, wait for every check on the PR's head to finish. Never merge while one is pending or red. Fix a red check on the branch and push. If the repo has no CI yet, merge once the local checks and the review are clean, and say there was no CI in the final message.
- Enable auto-merge if the repo supports it, so it lands the moment checks clear; otherwise merge manually once green.
- Use the merge method the repo's history already shows. If there's no convention yet, use a **merge commit** (`merge_method: "merge"`): after a squash merge, a designated branch that later sessions reuse can't be reset onto `main` without a force push.
- Don't delete the designated branch; later sessions reuse branch names. Delete a branch you created yourself.
- Repo rules beat the caller's request. If branch protection, a ruleset or CODEOWNERS requires an approval, or the merge is refused for any review reason, leave the PR open, request the required reviewers, and tell the caller whose approval it waits on. Never approve the PR yourself or route around the rule.
- Never get to green by skipping, disabling or weakening a check or test, or by force-pushing past a conflict. A merge bought that way isn't done, it's hidden.

After the merge, confirm the issue closed with `issue_read`. If the project has a `Status` field, set it to Done; GitHub's auto-close doesn't touch project fields. Don't wait on or try to confirm a deploy; checking the change live is the caller's review. If checks on the merged head come back red, fix it on a fresh branch off `main` and ship that through steps 4 to 8, reopening the issue if it's the same problem.

## When you're done

Tell the caller in one short message: what merged, the issue and PR (numbers and links), and that the issue closed with the merge, so reopening it is how they flag a problem found live. If something blocked the loop (an open dependency, a required review, a failure you couldn't safely fix, a product decision the code can't settle), say exactly what's blocking and where the branch and issue were left. If the run stops without merging, unassign the caller from the issue unless the branch is still being worked on.
