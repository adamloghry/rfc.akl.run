{ pkgs, common }:
pkgs.mkShell {
  packages = [
    pkgs.wrangler
    pkgs.nodejs_22
    pkgs.biome
    pkgs.nixfmt
  ];

  env = {
    # npm prepends node_modules/.bin to PATH for `npm run`, which shadows the nixpkgs wrangler with the npm one
    # (its workerd is not patched for NixOS). The npm scripts and Playwright use $WRANGLER_BIN instead.
    WRANGLER_BIN = common.wranglerBin;
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "1";
    WRANGLER_SEND_METRICS = "false";
    ASTRO_TELEMETRY_DISABLED = "1";
  };

  shellHook = ''
    cat <<'EOF'
    rfc.akl.run dev shell (Node 22, wrangler, biome, Playwright browsers)
      npm ci                  install dependencies
      npm run dev             Astro dev server
      npm run build           build dist/ (reads the committed data/rfc-index.xml; no network)
      npm test                unit tests        npm run lint   content lint
      npm run check:types     astro check       npm run lint:code   biome
      npm run test:e2e        Playwright        npm run preview:cf  wrangler dev
      npm run refresh-index   refresh data/rfc-index.xml from rfc-editor.org
      nix build               build the site hermetically
      nix flake check -L      run every check
      nix run                 serve the Nix-built site    nix run .#deploy
    EOF
  '';
}
