# Security policy

Hyphasma is files in your repo: the linters and CLI run locally, nothing
phones home, and there is no service component. The most likely security
issues are path handling in the linters, the bootstrap writing where it
should not, or a malicious vault crafted to exploit a check.

## Reporting

Please report vulnerabilities privately via
[GitHub security advisories](https://github.com/geektechniquestudios/hyphasma/security/advisories/new)
rather than a public issue. You should hear back within a few days. Fixes
ship as a patch release with credit if you want it.

## Supported versions

The latest release and `main`/`develop` tips are supported. Older tags are
not patched; upgrade instead.
