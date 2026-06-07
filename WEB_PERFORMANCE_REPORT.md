# Web Performance Report

Generated from the current repository state.

## Highest Impact

1. Optimize large images.
   - `img/short_image.png` is about 1.1 MB and is loaded on the homepage below the hero.
   - `img/2024-img_article_Enhancing_ReaxFF.png` is about 728 KB.
   - `img/2021-img_article_water_energy_nexsus.png` is about 544 KB.
   - Convert large PNG/JPG assets to WebP or AVIF, keep originals only if needed, and use responsive `srcset` sizes.

2. Avoid loading MathJax on every page.
   - `_includes/head.html` loads MathJax globally.
   - Most pages probably do not need equation rendering.
   - Add a page flag such as `math: true`, then include MathJax only on pages/articles that need it.

3. Reduce critical CSS and blocking CSS.
   - Bootstrap CSS is loaded from CDN in `_includes/head.html` and remains render-blocking.
   - `assets/css/style.css` is also render-blocking and includes the theme CSS.
   - For the homepage, inline a small critical CSS block for the hero/header and defer the rest.

4. Replace or self-host third-party CDN assets.
   - Current external requests include Bootstrap CSS, Font Awesome CSS, Animate.css, MathJax, jQuery, Popper, Bootstrap JS, WOW.js, GitHub buttons, Google Analytics.
   - Each external origin adds DNS/TLS/latency cost.
   - Self-host stable libraries where possible, or remove unused ones.

5. Enable compression and long cache headers at the host/CDN level.
   - Jekyll cannot enable gzip/Brotli by itself.
   - GitHub Pages usually serves compressed text assets, but local WEBrick does not.
   - If using another host, enable Brotli/gzip for HTML, CSS, JS, SVG, JSON, and fonts.

## Homepage Specific

1. The LJ animation is CPU-bound after load.
   - It runs `assets/js/main.js`, `assets/js/lj-md-worker.js`, and force worker files.
   - Keep `LJ_MD_TARGET_FPS`, `LJ_MD_STEPS_PER_FRAME`, `LJ_MD_PARTICLE_COUNT`, and `LJ_MD_MAX_PARTICLE_COUNT` conservative for mobile.
   - Consider disabling parallel workers below about 500 particles, because worker copies can cost more than serial force evaluation.

2. `particles.min.js` is still loaded as fallback.
   - It is useful for fallback, but it is loaded even when LJ MD is active.
   - Possible improvement: load `particles.min.js` dynamically only if the LJ worker fails.

3. `sweet-scroll.min.js` is small, but still globally loaded.
   - Keep it if smooth anchor scrolling is important.
   - Otherwise replace with native CSS `scroll-behavior: smooth`.

4. The homepage image has dimensions and `fetchpriority="high"`.
   - Good current state.
   - Next improvement is to serve a smaller WebP/AVIF version for the circular portrait.

## JavaScript

1. jQuery, Popper, and Bootstrap JS are loaded globally.
   - If the site only uses Bootstrap CSS and a few tooltips, remove Bootstrap JS or load it only on pages that require it.
   - If tooltips are rare, replace with native `title` or a small custom tooltip.

2. WOW.js and Animate.css are loaded globally.
   - If scroll animations are not critical, remove both.
   - If kept, load them only on pages with `.wow` elements.

3. GitHub buttons are loaded globally.
   - `_includes/scripts.html` loads `https://buttons.github.io/buttons.js`.
   - Load it only on pages that actually render GitHub buttons.

4. `articles.js` in `_layouts/articles_page.html` is not deferred.
   - Add `defer` unless the script must run before parsing finishes.

## CSS And Fonts

1. Font Awesome CSS comes from CDN while local Font Awesome font files also exist.
   - Choose one path.
   - Self-hosting can reduce third-party latency and gives cache control.

2. `assets/css/devicon.min.css` and devicon fonts are sizable.
   - Load devicon only on pages that show skill icons.
   - Consider subsetting icons if only a small set is used.

3. Old copy/new include files remain in `_includes`.
   - Examples: `_includes/head copy.html`, `_includes/scripts.new.html`, `_includes/landing.new.html`, `_includes/landing copy.html`.
   - Jekyll will not render them unless included, but they add maintenance noise and can confuse future audits.

## Images

1. Add `loading="lazy"` and `decoding="async"` everywhere except the first viewport hero image.
   - The figure includes already do this.
   - `_includes/elements/carousel.html` still lacks these attributes.

2. Add explicit width and height to repeated image components.
   - This reduces layout shift.
   - Existing figure includes do not know image dimensions, so consider adding optional include parameters.

3. Use responsive image variants.
   - For article cards and project cards, generate small thumbnails instead of serving full-size article images.

## Network And Hosting

1. Avoid redirects.
   - Ensure canonical URLs, CDN URLs, and `baseurl` produce final URLs directly.

2. Compression.
   - Verify production response headers for `content-encoding: br` or `gzip`.
   - Local Jekyll/WEBrick commonly reports "no compression"; that is expected locally.

3. Cache policy.
   - Static assets should have long cache lifetimes.
   - Fingerprinting would make this safer, but GitHub Pages/Jekyll setup currently uses stable filenames.

## Suggested Implementation Order

1. Convert the largest images to WebP/AVIF and update includes to use responsive image markup.
2. Load MathJax only on pages with math.
3. Dynamically load `particles.min.js` only as fallback.
4. Remove or conditionally load WOW.js, Animate.css, GitHub buttons, Bootstrap JS, and jQuery.
5. Self-host or remove Font Awesome CDN dependency.
6. Add `defer` to `articles.js`.
7. Add a mobile cap for LJ MD particle count or reduce FPS/steps on small screens.
