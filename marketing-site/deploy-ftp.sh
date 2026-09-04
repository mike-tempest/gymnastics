#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Swimly Marketing Site - FTP Deploy (Incremental, multi-domain)
#
# One build, two targets:
#   * swimly.uk   (UK)        -> the current FTP root (document root for swimly.uk)
#   * swimly.club (US/CA/AU)  -> a separate document root (an addon domain on the
#                                same FTP account), set via FTP_REMOTE_CLUB
#
# A single `npm run build` produces dist.nosync/ with this layout:
#   dist.nosync/                  UK pages at the root (index.html, blog/, clubs/, ...)
#   dist.nosync/us/               US pages
#   dist.nosync/ca/               Canada pages
#   dist.nosync/au/               Australia pages
#   dist.nosync/international/     swimly.club hub: index.html, robots.txt, sitemap-*.xml
#
# This script splits that one build into the two document roots:
#   swimly.uk  <- everything EXCEPT us/ ca/ au/ international/
#   swimly.club:
#       /us/      <- dist.nosync/us/
#       /ca/      <- dist.nosync/ca/
#       /au/      <- dist.nosync/au/
#       /         <- the CONTENTS of dist.nosync/international/
#                    (so international/index.html becomes swimly.club/index.html,
#                     international/robots.txt -> swimly.club/robots.txt, etc.)
#
# swimly.info: redirects (301) to swimly.club. Do this at the host/DNS level if
# you can. If swimly.info is an addon on this account, set FTP_REMOTE_INFO to its
# document root and this script will deploy a one-file redirect .htaccess there.
#
# Safety:
#   * Fixes file permissions before upload (dirs 755, files 644). The system umask
#     on a local Mac is 0077, which makes Astro output unreadable and returns 403.
#     Bypassing this has caused four outages. The fix is applied to BOTH targets.
#   * The swimly.uk upload uses incremental checksums (.deploy-manifest) so it only
#     uploads changed/new files and deletes removed ones.
#   * The swimly.club upload is SKIPPED (never blocking the UK deploy) when
#     FTP_REMOTE_CLUB is unset or when no international content exists in the build.
#   * Never deploy with raw lftp/FTP. Always use this script.
#
# Usage:
#   ./deploy-ftp.sh              # Build + deploy both targets
#   ./deploy-ftp.sh --no-build   # Deploy existing dist.nosync/ only
#   DRY_RUN=1 ./deploy-ftp.sh    # Print the lftp scripts instead of running them
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# dist.nosync: iCloud Drive ignores *.nosync, preventing file eviction
# mid-upload (this repo lives in the iCloud-synced Documents folder)
DIST_DIR="$SCRIPT_DIR/dist.nosync"
# Staging tree assembled for the swimly.club document root. Built fresh on each
# run from the international/us/ca/au parts of dist.nosync. Also .nosync so iCloud
# never evicts it mid-upload.
CLUB_DIR="$SCRIPT_DIR/dist-club.nosync"
MANIFEST_FILE="$SCRIPT_DIR/.deploy-manifest"

# Directories in the build that belong to swimly.club, NOT swimly.uk. They are
# excluded from the swimly.uk mirror and from the swimly.uk checksum manifest.
INTL_DIRS=(us ca au international)

# Credentials are read from the environment (GitHub Actions secrets in CI,
# your shell locally). ALL of host, user and password are REQUIRED with no
# fallback: this repo is the gymnastics fork, and the old defaults pointed at
# Swimly's live hosting account. Never add host, user or password literals
# back to this file.
if [[ -z "${FTP_HOST:-}" || -z "${FTP_USER:-}" || -z "${FTP_PASS:-}" ]]; then
    echo "ERROR: FTP_HOST, FTP_USER and FTP_PASS must all be set." >&2
    echo "Set them in the environment before deploying, e.g.:" >&2
    echo "  FTP_HOST='...' FTP_USER='...' FTP_PASS='...' ./deploy-ftp.sh" >&2
    echo "In CI they come from repository secrets." >&2
    exit 1
fi

# Remote document roots for the additional domains on the SAME FTP account.
# Leave empty to skip that domain. Do NOT hardcode a guess: the correct value is
# the addon domain's document root as shown in the hosting control panel
# (for example something like /home/USER/swimly.club or public_html/swimly.club).
#   FTP_REMOTE_CLUB  -> swimly.club document root (US/CA/AU + hub). Skipped if empty.
#   FTP_REMOTE_INFO  -> swimly.info document root (redirect-only).  Skipped if empty.
FTP_REMOTE_CLUB="${FTP_REMOTE_CLUB:-}"
FTP_REMOTE_INFO="${FTP_REMOTE_INFO:-}"

