#!/usr/bin/env bash
set -euo pipefail

BRANCH="main"
REMOTE="origin"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a Git repo."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean. Resolve, commit, stash, or discard changes first."
  exit 1
fi

git fetch "$REMOTE" "$BRANCH"

LOCAL_HEAD="$(git rev-parse "$BRANCH")"
REMOTE_HEAD="$(git rev-parse "$REMOTE/$BRANCH")"
BASE="$(git merge-base "$BRANCH" "$REMOTE/$BRANCH")"

echo "Local  $BRANCH: $LOCAL_HEAD"
echo "Remote $BRANCH: $REMOTE_HEAD"
echo "Base:          $BASE"
echo

mapfile -t COMMITS < <(git rev-list --reverse --first-parent "$BASE..$BRANCH")

if [ "${#COMMITS[@]}" -eq 0 ]; then
  echo "Nothing to push."
  exit 0
fi

LEASE="$REMOTE_HEAD"
TOTAL="${#COMMITS[@]}"
N=1

for SHA in "${COMMITS[@]}"; do
  MSG="$(git log -1 --format=%s "$SHA")"

  echo
  echo "[$N/$TOTAL] pushing $SHA"
  echo "$MSG"

  git push \
    --force-with-lease="refs/heads/$BRANCH:$LEASE" \
    "$REMOTE" \
    "$SHA:refs/heads/$BRANCH"

  LEASE="$SHA"
  N=$((N + 1))
done

echo
echo "Done."
git ls-remote "$REMOTE" "refs/heads/$BRANCH"