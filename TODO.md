# TODO

## Repo Notes

- Static personal website built with Jekyll and GitHub Pages.
- Main config: `_config.yml`.
- Ruby dependencies: `Gemfile` / `Gemfile.lock`.
- Content lives in:
  - `pages/`
  - `_projects/`
  - `_articles/`
  - `_posts/`
- Layout and components live in:
  - `_layouts/`
  - `_includes/`
  - `_sass/`
- Generated site output is `_site/`, ignored by git.
- No GitHub Actions workflow is currently present.

## Run And Test

- Serve locally:

  ```bash
  bundle exec jekyll serve
  ```

- Build:

  ```bash
  bundle exec jekyll build
  ```

- Local generated-HTML check:

  ```bash
  bundle exec htmlproofer _site --disable-external true
  ```

- `jekyll build` passes when network is available for `remote_theme`.
- Expected non-fatal warning:

  ```text
  GitHub Metadata: No GitHub API authentication could be found.
  ```

## Current HTML-Proofer Issues

- `_includes/articles/article-card.html` repeats an invalid stylesheet tag inside every article card:

  ```html
  <link src="http://maxcdn.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css" rel="stylesheet">
  ```

  Font Awesome is already loaded in `_includes/head.html`, so this line can likely be removed.

- Some `EUflag.jpg` images are missing `alt` attributes.
- Demo `_elements/` pages have sample missing-link/hash failures.

## Homepage Ball Animation

- Homepage route is `pages/index.md`.
- `pages/index.md` includes `_includes/landing.html`.
- `_includes/landing.html` creates the animation target:

  ```html
  <div id="particles-js"></div>
  ```

- `_includes/scripts.html` loads:
  - `assets/js/particles.min.js`: third-party particles.js library.
  - `assets/js/main.js`: local initialization/config.
- The moving balls are configured in `assets/js/main.js` via:

  ```js
  particlesJS('particles-js', { ... });
  ```

- Relevant config fields in `assets/js/main.js`:
  - `particles.number.value`: ball count.
  - `particles.color.value`: ball colors.
  - `particles.shape.type`: currently `circle`.
  - `particles.opacity`: opacity and fade behavior.
  - `particles.size`: ball size.
  - `particles.line_linked`: links between balls, currently disabled.
  - `particles.move`: speed, randomness, bounce/out mode.
  - `interactivity.events.onhover`: hover behavior, currently `push`.

- CSS sizing/layering for the animation is in `_sass/_landing.scss`:
  - `#particles-js`
  - `.particles-js-canvas-el`