# swimly.club may be its OWN FTP account (separate host/user/pass), not just an
# addon folder on the shared swimly.uk account. When these are set, the swimly.club
# deploy connects with them instead of FTP_HOST/USER/PASS, and FTP_REMOTE_CLUB is
# the path on that account (defaults to "/", since a dedicated FTP login is usually
# jailed to its own document root). Leave unset to use the shared account.
FTP_CLUB_HOST="${FTP_CLUB_HOST:-}"
FTP_CLUB_USER="${FTP_CLUB_USER:-}"
FTP_CLUB_PASS="${FTP_CLUB_PASS:-}"

# DRY_RUN=1 prints each lftp script instead of executing it. Lets you trace the
# include/exclude logic without touching the live site.
DRY_RUN="${DRY_RUN:-}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}==> Swimly Marketing Site Deploy${NC}"

# Run an lftp script, or print it when DRY_RUN is set. Centralised so both the
# swimly.uk and swimly.club uploads share identical dry-run behaviour.
run_lftp() {
    local script_file="$1"
    if [[ -n "$DRY_RUN" ]]; then
        echo -e "${YELLOW}--- DRY RUN: lftp script (not executed) ---${NC}"
        # Mask the password before printing. We use plain bash string replacement
        # (parameter expansion), NOT sed: the password can contain regex and
        # replacement metacharacters (the committed fallback alone has } { % ] &),
        # which would make sed mis-mask or fail outright and fall through to
        # printing the cleartext password into the log.
        # Mask every configured password. Guard on non-empty: replacing an empty
        # string would insert the mask between every character.
        local line masked
        while IFS= read -r line; do
            masked="$line"
            [[ -n "$FTP_PASS" ]] && masked="${masked//$FTP_PASS/********}"
            [[ -n "$FTP_CLUB_PASS" ]] && masked="${masked//$FTP_CLUB_PASS/********}"
            printf '%s\n' "$masked"
        done < "$script_file"
        echo -e "${YELLOW}--- end DRY RUN ---${NC}"
    else
        lftp -f "$script_file"
    fi
}

# Pick an md5 implementation once (macOS: md5 -r, Linux: md5sum).
if command -v md5 &>/dev/null; then
    md5cmd() { md5 -r "$1" | awk '{print $1}'; }
elif command -v /sbin/md5 &>/dev/null; then
    md5cmd() { /sbin/md5 -r "$1" | awk '{print $1}'; }
elif command -v md5sum &>/dev/null; then
    md5cmd() { md5sum "$1" | awk '{print $1}'; }
else
    echo -e "${RED}Error: No md5 or md5sum command found.${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 1: Build (unless --no-build)
# -----------------------------------------------------------------------------
if [[ "${1:-}" != "--no-build" ]]; then
    echo -e "${YELLOW}==> Building site...${NC}"
    cd "$SCRIPT_DIR"
    npm run build
    echo -e "${GREEN}==> Build complete${NC}"
fi

# Step 2: Check dist exists
if [[ ! -d "$DIST_DIR" ]]; then
    echo -e "${RED}Error: dist.nosync/ directory not found. Run build first.${NC}"
    exit 1
fi

# -----------------------------------------------------------------------------
# Step 3: Fix permissions locally BEFORE upload
# CRITICAL: Prevents 403 errors caused by restrictive umask (0077). Applied to
# the whole build here; the swimly.club staging tree is re-chmodded after it is
# assembled in Step 9 so copied files always get the fix too.
# -----------------------------------------------------------------------------
echo -e "${YELLOW}==> Fixing file permissions (dirs: 755, files: 644)...${NC}"
find "$DIST_DIR" -type d -exec chmod 755 {} \;
find "$DIST_DIR" -type f -exec chmod 644 {} \;

# -----------------------------------------------------------------------------
# Step 4: Replace swimly.uk .htaccess with slim version
# Astro generates 1000+ redirect rules that crash LiteSpeed. This file lives at
# the swimly.uk document root only; the swimly.club .htaccess is written in
# Step 9 and the swimly.info one in Step 11.
# -----------------------------------------------------------------------------
cat > "$DIST_DIR/.htaccess" << 'HTACCESS'
RewriteEngine On

