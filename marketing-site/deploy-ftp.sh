#!/usr/bin/env bash
set -euo pipefail

# Always use this entry point: the host needs readable file permissions.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
case "${1:-}" in
  '') dry_run=false ;;
  --dry-run) dry_run=true ;;
  *) echo 'Usage: ./deploy-ftp.sh [--dry-run]' >&2; exit 2 ;;
esac

npm --prefix "$SCRIPT_DIR" run build
npm --prefix "$SCRIPT_DIR" run verify:site
find "$SCRIPT_DIR/dist.nosync" -type d -exec chmod 755 {} +
find "$SCRIPT_DIR/dist.nosync" -type f -exec chmod 644 {} +

if [[ "$dry_run" == true ]]; then
  echo 'Tumblebase build verified and permissions set. No connection or upload made.'
  exit 0
fi

: "${TUMBLEBASE_FTP_HOST:?Set the dedicated Tumblebase FTP host}"
: "${TUMBLEBASE_FTP_USER:?Set the dedicated Tumblebase FTP user}"
: "${TUMBLEBASE_FTP_PASS:?Set the dedicated Tumblebase FTP password}"
: "${TUMBLEBASE_FTP_ROOT:?Set the Tumblebase document root}"
export TUMBLEBASE_FTP_HOST TUMBLEBASE_FTP_USER TUMBLEBASE_FTP_PASS TUMBLEBASE_FTP_ROOT

python3 - "$SCRIPT_DIR/dist.nosync" <<'PY'
import ftplib
import os
from pathlib import Path, PurePosixPath
import ssl
import sys

host = os.environ['TUMBLEBASE_FTP_HOST']
user = os.environ['TUMBLEBASE_FTP_USER']
remote = os.environ['TUMBLEBASE_FTP_ROOT']
if any(x in (host + ' ' + user).lower() for x in ['swimly', 'monsieur-clawde', 'ftp.michaeltempest.com']):
    raise SystemExit('Refusing an inherited hosting account. Use dedicated Tumblebase hosting.')
if not remote.startswith('/') or '..' in PurePosixPath(remote).parts:
    raise SystemExit('The document root must be an absolute path without parent traversal.')
source = Path(sys.argv[1])
try:
    with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=30) as ftp:
        ftp.connect(host)
        ftp.login(user, os.environ['TUMBLEBASE_FTP_PASS'])
        ftp.prot_p()
        ftp.cwd(remote)
        root = ftp.pwd()
        ftp.sendcmd('SITE CHMOD 755 .')
        count = 0
        for file in sorted(source.rglob('*')):
            if not file.is_file() or file.is_symlink():
                continue
            relative = file.relative_to(source)
            ftp.cwd(root)
            for part in relative.parts[:-1]:
                try:
                    ftp.cwd(part)
                except ftplib.error_perm:
                    ftp.mkd(part)
                    ftp.cwd(part)
                ftp.sendcmd('SITE CHMOD 755 .')
            with file.open('rb') as stream:
                ftp.storbinary('STOR ' + relative.name, stream)
            ftp.sendcmd('SITE CHMOD 644 ' + relative.name)
            count += 1
        print(f'Uploaded {count} Tumblebase files over verified FTPS. No remote files deleted.')
except Exception:
    raise SystemExit('Tumblebase upload failed. Check dedicated credentials, TLS, document root and host permissions. No secrets were logged.') from None
PY
