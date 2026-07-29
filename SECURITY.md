# Security policy

## Supported versions

This repository is a portfolio demonstration. Security fixes are applied to the
latest version on the default branch.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Contact the repository
owner privately through the contact information on their GitHub profile and
include:

- the affected endpoint or component;
- steps to reproduce;
- expected and observed behavior;
- potential impact;
- a suggested mitigation, if available.

Please do not include real credentials, personal information, production model
artifacts, or private datasets.

## Demonstration limitations

The included accounts, model artifacts, storage addresses, workers, metrics, and
datasets are fictional. The default JWT secret and demo password are intentionally
public for local evaluation and must never be reused in a deployed environment.

Before production use, add secret management, refresh-token rotation, MFA, network
policy, TLS termination, backup and recovery procedures, vulnerability scanning,
distributed scheduler coordination, signed artifacts, and an organization-specific
security review.
