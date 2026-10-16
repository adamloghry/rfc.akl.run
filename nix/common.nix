# Shared pieces for the package, checks, apps and dev shell.
{ pkgs, self }:
let
  inherit (pkgs) lib;

  # The Nix-provided tools must match the versions package-lock.json pins for the npm packages
  # of the same name, otherwise `nix flake check` and `npm run ...` would test different tools.
  lock = lib.importJSON ../package-lock.json;
  locked = name: lock.packages."node_modules/${name}".version;
  sameVersion =
    what: nixpkgsVersion: npmName:
    lib.asserts.assertMsg (nixpkgsVersion == locked npmName) ''
      Version mismatch: pkgs.${what} is ${nixpkgsVersion} but package-lock.json pins ${npmName} ${locked npmName}.
      Either move the flake's nixpkgs input to a revision that carries ${locked npmName} (nix flake update nixpkgs),
      or change the ${npmName} version in package.json and package-lock.json to ${nixpkgsVersion}.
    '';

  # Only what the build reads; keeps rebuilds from touching unrelated files.
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.difference (lib.fileset.fromSource (lib.cleanSource ../.)) (
      lib.fileset.unions [
        (lib.fileset.maybeMissing ../dist)
        (lib.fileset.maybeMissing ../node_modules)
        (lib.fileset.maybeMissing ../tmp)
        (lib.fileset.maybeMissing ../.cache)
        (lib.fileset.maybeMissing ../.work)
        (lib.fileset.maybeMissing ../.astro)
        (lib.fileset.maybeMissing ../.wrangler)
        (lib.fileset.maybeMissing ../.superpowers)
        (lib.fileset.maybeMissing ../.claude)
        (lib.fileset.maybeMissing ../.idea)
        (lib.fileset.maybeMissing ../.vscode)
        (lib.fileset.maybeMissing ../result)
      ]
    );
  };

  # Bump this (copy the "got:" hash from the failing build) after changing package-lock.json.
  npmDepsHash = "sha256-m9chiRwRHElBSzB89cwwKP0nfmANpYJbHidGsOtfuxE=";

  # The build date (src/lib/build-date.ts) derives from the commit time, so builds are reproducible.
  # Git checkouts (and dirty trees) carry lastModified; anything else (a tarball without it) is an
  # error rather than a silent 1970 build date.
  sourceDateEpoch =
    self.lastModified or (throw ''
      rfc.akl.run: the flake source has no lastModified (not a git checkout?), so SOURCE_DATE_EPOCH, and with it
      the site's build date, cannot be derived. Build from a git checkout or a github:/git+file: flake reference.
    '');

  # The RFC index is the committed snapshot data/rfc-index.xml (inside src), so builds never need the network.
  buildEnv = {
    ASTRO_TELEMETRY_DISABLED = "1";
    SOURCE_DATE_EPOCH = toString sourceDateEpoch;
  };
in
assert sameVersion "wrangler" pkgs.wrangler.version "wrangler";
assert sameVersion "playwright-driver" pkgs.playwright-driver.version "@playwright/test";
assert sameVersion "biome" pkgs.biome.version "@biomejs/biome";
{
  inherit
    src
    npmDepsHash
    buildEnv
    ;
  wranglerBin = lib.getExe pkgs.wrangler;
  packageVersion = (lib.importJSON ../package.json).version;
}
