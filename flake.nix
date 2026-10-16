{
  description = "rfc.akl.run - static RFC explainer site";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        common = import ./nix/common.nix { inherit pkgs self; };
        site = pkgs.callPackage ./nix/package.nix { inherit common; };
        appsFor = (import ./nix/apps.nix { inherit pkgs common; }).mkApps;
      in
      {
        packages = {
          default = site;
          inherit site;
        };

        checks = import ./nix/checks.nix { inherit pkgs common site; };

        devShells.default = import ./nix/shell.nix { inherit pkgs common; };

        apps = appsFor site;

        # For sites built with a different input: lib.<system>.mkApps (site.override { beaconToken = "..."; }).
        lib.mkApps = appsFor;

        # `nix fmt` formats flake.nix and nix/*.nix. Arguments are passed to nixfmt (e.g. `nix fmt -- --check`);
        # when none of them is an existing path, the repository's Nix files are appended.
        formatter = pkgs.writeShellScriptBin "rfc-nixfmt" ''
          for a in "$@"; do
            if [ -e "$a" ]; then exec ${pkgs.nixfmt}/bin/nixfmt "$@"; fi
          done
          exec ${pkgs.nixfmt}/bin/nixfmt "$@" flake.nix nix/*.nix
        '';
      }
    );
}