# Redirect www to non-www
RewriteCond %{HTTP_HOST} ^www\.swimly\.uk [NC]
RewriteRule ^(.*)$ https://swimly.uk/$1 [L,R=301]

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Pilot page consolidated into founding clubs - June 2026
RewriteRule ^pilot/?$ /founding-clubs/ [R=301,L]

# Old region URLs -> clubs index (pattern-based, not 1000 individual rules)
RewriteRule ^clubs/(south-east|north-west|north-east|south-west|east-midlands|west-midlands|yorkshire)/(.+)$ /clubs/ [R=301,L]
RewriteRule ^clubs/(south-east|north-west|north-east|south-west|east-midlands|west-midlands|yorkshire)/?$ /clubs/ [R=301,L]

# Keyword-consolidation 301s: 31 cannibalising blog posts deleted in the
# March 2026 dedupe (commit c34a7af), each redirected to its surviving
# canonical post. Grouped by target to keep this file slim for LiteSpeed.
RewriteRule ^blog/(agm-survival-guide-swim-clubs|complete-swim-club-agm-guide-2026|how-to-run-a-successful-swim-club-agm|how-to-run-painless-agm|how-to-run-painless-agm-swim-club|how-to-run-painless-swim-club-agm|how-to-run-swim-club-agm-efficiently|painless-agm|painless-agm-guide|painless-agm-swim-club|swim-club-agm-survival-guide)/?$ /blog/running-your-first-swimming-club-agm/ [R=301,L]
RewriteRule ^blog/agm-legal-requirements-uk-swim-clubs/?$ /blog/swimming-club-agm-legal-requirements-uk/ [R=301,L]
RewriteRule ^blog/(10-questions-choosing-club-management-software|how-to-choose-swim-club-management-software|evaluating-software|evaluating-swim-club-software-at-agm)/?$ /blog/how-to-choose-swimming-club-management-software-uk/ [R=301,L]
RewriteRule ^blog/(committee-handover-checklist|committee-handover-guide)/?$ /blog/swimming-club-committee-handover-checklist/ [R=301,L]
RewriteRule ^blog/(competition-season-prep-checklist|managing-competition-entries)/?$ /blog/competition-season-admin-guide/ [R=301,L]
RewriteRule ^blog/gocardless-vs-stripe-for-swim-club-payments/?$ /blog/direct-debit-vs-card-payments-for-swim-clubs/ [R=301,L]
RewriteRule ^blog/guide-to-wavepower-compliance-for-swim-clubs/?$ /blog/parents-guide-to-wavepower-compliance/ [R=301,L]
RewriteRule ^blog/how-to-manage-volunteer-burnout-in-swimming-clubs/?$ /blog/volunteer-burnout-in-swim-clubs/ [R=301,L]
RewriteRule ^blog/parent-guide-competitive-swimming/?$ /blog/a-parents-guide-to-competitive-swimming-uk/ [R=301,L]
RewriteRule ^blog/setting-up-direct-debit-for-swim-club-fees/?$ /blog/treasurers-guide-swim-club-direct-debit/ [R=301,L]
RewriteRule ^blog/(swim-club-attendance-tracking-safeguarding|swim-club-safeguarding-best-practices|swim-club-spreadsheet-safeguarding-risk)/?$ /blog/swimming-club-safeguarding-best-practices-2026/ [R=301,L]
RewriteRule ^blog/swim-club-billing-best-practices/?$ /blog/how-to-collect-swim-club-fees/ [R=301,L]
RewriteRule ^blog/(why-swim-clubs-need-modern-software|why-uk-swimming-clubs-deserve-better-software)/?$ /blog/why-uk-swim-clubs-deserve-better-software/ [R=301,L]
HTACCESS

# =============================================================================
# TARGET 1: swimly.uk (UK) - incremental mirror to the FTP root
# Uploads everything EXCEPT the swimly.club directories (us/ ca/ au/
# international/). Behaviour is otherwise identical to the original deploy.
# =============================================================================
echo -e "${GREEN}==> Target: swimly.uk${NC}"

