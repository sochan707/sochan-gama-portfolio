# Sochan's GAMA portfolio

Static portfolio and browser adaptations of GAMA models. The complete website is in `dist/`; no build step is required.

## GitHub Pages hosting

1. Sign into GitHub CLI with `gh auth login --hostname github.com --web`.
2. Create a public GitHub repository for this project and push the `main` branch, including `.github/workflows/pages.yml` and `dist/`.
3. In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
4. Run **Deploy portfolio to GitHub Pages** from the **Actions** tab, or push a new commit to `main`.

The deployment publishes only `dist/`. Subsequent pushes to `main` publish updates automatically. Relative asset URLs support both a repository URL (`https://sochan707.github.io/REPOSITORY/`) and a user site (`https://sochan707.github.io/` when the repository is named `sochan707.github.io`).

See [GitHub's Pages configuration guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Local preview

From this directory, run `python3 -m http.server 8000 --directory dist` and open `http://localhost:8000`.
