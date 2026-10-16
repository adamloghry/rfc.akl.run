{
  description = "rfc.akl.run - static RFC explainer site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  # There is deliberately no `packages.*` output. Nix builds are sandboxed with no
  # network, but the build needs the live RFC Editor index (fetched and cached to
  # .cache/, never committed) and npm dependencies. A derivation could not produce
  # the real site, so builds run in the working tree via `npm` / `nix run`.
  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_22
          ];

          shellHook = ''
            echo "rfc.akl.run dev shell (Astro 7, Node >= 22.22): npm ci && npm run dev"
          '';
        };

        apps.default = {
          type = "app";
          program = toString (pkgs.writeShellScript "serve-rfc" ''
            set -euo pipefail
            export PATH=${pkgs.lib.makeBinPath [ pkgs.nodejs_22 ]}:$PATH
            npm ci
            npm run build
            npm run preview
          '');
        };
      }
    );
}
