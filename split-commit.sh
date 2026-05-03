#!/usr/bin/env bash
set -euo pipefail

BAD_COMMIT="47ed107e4d1c4a2dbdd576be0126104079f9bc95"
AUDIO_DIR="public/mp3"
BATCH_SIZE=10000

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a Git repo."
  exit 1
fi

REBASE_MERGE_DIR="$(git rev-parse --git-path rebase-merge)"
REBASE_APPLY_DIR="$(git rev-parse --git-path rebase-apply)"

IN_REBASE=0
if [ -d "$REBASE_MERGE_DIR" ] || [ -d "$REBASE_APPLY_DIR" ]; then
  IN_REBASE=1
fi

if [ "$IN_REBASE" -eq 0 ]; then
  BRANCH="$(git branch --show-current)"

  if [ -z "$BRANCH" ]; then
    echo "Detached HEAD and no rebase in progress. Check out your branch first."
    exit 1
  fi

  if [ -n "$(git status --porcelain)" ]; then
    echo "Working tree is not clean. Commit, stash, or discard changes first."
    exit 1
  fi

  git cat-file -e "${BAD_COMMIT}^{commit}" || {
    echo "Bad commit does not exist in this repo: $BAD_COMMIT"
    exit 1
  }

  if ! git merge-base --is-ancestor "$BAD_COMMIT" HEAD; then
    echo "Bad commit is not in current branch history."
    exit 1
  fi

  export GIT_SEQUENCE_EDITOR="sed -i -E 's/^pick[[:space:]]+${BAD_COMMIT:0:7}/edit ${BAD_COMMIT:0:7}/'"
  git rebase -i "${BAD_COMMIT}^"

  git reset HEAD^
else
  BRANCH="$(git branch --show-current || true)"
  echo "Rebase already in progress. Continuing from current stopped state."
fi

if [ ! -d "$AUDIO_DIR" ]; then
  echo "Audio directory not found: $AUDIO_DIR"
  exit 1
fi

rm -f /tmp/audio_batch_*

find "$AUDIO_DIR" -type f | sort | split -l "$BATCH_SIZE" - /tmp/audio_batch_

i=1
for batch in /tmp/audio_batch_*; do
  [ -s "$batch" ] || continue

  git add --pathspec-from-file="$batch"

  if ! git diff --cached --quiet; then
    git commit -m "Update audio data batch $i"
    i=$((i + 1))
  fi
done

if [ -n "$(git status --porcelain)" ]; then
  git add -A

  if ! git diff --cached --quiet; then
    git commit -m "Apply remaining changes from split commit"
  fi
fi

git rebase --continue

echo
echo "Done."
echo "Push with:"
echo "git push --force-with-lease origin YOUR_BRANCH_NAME"