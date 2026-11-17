# Security

HookViz is a static site. It has no accounts, no database and no server, so the main risks are:

- a way to run code on the maintainer's machine or in CI through an example or a trace,
- a way to get around the checks in `scripts/check-examples.mjs`,
- a script injection into the site.

Please report these **privately** with GitHub's "Report a vulnerability" button on the Security tab of this repository, and do not open a public issue. You should get a reply within a week.