# Step 5: Generate checksums for the swimly.uk slice of the build.
# We must prune the intl directories here so the manifest reflects exactly what
# is uploaded to swimly.uk. Otherwise the manifest would track files we never
# upload to this root, and the delete pass could remove unrelated remote files.
echo -e "${YELLOW}==> Generating file checksums...${NC}"
NEW_MANIFEST=$(mktemp)

# Build a single anchored regex that matches any path under an intl directory,
# e.g. ^\./(us|ca|au|international)/ . Filtering the file list with `grep -v` is
# simpler and more portable than a `find -prune` expression with a trailing
# operator (array trimming behaves differently across shells), and it keeps the
# manifest in exact sync with the swimly.uk upload, which excludes the same dirs.
INTL_REGEX="^\\./($(IFS='|'; echo "${INTL_DIRS[*]}"))/"

cd "$DIST_DIR"
# List every file except those under an intl directory, then checksum each one.
# grep exit 1 means "no lines survived the filter" (not an error here); only a
# real grep failure (exit >= 2) should abort under `set -o pipefail`.
find . -type f \
    | { grep -Ev "$INTL_REGEX" || [ $? -eq 1 ]; } \
    | sort \
    | while IFS= read -r file; do
        # Strip leading ./
        rel_path="${file#./}"
        hash=$(md5cmd "$file")
        echo "$hash  $rel_path"
    done > "$NEW_MANIFEST"
cd "$SCRIPT_DIR"

TOTAL_FILES=$(wc -l < "$NEW_MANIFEST" | tr -d ' ')
echo "  Found $TOTAL_FILES files for swimly.uk (intl dirs excluded)"

# Step 6: Compare against previous manifest to find changes
ADDED_FILES=$(mktemp)
CHANGED_FILES=$(mktemp)
DELETED_FILES=$(mktemp)
UPLOAD_FILES=$(mktemp)

if [[ -f "$MANIFEST_FILE" ]]; then
    echo -e "${YELLOW}==> Comparing against previous deploy...${NC}"

    # Find added and changed files
    while IFS= read -r line; do
        new_hash="${line%%  *}"
        new_path="${line#*  }"

        old_line=$(grep -F "  $new_path" "$MANIFEST_FILE" | head -1 || true)
        if [[ -z "$old_line" ]]; then
            echo "$new_path" >> "$ADDED_FILES"
            echo "$new_path" >> "$UPLOAD_FILES"
        else
            old_hash="${old_line%%  *}"
            if [[ "$new_hash" != "$old_hash" ]]; then
                echo "$new_path" >> "$CHANGED_FILES"
                echo "$new_path" >> "$UPLOAD_FILES"
            fi
        fi
    done < "$NEW_MANIFEST"

    # Find deleted files (in old manifest but not in new)
    while IFS= read -r line; do
        old_path="${line#*  }"
        if ! grep -qF "  $old_path" "$NEW_MANIFEST"; then
            echo "$old_path" >> "$DELETED_FILES"
        fi
    done < "$MANIFEST_FILE"
else
    echo -e "${YELLOW}==> No previous manifest found. Uploading all files.${NC}"
    while IFS= read -r line; do
        path="${line#*  }"
        echo "$path" >> "$ADDED_FILES"
        echo "$path" >> "$UPLOAD_FILES"
    done < "$NEW_MANIFEST"
fi

COUNT_ADDED=$(wc -l < "$ADDED_FILES" | tr -d ' ')
COUNT_CHANGED=$(wc -l < "$CHANGED_FILES" | tr -d ' ')
COUNT_DELETED=$(wc -l < "$DELETED_FILES" | tr -d ' ')
COUNT_UPLOAD=$(wc -l < "$UPLOAD_FILES" | tr -d ' ')
COUNT_SKIPPED=$((TOTAL_FILES - COUNT_UPLOAD))

echo ""
echo -e "  ${GREEN}Added:${NC}   $COUNT_ADDED"
echo -e "  ${YELLOW}Changed:${NC} $COUNT_CHANGED"
echo -e "  ${RED}Deleted:${NC} $COUNT_DELETED"
echo -e "  Skipped: $COUNT_SKIPPED (unchanged)"
echo ""

# Step 7: Upload swimly.uk via lftp
if [[ "$COUNT_UPLOAD" -eq 0 && "$COUNT_DELETED" -eq 0 ]]; then
    echo -e "${GREEN}==> Nothing to deploy for swimly.uk, all files up to date.${NC}"
