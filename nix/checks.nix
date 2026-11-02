# `nix flake check` derivations. All reuse the fixed-output npm cache of the site package.
{
  pkgs,
  common,
  site,
}:
let
  inherit (pkgs) lib;

  mk =
    name: script: extra:
    pkgs.stdenvNoCC.mkDerivation (
      common.buildEnv
      // {
        name = "rfc-akl-run-${name}";
        inherit (common) src;
        inherit (site) npmDeps;
        nativeBuildInputs = [
          pkgs.nodejs_22
          pkgs.npmHooks.npmConfigHook
        ]
        ++ (extra.nativeBuildInputs or [ ]);
        dontBuild = true;
        doCheck = true;
        checkPhase = ''
          runHook preCheck
          ${script}
          runHook postCheck
        '';
        installPhase = "touch $out";
      }
      // (removeAttrs extra [ "nativeBuildInputs" ])
    );

  nixFiles = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.fileFilter (f: f.hasExt "nix") ../.;
  };
in
{
  # dist/ from the Nix build lets the two dist-dependent tests run instead of skipping; coverage thresholds are enforced.
  unit = mk "unit" ''
    cp -r ${site} dist && chmod -R u+w dist
    npm run test:coverage
  '' { };
  lint = mk "lint" "npm run lint" { };
  types = mk "types" "npm run check:types" { };
  code-style = mk "code-style" "biome check ." { nativeBuildInputs = [ pkgs.biome ]; };

  # Building the package runs `npm run build` and `npm run preflight`.
  site = site;

  e2e =
    mk "e2e"
      ''
        # Serve the Nix-built site with the nixpkgs wrangler (workerd is patched there).
        export HOME=$TMPDIR
        rm -rf dist && cp -r ${site} dist && chmod -R u+w dist
        export WRANGLER_SEND_METRICS=false
        npm run test:e2e
      ''
      {
        nativeBuildInputs = [ pkgs.wrangler ];
        PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
        PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1";
        WRANGLER_BIN = common.wranglerBin;
        # The sandbox has no fontconfig: without a fonts config Chromium fails web-font loads and has no
        # fallback face, so text boxes collapse to zero height and visibility assertions fail.
        FONTCONFIG_FILE = pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; };
      };

  formatting = pkgs.runCommandLocal "rfc-akl-run-nixfmt" { nativeBuildInputs = [ pkgs.nixfmt ]; } ''
    cd ${nixFiles}
    nixfmt --check flake.nix nix/*.nix
    touch $out
  '';
}
