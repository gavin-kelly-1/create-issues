<h3 align="center">Create an Issue Action</h3>
<p align="center">A GitHub Action that creates a new issue using a template file.<p>
<p align="center"><a href="https://github.com/JasonEtco/create-an-issue"><img alt="GitHub Actions status" src="https://github.com/JasonEtco/create-an-issue/workflows/Node%20CI/badge.svg"></a> <a href="https://codecov.io/gh/JasonEtco/create-an-issue/"><img src="https://badgen.now.sh/codecov/c/github/JasonEtco/create-an-issue" alt="Codecov"></a></p>

## Usage

This GitHub Action creates a new list of issues based on an issue template file. Here's an example workflow that creates a new issue any time you push a commit:

```yaml
on:
  push:
    tags:        
      - v0.0.0
  workflow_dispatch:
name: Create a list of issues
permissions:
  contents: read
  issues: write 
jobs:
  create:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: macroscian/create-issues@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          json: .github/issues.json
```

This reads from the `.github/issues.json` file. It's based on an
action JasonEtco/create-an-issue
