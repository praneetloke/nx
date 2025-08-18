---
title: Configuring CI Using Buildkite and Nx
description: Learn how to set up Buildkite for your Nx workspace to run affected commands, retrieve previous successful builds, and optimize CI performance.
---

# Configuring CI Using Buildkite and Nx

Below is an example of a Buildkite setup, building, and testing only what is affected.

```yaml {% fileName=".buildkite/pipeline.yml" %}
steps:
  - label: "Run nx affected"
    commands:
      # NX_BASE AND NX_HEAD env vars will be set by
      # the nx-set-shas plugin.
      - npx nx affected -t lint test build
    plugins:
      - secrets:
          variables:
            GRAPHQL_API_TOKEN: GRAPHQL_API_TOKEN
      - nx-set-shas
```

### Get the Commit of the Last Successful Build

Buildkite GraphQL API can be used to get the last successful run on the `main` branch and use this as a reference point for `NX_BASE`. The [nx-set-shas](https://github.com/buildkite-plugins/nx-set-shas-buildkite-plugin) plugin provides a convenient implementation of this functionality, which you can drop into your existing CI pipeline.

To understand why knowing the last successful build is important for the affected command, check out the in-depth explanation in the docs for the [`affected`](https://nx.dev/ci/features/affected) as well as the background in the README of another CI service: https://github.com/nrwl/nx-set-shas?tab=readme-ov-file#background. 