else
    echo -e "${YELLOW}==> Uploading to $FTP_HOST (swimly.uk root, parallel mirror)...${NC}"

    # Build lftp command script
    LFTP_SCRIPT=$(mktemp)
    cat > "$LFTP_SCRIPT" << LFTP_HEADER
set ssl:verify-certificate no
set cmd:fail-exit no
set net:max-retries 3
set net:timeout 20
open -u $FTP_USER,'$FTP_PASS' ftp://$FTP_HOST
LFTP_HEADER

    # Upload via reverse mirror with parallel transfers. This replaces the old
    # per-file mkdir+put loop (one round-trip per file, ~30 min for a full site)
    # with concurrent transfers that create remote directories as needed
    # (~a few minutes). Permissions are still handled by the local chmod in
    # Step 3 plus the server umask; --no-perms avoids FTP SITE CHMOD calls.
    # The intl directories are excluded so they never reach the swimly.uk root.
    # IMPORTANT: use anchored regex excludes (-x '^us/'), NOT --exclude-glob.
    # lftp's --exclude-glob matches a directory of that name at ANY depth, so
    # --exclude-glob us/ would also drop a legitimate UK path like about/us/ or
    # a club/town slug named 'us'. The '^name/' regex is anchored to the mirror
    # source root, so it removes only the top-level us/ ca/ au/ international/
    # directories. This matches the manifest's INTL_REGEX exactly, keeping the
    # checksum manifest in sync with what is actually uploaded.
    # No --delete here: removals are handled conservatively from the manifest
    # below, so mirror never touches server-only files.
    if [[ "$COUNT_UPLOAD" -gt 0 ]]; then
        echo "mirror -R --parallel=10 --no-perms --no-symlinks -x '^us/' -x '^ca/' -x '^au/' -x '^international/' \"$DIST_DIR/\" \"/\"" >> "$LFTP_SCRIPT"
    fi

    # Delete removed files from remote (manifest-based, conservative)
    if [[ "$COUNT_DELETED" -gt 0 ]]; then
        while IFS= read -r file; do
            echo "rm -f \"/$file\"" >> "$LFTP_SCRIPT"
        done < "$DELETED_FILES"
    fi

    echo "quit" >> "$LFTP_SCRIPT"

    run_lftp "$LFTP_SCRIPT"
    rm -f "$LFTP_SCRIPT"

    echo -e "${GREEN}==> swimly.uk upload complete${NC}"
fi

# Step 8: Save manifest for next deploy. Never on a dry run: nothing was
# uploaded, so recording the new checksums would make the next real deploy treat
# every file as already live and skip it, leaving the site on the old build.
if [[ -z "$DRY_RUN" ]]; then
    cp "$NEW_MANIFEST" "$MANIFEST_FILE"
    echo "  Manifest saved to .deploy-manifest"
else
    echo "  DRY RUN: .deploy-manifest left untouched"
fi

# Cleanup swimly.uk temp files
rm -f "$NEW_MANIFEST" "$ADDED_FILES" "$CHANGED_FILES" "$DELETED_FILES" "$UPLOAD_FILES"

echo -e "${GREEN}==> swimly.uk deploy complete: https://swimly.uk${NC}"
echo "  $COUNT_UPLOAD uploaded, $COUNT_DELETED deleted, $COUNT_SKIPPED unchanged"

# =============================================================================
# TARGET 2: swimly.club (US/CA/AU + hub) - full mirror to FTP_REMOTE_CLUB
# Assembled fresh from the build, then mirrored to its own document root. This
# target is non-incremental on purpose: it is small and its remote root is
# distinct, so a clean `mirror --delete` keeps it exactly in sync with the build.
# =============================================================================
echo ""
echo -e "${GREEN}==> Target: swimly.club${NC}"

# Does this build actually contain any international content? If none of the intl
# directories exist yet (for example before the intl pages land), there is
# nothing to assemble and we skip without touching anything.
HAS_INTL_CONTENT=""
for d in "${INTL_DIRS[@]}"; do
    if [[ -d "$DIST_DIR/$d" ]]; then
        HAS_INTL_CONTENT="yes"
        break
    fi
done

