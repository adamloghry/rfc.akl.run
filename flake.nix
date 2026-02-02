{
  description = "rfc.akl.run - A cool RFC viewer website";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        site = pkgs.stdenv.mkDerivation {
          pname = "rfc-akl-run";
          version = "1.0.0";

          src = ./site;

          installPhase = ''
            mkdir -p $out
            cp -r ./* $out/
          '';
        };
      in
      {
        packages = {
          default = site;
          site = site;
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            python3
            nodePackages.live-server
          ];

          shellHook = ''
            echo "rfc.akl.run dev shell"
            echo "Run 'python3 -m http.server 8080 --directory site' to preview"
          '';
        };

        apps.default = {
          type = "app";
          program = toString (pkgs.writeShellScript "serve-rfc" ''
            ${pkgs.python3}/bin/python3 -m http.server 8080 --directory ${site}
          '');
        };
      }
    );
}
