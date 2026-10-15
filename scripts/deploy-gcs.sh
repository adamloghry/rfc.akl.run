#!/usr/bin/env bash
# Deploy dist/ to the GCS bucket behind Cloudflare.
#
#   BUCKET=rfc.akl.run CF_ZONE_ID=... CF_API_TOKEN=... bash scripts/deploy-gcs.sh [--init] [--dry-run]
#
#   --init     also set the bucket's website config (once; MainPageSuffix/NotFoundPage)
#   --fix-headers  also rewrite Cache-Control on objects rsync skipped as unchanged
#              (needed on the first deploy into a non-empty bucket, or after changing
#              the header policy below); uses `gcloud storage objects update`
#   --dry-run  echo every command instead of running it (needs neither gcloud nor secrets)
#
# Why not one `rsync --delete-unmatched-destination-objects dist/ gs://bucket`?
# Pagefind rewrites pagefind.js, pagefind-entry.json and wasm.* under the SAME names
# every build; search/index/*, search/fragment/*, assets/* and the content-hashed
# search/pagefind.*.pf_meta (at the search/ root) are immutable. So the deploy is
# ordered to keep in-flight browsers working:
#   1a. upload immutable, content-hashed files first (prefixes + pf_meta), deleting nothing
#   1b. upload everything else (HTML, data/, unhashed pagefind files) with a short TTL
#   1c. only after the new HTML is live, delete stale hashed objects, per prefix and pf_meta
# Every rsync uses --checksums-only: the build recreates dist/ from scratch, so file
# mtimes (and sizes of rewritten files) always differ and the default mtime comparison
# would re-upload everything; comparing checksums uploads only what really changed.
# Old hashed chunks therefore survive until 1c, so pages cached at the edge or in a
# browser that still reference them never 404 mid-deploy.
#
# gcloud flags used (gcloud storage rsync): --recursive, --checksums-only, --cache-control,
# --delete-unmatched-destination-objects. UNVERIFIED here (no live bucket): behaviour
# of --cache-control on rsync is documented (applies to uploaded objects only;
# objects skipped as unchanged keep old metadata, so changing a header requires
# re-uploading). We avoid --exclude (regex semantics differ) via a staging copy.
set -euo pipefail

BUCKET="${BUCKET:-rfc.akl.run}"
DIST="${DIST:-dist}"
INIT=0
FIX=0
DRY=0
for a in "$@"; do
  case "$a" in
    --init) INIT=1 ;;
    --fix-headers) FIX=1 ;;
    --dry-run) DRY=1 ;;
    *) echo "unknown argument: $a" >&2; exit 2 ;;
  esac
done

IMMUTABLE="public, max-age=31536000, immutable"
SHORT="public, max-age=300, s-maxage=86400"
HASHED_PREFIXES=(assets search/index search/fragment)
# Content-hashed pagefind metadata at the search/ root (pagefind.<hash>.pf_meta); the
# glob is expanded against $DIST. `gcloud storage cp` uploads them (rsync cannot filter
# a single directory level without --exclude, whose regex semantics differ).
PF_META=()
for f in "$DIST"/search/pagefind.*.pf_meta; do [ -e "$f" ] && PF_META+=("$f"); done

run() {
  if [ "$DRY" = 1 ]; then printf '+'; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}

[ -d "$DIST" ] || { echo "error: $DIST/ not found; run the build first" >&2; exit 1; }
if [ "$DRY" = 0 ]; then
  command -v gcloud >/dev/null || { echo "error: gcloud not installed" >&2; exit 1; }
  : "${CF_ZONE_ID:?CF_ZONE_ID is required}"
  : "${CF_API_TOKEN:?CF_API_TOKEN is required}"
fi

# (2) One-time website config.
if [ "$INIT" = 1 ]; then
  run gcloud storage buckets update "gs://$BUCKET" --web-main-page-suffix=index.html --web-error-page=404.html
fi

# (1a) Immutable prefixes: add/update only, never delete.
for p in "${HASHED_PREFIXES[@]}"; do
  if [ -d "$DIST/$p" ]; then
    run gcloud storage rsync --recursive --checksums-only --cache-control="$IMMUTABLE" "$DIST/$p" "gs://$BUCKET/$p"
  fi
