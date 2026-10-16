# The built static site: $out is the contents of dist/.
# Overridable: `site.override { beaconToken = "..."; }` bakes the Cloudflare Web Analytics token into the
# pages and the CSP (see docs/cloudflare.md). The default, an empty string, builds without analytics.
{
  lib,
  buildNpmPackage,
  nodejs_22,
  common,
  beaconToken ? "",
}:
buildNpmPackage (
  common.buildEnv
  // lib.optionalAttrs (beaconToken != "") { PUBLIC_CF_BEACON_TOKEN = beaconToken; }
  // {
    pname = "rfc-akl-run-site";
    version = common.packageVersion;
    inherit (common) src npmDepsHash;
    nodejs = nodejs_22;
    npmBuildScript = "build";
    doCheck = true;
    checkPhase = ''
      runHook preCheck
      npm run preflight
      runHook postCheck
    '';
    installPhase = ''
      runHook preInstall
      cp -r dist $out
      runHook postInstall
    '';
    # Static content only: no store-path rewriting of the HTML.
    dontFixup = true;
  }
)
