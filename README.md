# paolodeangelis.github.io

Personal academic portfolio and project website built with Jekyll and served through GitHub Pages.

## Contents

The repository contains:

- Homepage content and layout.
- Project pages in `_projects/`.
- Article/publication pages in `_articles/`.
- Blog posts in `_posts/`.
- Shared layouts in `_layouts/`.
- Shared page fragments in `_includes/`.
- Theme styles in `_sass/` and `assets/css/`.
- JavaScript assets in `assets/js/`.
- Images and visual assets in `img/`.
- Supporting documents in `docs/`.
- Benchmark and maintenance scripts in `scripts/`.

## Local Development

Install Ruby dependencies:

```bash
bundle install
```

Build the site:

```bash
bundle exec jekyll build
```

Serve locally:

```bash
bundle exec jekyll serve
```

The local site is usually available at:

```text
http://127.0.0.1:4000/
```

If port `4000` is busy, use another port:

```bash
bundle exec jekyll serve --port 4001
```

## Site Configuration

Main site settings are in `_config.yml`.

Common fields:

- `title`: site title.
- `description`: homepage description.
- `author`: profile image, email, and social accounts.
- `analytics`: Google Analytics settings.
- `collections`: configured content collections.
- `exclude`: files kept in the repository but not copied into the generated site.

## Adding A Project

Add a Markdown file under `_projects/`.

Use existing files in `_projects/` as templates. A typical project file contains front matter such as:

```yaml
---
name: Project Name
tools:
  - Python
  - Jekyll
image: ../img/example.png
---
```

Then write the project content in Markdown below the front matter.

## Adding An Article

Add a Markdown file under `_articles/`.

Use the existing article files as templates. Keep metadata fields consistent so the article listing and filters continue to work.

## Adding A Blog Post

Add a Markdown file under `_posts/` using the Jekyll post naming convention:

```text
YYYY-MM-DD-title.md
```

Include front matter at the top of the file:

```yaml
---
layout: post
title: "Post title"
---
```

## Adding Images

Place image assets in `img/`.

For ordinary content images, prefer the existing figure includes:

```liquid
{% include elements/figure.html image="img/example.png" caption="Caption text" %}
```

For images without rounded corners:

```liquid
{% include elements/figure_noround.html image="img/example.png" caption="Caption text" %}
```

Large images should be compressed before publication. The repository includes a manual GitHub Actions workflow named `Optimize images` that can optimize images and commit changed files back to the branch.

## Homepage Animation

The homepage background animation is implemented in:

- `assets/js/main.js`: browser rendering, HUD, input controls.
- `assets/js/lj-md-worker.js`: molecular dynamics simulation.
- `assets/js/lj-force-worker.js`: exact parallel force worker.
- `assets/js/lj-force-worker-optimized.js`: optimized parallel force worker.
- `assets/js/lj-force-worker-approx.js`: approximate lookup-table force worker.

Main simulation constants are at the top of `assets/js/lj-md-worker.js`.

Main display/HUD constants are at the top of `assets/js/main.js`.

## Performance Scripts

Scripts under `scripts/` are for local benchmarking and maintenance. They are excluded from the generated site.

Useful examples:

```bash
python3 scripts/benchmark_parallel_threshold.py
python3 scripts/benchmark_worker_scalability.py
python3 scripts/plot_force_table_bits_gain.py
```

## Deployment

The site is intended for GitHub Pages. The normal deployment path is controlled by the repository Pages settings.

The image optimization workflow does not require a private deploy key in the normal setup. It uses the built-in `GITHUB_TOKEN` with `contents: write` permission to commit optimized images. If repository rules prevent GitHub Actions from pushing to the branch, use either a pull-request workflow or a personal access token configured as a repository secret.

## Notes

`README.md`, `TODO.md`, `WEB_PERFORMANCE_REPORT.md`, and `scripts/` are excluded from the built site through `_config.yml`.