# Reject dangerous values for the swimly.club remote root BEFORE the destructive
# `mirror --delete` can run. If FTP_REMOTE_CLUB were the FTP root ("/" or "."),
# empty, or whitespace, --delete would prune everything not in the small club
# staging tree, which would wipe the live swimly.uk site. We trim surrounding
# whitespace, require an absolute path, and forbid the root. This is a hard
# error (not a skip) because a misconfigured destructive target must be loud.
CLUB_REMOTE_TRIMMED="$FTP_REMOTE_CLUB"
# Strip leading/trailing whitespace (a stray space in a secret is easy to add).
CLUB_REMOTE_TRIMMED="${CLUB_REMOTE_TRIMMED#"${CLUB_REMOTE_TRIMMED%%[![:space:]]*}"}"
CLUB_REMOTE_TRIMMED="${CLUB_REMOTE_TRIMMED%"${CLUB_REMOTE_TRIMMED##*[![:space:]]}"}"

club_remote_is_unsafe() {
    case "$CLUB_REMOTE_TRIMMED" in
        ''|/|//|.|./|..|../)
            return 0 ;;        # unsafe: empty or a root/relative-root path
        /*)
            return 1 ;;        # safe: an absolute path below the root
        *)
            return 0 ;;        # unsafe: not absolute (relative path is ambiguous)
    esac
}

# Decide how (and whether) to deploy swimly.club. Two modes:
#   * Dedicated account - FTP_CLUB_HOST/USER/PASS are set: connect with them.
#     FTP_REMOTE_CLUB is the path on THAT account (default "/"). A --delete mirror
#     only ever touches the swimly.club account, never swimly.uk, so "/" is safe.
#   * Shared account - no club creds: reuse FTP_HOST/USER/PASS, and FTP_REMOTE_CLUB
#     must be a safe non-root absolute path (a stray "/" there would --delete
#     swimly.uk's own root).
CLUB_SHOULD_DEPLOY=""
CLUB_FTP_HOST=""
CLUB_FTP_USER=""
CLUB_FTP_PASS=""
if [[ -z "$HAS_INTL_CONTENT" ]]; then
    echo -e "${YELLOW}==> No international content in this build (no us/ ca/ au/ international/). Skipping swimly.club.${NC}"
elif [[ -n "$FTP_CLUB_HOST" && -n "$FTP_CLUB_USER" && -n "$FTP_CLUB_PASS" ]]; then
    CLUB_FTP_HOST="$FTP_CLUB_HOST"
    CLUB_FTP_USER="$FTP_CLUB_USER"
    CLUB_FTP_PASS="$FTP_CLUB_PASS"
    # A dedicated FTP login is its own document root; default to "/" when no
    # explicit subpath is given. --delete is scoped to this account only.
    [[ -z "$CLUB_REMOTE_TRIMMED" ]] && CLUB_REMOTE_TRIMMED="/"
    CLUB_SHOULD_DEPLOY="yes"
    echo -e "${YELLOW}==> swimly.club: dedicated FTP account (${FTP_CLUB_USER}@${FTP_CLUB_HOST}), root: ${CLUB_REMOTE_TRIMMED}${NC}"
elif [[ -z "$FTP_REMOTE_CLUB" ]]; then
    # Never block the UK deploy: just warn and skip.
    echo -e "${YELLOW}==> No swimly.club FTP credentials and FTP_REMOTE_CLUB is unset. Skipping swimly.club upload.${NC}"
    echo -e "${YELLOW}    Set FTP_CLUB_HOST/USER/PASS (dedicated account) or FTP_REMOTE_CLUB (shared account) to enable it.${NC}"
elif club_remote_is_unsafe; then
    # Shared-account guard: refuse to mirror --delete into the root or a relative
    # path, which would risk wiping the live swimly.uk site. swimly.uk has already
    # deployed above, so we fail here to make the misconfiguration impossible to miss.
    echo -e "${RED}Error: FTP_REMOTE_CLUB ('$FTP_REMOTE_CLUB') is not a safe swimly.club document root on the shared account.${NC}"
    echo -e "${RED}       It must be an absolute path below the FTP root (for example /home/USER/swimly.club),${NC}"
    echo -e "${RED}       never '/', '.', or a relative path. Refusing to run 'mirror --delete' against it.${NC}"
    exit 1
else
    CLUB_FTP_HOST="$FTP_HOST"
    CLUB_FTP_USER="$FTP_USER"
    CLUB_FTP_PASS="$FTP_PASS"
    CLUB_SHOULD_DEPLOY="yes"
    echo -e "${YELLOW}==> swimly.club: shared FTP account, root: ${CLUB_REMOTE_TRIMMED}${NC}"
fi

if [[ -n "$CLUB_SHOULD_DEPLOY" ]]; then
    # Step 9: Assemble the swimly.club document root in a clean staging tree.
    echo -e "${YELLOW}==> Assembling swimly.club document root...${NC}"
    rm -rf "$CLUB_DIR"
    mkdir -p "$CLUB_DIR"

    # us/ ca/ au/ keep their path prefix: dist.nosync/us -> CLUB_DIR/us, etc.
    for d in us ca au; do
        if [[ -d "$DIST_DIR/$d" ]]; then
            cp -R "$DIST_DIR/$d" "$CLUB_DIR/$d"
            echo "  + /$d/"
        fi
    done

    # international/ is flattened: its CONTENTS go to the swimly.club root, so
    # international/index.html -> /index.html, international/robots.txt ->
    # /robots.txt, international/sitemap-*.xml -> /sitemap-*.xml.
    if [[ -d "$DIST_DIR/international" ]]; then
        # Trailing /. copies the directory's contents (including dotfiles) rather
        # than the directory itself.
        cp -R "$DIST_DIR/international/." "$CLUB_DIR/"
        echo "  + / (contents of international/)"
    fi

    # Shared build assets every region needs. The CSS/JS bundle lives at the dist
    # root (/_astro/...) and the intl pages also reference root favicons, the social
    # image, the logo and the web manifest. Without these, swimly.club pages would
    # load unstyled and without icons.
    #
    # These have to be listed explicitly: the copy below is `-maxdepth 1 -type f`,
    # so it picks up root FILES but no root DIRECTORY. Anything an intl page loads
    # from a root-relative directory must be named here or it 404s on swimly.club
    # while working fine on swimly.uk. /images/ was missed this way, which broke
    # every product screenshot on the region pages.
    for d in _astro images; do
        if [[ -d "$DIST_DIR/$d" ]]; then
            cp -R "$DIST_DIR/$d" "$CLUB_DIR/$d"
            echo "  + /$d/"
        fi
    done
    # Top-level static files only (favicons, og-image, logo, manifest, llms.txt).
    # Exclude UK page HTML, the UK sitemaps/robots and any .htaccess: the hub
    # (international/) supplies swimly.club's index.html, robots.txt and sitemaps,
    # and a club-specific .htaccess is written below.
    find "$DIST_DIR" -maxdepth 1 -type f \
        ! -name '*.html' ! -name 'sitemap*.xml' ! -name 'robots.txt' ! -name '.htaccess' \
        -exec cp {} "$CLUB_DIR/" \;
    echo "  + shared root assets"

    # Same critical permission fix as the UK tree, applied to the copied files.
    echo -e "${YELLOW}==> Fixing swimly.club permissions (dirs: 755, files: 644)...${NC}"
    find "$CLUB_DIR" -type d -exec chmod 755 {} \;
    find "$CLUB_DIR" -type f -exec chmod 644 {} \;

    # Slim .htaccess for swimly.club: www -> non-www and force HTTPS. Kept minimal
    # for the same reason as swimly.uk (LiteSpeed cannot digest huge rule sets).
    cat > "$CLUB_DIR/.htaccess" << 'HTACCESS_CLUB'
RewriteEngine On

# Redirect www to non-www
RewriteCond %{HTTP_HOST} ^www\.swimly\.club [NC]
RewriteRule ^(.*)$ https://swimly.club/$1 [L,R=301]

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
HTACCESS_CLUB

    CLUB_FILE_COUNT=$(find "$CLUB_DIR" -type f | wc -l | tr -d ' ')
    echo "  Assembled $CLUB_FILE_COUNT files for swimly.club"

    # Step 10: Upload swimly.club. Mirror with --delete so the remote root matches
    # the freshly assembled tree exactly. The remote path is the trimmed,
    # safety-checked FTP_REMOTE_CLUB from above.
    echo -e "${YELLOW}==> Uploading to $CLUB_FTP_HOST (swimly.club root: $CLUB_REMOTE_TRIMMED)...${NC}"

    LFTP_CLUB_SCRIPT=$(mktemp)
    # Note: no `set cmd:fail-exit no` here. Because this target uses --delete, a
    # partial mirror (files deleted but re-uploads failing) must abort loudly
    # rather than report success. lftp returns non-zero on a failed mirror, and
    # with `set -e` active that aborts the script. The swimly.uk deploy and its
    # manifest are already saved above, so failing here never harms swimly.uk.
    cat > "$LFTP_CLUB_SCRIPT" << LFTP_CLUB_HEADER
set ssl:verify-certificate no
set net:max-retries 3
set net:timeout 20
open -u $CLUB_FTP_USER,'$CLUB_FTP_PASS' ftp://$CLUB_FTP_HOST
LFTP_CLUB_HEADER

    # --delete is safe here: on a dedicated swimly.club account the connection
    # cannot reach swimly.uk at all; on the shared account CLUB_REMOTE_TRIMMED has
    # been validated as a non-root absolute path. Either way --delete only prunes
    # swimly.club's own document root to match the freshly assembled staging tree.
    echo "mirror -R --delete --parallel=10 --no-perms --no-symlinks \"$CLUB_DIR/\" \"$CLUB_REMOTE_TRIMMED\"" >> "$LFTP_CLUB_SCRIPT"
    echo "quit" >> "$LFTP_CLUB_SCRIPT"

    run_lftp "$LFTP_CLUB_SCRIPT"
    rm -f "$LFTP_CLUB_SCRIPT"
    # Remove the staging tree so it does not linger in the working directory.
    rm -rf "$CLUB_DIR"

    echo -e "${GREEN}==> swimly.club deploy complete: https://swimly.club${NC}"
fi

# =============================================================================
# TARGET 3: swimly.info -> swimly.club (redirect only, optional)
# Best handled at the host/DNS level (a 301 from swimly.info to swimly.club). If
# swimly.info is an addon domain on this account, set FTP_REMOTE_INFO to its
# document root and we deploy a one-file redirect .htaccess there.
# =============================================================================
echo ""
echo -e "${GREEN}==> Target: swimly.info (redirect)${NC}"

if [[ -z "$FTP_REMOTE_INFO" ]]; then
    echo -e "${YELLOW}==> FTP_REMOTE_INFO is not set. Skipping swimly.info redirect.${NC}"
    echo -e "${YELLOW}    Prefer a host/DNS-level 301 from swimly.info to swimly.club.${NC}"
else
    echo -e "${YELLOW}==> Deploying swimly.info redirect to $FTP_REMOTE_INFO...${NC}"

    INFO_DIR="$SCRIPT_DIR/dist-info.nosync"
    rm -rf "$INFO_DIR"
    mkdir -p "$INFO_DIR"

    # 301 every request on swimly.info to the same path on swimly.club.
    cat > "$INFO_DIR/.htaccess" << 'HTACCESS_INFO'
RewriteEngine On

# Permanent redirect: swimly.info (and www) -> swimly.club, preserving the path
RewriteCond %{HTTP_HOST} ^(www\.)?swimly\.info [NC]
RewriteRule ^(.*)$ https://swimly.club/$1 [L,R=301]
HTACCESS_INFO

    find "$INFO_DIR" -type d -exec chmod 755 {} \;
    find "$INFO_DIR" -type f -exec chmod 644 {} \;

    LFTP_INFO_SCRIPT=$(mktemp)
    cat > "$LFTP_INFO_SCRIPT" << LFTP_INFO_HEADER
set ssl:verify-certificate no
set cmd:fail-exit no
set net:max-retries 3
set net:timeout 20
open -u $FTP_USER,'$FTP_PASS' ftp://$FTP_HOST
LFTP_INFO_HEADER

    # No --delete: we only manage the redirect file, leaving anything else alone.
    # Because there is no --delete, a wrong FTP_REMOTE_INFO at worst fails to
    # upload; it cannot prune a remote tree, so no safety guard is needed here.
    echo "mirror -R --parallel=2 --no-perms --no-symlinks \"$INFO_DIR/\" \"$FTP_REMOTE_INFO\"" >> "$LFTP_INFO_SCRIPT"
    echo "quit" >> "$LFTP_INFO_SCRIPT"

    run_lftp "$LFTP_INFO_SCRIPT"
    rm -f "$LFTP_INFO_SCRIPT"
    # Remove the staging tree so it does not linger in the working directory.
    rm -rf "$INFO_DIR"

    echo -e "${GREEN}==> swimly.info redirect deployed${NC}"
fi

echo ""
echo -e "${GREEN}==> All deploy targets processed.${NC}"
