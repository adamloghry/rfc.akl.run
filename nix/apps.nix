{ pkgs, common }:
let
  wrangler = common.wranglerBin;
  mkApp = name: text: {
    type = "app";
    program = "${pkgs.writeShellScriptBin name ''
      set -euo pipefail
      ${text}
    ''}/bin/${name}";
  };
in
{
  # Apps for a given build of the site; flake.nix instantiates them for the default package and
  # exposes `lib.<system>.mkApps` so a site built with `.override { beaconToken = ...; }` can be served or deployed.
  mkApps =
    site:
    let
      # wrangler.jsonc points assets.directory at ./dist; run it from a temp dir holding a symlink to the
      # store output plus the same config, so nothing is copied and the store stays read-only.
      # Wrangler runs as a child (no exec) so the EXIT trap removes the temp dir; INT/TERM are forwarded to it.
      run = sub: ''
        work=$(mktemp -d)
        child=""
        trap 'rm -rf "$work"' EXIT
        trap '[ -z "$child" ] || kill -TERM "$child" 2>/dev/null || true' INT TERM
        ln -s ${site} "$work/dist"
        cp ${../wrangler.jsonc} "$work/wrangler.jsonc"
        cd "$work"
        export WRANGLER_SEND_METRICS=false
        ${sub} &
        child=$!
        status=0
        wait "$child" || status=$?
        # A trapped signal interrupts the first wait; wait again until wrangler has really exited.
        while kill -0 "$child" 2>/dev/null; do wait "$child" || status=$?; done
        exit "$status"
      '';
    in
    rec {
      default = mkApp "rfc-serve" (run ''${wrangler} dev --local --port "''${PORT:-8787}" "$@"'');
      serve = default;
      deploy = mkApp "rfc-deploy" (run ''${wrangler} deploy "$@"'');
      preview-deploy = mkApp "rfc-preview-deploy" (run ''${wrangler} versions upload "$@"'');

      # Fetches the RFC Editor index into the committed snapshot data/rfc-index.xml (the only networked step).
      # Runs in the repository checkout and needs node_modules (`npm ci`) for tsx and the XML parser.
      refresh-index = mkApp "rfc-refresh-index" ''
        root=$(${pkgs.git}/bin/git rev-parse --show-toplevel 2>/dev/null || pwd)
        cd "$root"
        if [ ! -d node_modules/tsx ]; then
          echo "refresh-index: node_modules is missing; run 'npm ci' first (nix develop -c npm ci)" >&2
          exit 1
        fi
        ${pkgs.nodejs_22}/bin/node --import tsx scripts/refresh-index.ts "$@"
      '';
    };
}