done

# (1a') Content-hashed pagefind metadata: immutable, and uploaded before any HTML that references it.
if [ "${#PF_META[@]}" -gt 0 ]; then
  run gcloud storage cp --cache-control="$IMMUTABLE" "${PF_META[@]}" "gs://$BUCKET/search/"
fi

# (1b) Everything else, from a staging copy with the hashed prefixes removed.
# No --delete-unmatched-destination-objects at the bucket root: that would delete the
# hashed prefixes (absent from staging) before the new HTML is live.
if [ "$DRY" = 1 ]; then
  STAGE="<staging copy of $DIST without ${HASHED_PREFIXES[*]} and search/pagefind.*.pf_meta>"
else
  STAGE="$(mktemp -d)"
  trap 'rm -rf "$STAGE"' EXIT
  cp -a "$DIST/." "$STAGE/"
  for p in "${HASHED_PREFIXES[@]}"; do rm -rf "${STAGE:?}/$p"; done
  rm -f "${STAGE:?}"/search/pagefind.*.pf_meta
fi
run gcloud storage rsync --recursive --checksums-only --cache-control="$SHORT" "$STAGE" "gs://$BUCKET"

# (1c) HTML is live: now prune stale hashed objects, each prefix on its own.
# Stale HTML (RFC pages that disappeared) is rare and deliberately left alone;
# list what rsync would remove with a dry-run for the log.
for p in "${HASHED_PREFIXES[@]}"; do
  if [ -d "$DIST/$p" ]; then
    run gcloud storage rsync --recursive --checksums-only --delete-unmatched-destination-objects "$DIST/$p" "gs://$BUCKET/$p"
  fi
done
# Stale pf_meta files (search/ root): delete remote ones that this build no longer produced.
if [ "${#PF_META[@]}" -gt 0 ]; then
  if [ "$DRY" = 1 ]; then
    echo "+ (delete gs://$BUCKET/search/pagefind.*.pf_meta objects not present in $DIST/search/)"
  else
    KEEP=" $(for f in "${PF_META[@]}"; do basename "$f"; done | tr '\n' ' ')"
    for u in $(gcloud storage ls "gs://$BUCKET/search/pagefind.*.pf_meta" 2>/dev/null || true); do
      case "$KEEP" in *" $(basename "$u") "*) ;; *) run gcloud storage rm "$u" ;; esac
    done
  fi
fi
echo "# stale objects outside hashed prefixes (informational, not deleted):"
# (the hashed prefixes are absent from staging, so filter them out of the report)
{ run gcloud storage rsync --recursive --checksums-only --dry-run --delete-unmatched-destination-objects "$STAGE" "gs://$BUCKET" 2>&1 \
    | grep -vE "gs://$BUCKET/(assets/|search/index/|search/fragment/|search/pagefind\\.[^/]*\\.pf_meta)" ; } || true

# (1d) Optional: re-stamp Cache-Control on objects rsync left alone. Short policy on the
# whole bucket first (one command; wildcards cannot exclude), then the long policy
# re-applied on the hashed prefixes. The hashed objects briefly carry the short TTL,
# which is harmless (they are only refetched, never wrong).
if [ "$FIX" = 1 ]; then
  run gcloud storage objects update --cache-control="$SHORT" "gs://$BUCKET/**"
  for p in "${HASHED_PREFIXES[@]}"; do
    run gcloud storage objects update --cache-control="$IMMUTABLE" "gs://$BUCKET/$p/**"
  done
fi

# (3) Cloudflare: purge everything so HTML refreshes at the edge immediately.
if [ "$DRY" = 1 ]; then
  echo "+ curl -X POST https://api.cloudflare.com/client/v4/zones/\$CF_ZONE_ID/purge_cache -H 'Authorization: Bearer \$CF_API_TOKEN' -H 'Content-Type: application/json' --data '{\"purge_everything\":true}'"
else
  curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
    -H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json" \
    --data '{"purge_everything":true}'
  echo
fi
