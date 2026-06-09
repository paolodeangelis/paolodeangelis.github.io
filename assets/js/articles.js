document.addEventListener('DOMContentLoaded', function() {
    const articlesContainer = document.getElementById('articles-container');
    const cardViewBtn = document.getElementById('card-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    const articleSearch = document.getElementById('article-search');
    const articleSort = document.getElementById('article-sort');
    const articleItems = Array.from(document.querySelectorAll('.article-item')); // Get all article items
    let currentView = 'card';

    articleItems.forEach(item => {
        const authorElement = item.querySelector('.article-author');
        if (authorElement) {
            authorElement.dataset.fullAuthorHtml = authorElement.innerHTML.trim();
        }
    });

    function stripTags(html) {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || div.innerText || '';
    }

    function shortenAuthorHtml(html) {
        const normalizedHtml = html.replace(/\s+/g, ' ').trim();
        const text = stripTags(normalizedHtml).replace(/\s+/g, ' ').trim();
        const authors = normalizedHtml.split(/\s*,\s*/).filter(author => author.length > 0);

        if (authors.length <= 3 && text.length <= 90) {
            return normalizedHtml;
        }

        const paoloIndex = authors.findIndex(author => stripTags(author).toLowerCase().includes('paolo de angelis'));

        if (paoloIndex >= 0) {
            if (paoloIndex < authors.length - 1) {
                return authors.slice(0, paoloIndex + 1).join(', ') + ' et al.';
            }
            return normalizedHtml;
        }

        return authors[0] + ' et al.';
    }

    function updateAuthorDisplay() {
        articleItems.forEach(item => {
            const authorElement = item.querySelector('.article-author');
            if (!authorElement || !authorElement.dataset.fullAuthorHtml) {
                return;
            }

            authorElement.innerHTML = currentView === 'list' ?
                shortenAuthorHtml(authorElement.dataset.fullAuthorHtml) :
                authorElement.dataset.fullAuthorHtml;
        });
    }

    function clearYearHeaders() {
        articlesContainer.querySelectorAll('.article-year-group').forEach(header => header.remove());
    }

    function insertYearHeaders() {
        clearYearHeaders();

        if (currentView !== 'list') {
            return;
        }

        let currentYear = null;
        Array.from(articlesContainer.querySelectorAll('.article-item')).forEach(item => {
            const year = item.getAttribute('data-year');

            if (!year || year === currentYear) {
                return;
            }

            currentYear = year;
            const header = document.createElement('div');
            header.className = 'article-year-group';
            header.textContent = year;
            articlesContainer.insertBefore(header, item);
        });
    }

    function applyViewMode() {
        if (currentView === 'list') {
            articlesContainer.classList.remove('card-columns');
            articlesContainer.classList.add('articles-list');
            cardViewBtn.classList.remove('active');
            listViewBtn.classList.add('active');
        } else {
            articlesContainer.classList.add('card-columns');
            articlesContainer.classList.remove('articles-list');
            cardViewBtn.classList.add('active');
            listViewBtn.classList.remove('active');
        }

        updateAuthorDisplay();
        insertYearHeaders();
        bindAbstractMathTypeset();
        requestMathTypeset();
    }

    function requestMathTypeset() {
        if (typeof window.typesetMath !== 'function') {
            return;
        }

        window.typesetMath(articlesContainer);
    }

    function bindAbstractMathTypeset() {
        articlesContainer.querySelectorAll('.abstract-trigger').forEach(trigger => {
            if (trigger.dataset.mathTypesetBound === 'true') {
                return;
            }

            trigger.dataset.mathTypesetBound = 'true';
            ['mouseenter', 'focus'].forEach(eventName => {
                trigger.addEventListener(eventName, function() {
                    const abstract = trigger.closest('.article-abstract');
                    const preview = abstract ? abstract.querySelector('.abstract-preview') : null;

                    if (!preview || preview.dataset.mathTypesetDone === 'true' || typeof window.typesetMath !== 'function') {
                        return;
                    }

                    window.typesetMath(preview).then(function() {
                        preview.dataset.mathTypesetDone = 'true';
                    });
                });
            });
        });
    }

    // Function to apply filtering and sorting
    function applyFiltersAndSort() {
        const searchTerm = articleSearch.value.toLowerCase().trim(); // Trim whitespace from search term
        const sortValue = articleSort.value;

        // Split the search term into individual words
        const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 0); // Split by one or more spaces

        // Filter
        let filteredArticles = articleItems.filter(item => {
            const title = item.getAttribute('data-title').toLowerCase();
            const author = item.getAttribute('data-author').toLowerCase();
            const year = item.getAttribute('data-year').toLowerCase(); // Include year for search
            const journal = item.getAttribute('data-journal').toLowerCase(); // Include journal for search
            // const abstract = item.getAttribute('data-abstract').toLowerCase(); // Include abstract for search

            const keywordsElement = item.querySelector('.article-keywords');
            const keywords = keywordsElement ? keywordsElement.textContent.toLowerCase() : '';

            // Combine all searchable content into a single string
            const searchableContent = `${title} ${author} ${keywords} ${year} ${journal}`;

            // If no search term, all articles are considered a match
            if (searchWords.length === 0) {
                return true;
            }

            // Check if ALL search words are present in the searchable content of the article
            return searchWords.every(word => searchableContent.includes(word));
        });

        // Sort
        filteredArticles.sort((a, b) => {
            const yearA = parseInt(a.getAttribute('data-year'));
            const yearB = parseInt(b.getAttribute('data-year'));
            const authorA = a.getAttribute('data-author');
            const authorB = b.getAttribute('data-author');
            const titleA = a.getAttribute('data-title');
            const titleB = b.getAttribute('data-title');

            if (sortValue === 'year-desc') {
                return yearB - yearA;
            } else if (sortValue === 'year-asc') {
                return yearA - yearB;
            } else if (sortValue === 'author-asc') {
                return authorA.localeCompare(authorB);
            } else if (sortValue === 'title-asc') {
                return titleA.localeCompare(titleB);
            }
            return 0; // No specific sort applied
        });

        // Clear existing articles and append sorted/filtered ones
        articlesContainer.innerHTML = '';
        if (filteredArticles.length === 0) {
            articlesContainer.innerHTML = '<p class="text-themed">No articles found matching your criteria.</p>';
        } else {
            filteredArticles.forEach(item => articlesContainer.appendChild(item));
        }

        applyViewMode();
    }

    // View switching functionality
    cardViewBtn.addEventListener('click', function() {
        currentView = 'card';
        applyViewMode();
        // Ensure articles are displayed correctly after view change
        // No need to re-run applyFiltersAndSort here, as the CSS classes handle layout.
        // If content disappears, you might need to re-append, but usually not.
    });

    listViewBtn.addEventListener('click', function() {
        currentView = 'list';
        applyViewMode();
        // No need to re-run applyFiltersAndSort here.
    });

    // Event listeners for search and sort
    articleSearch.addEventListener('input', applyFiltersAndSort);
    articleSort.addEventListener('change', applyFiltersAndSort);

    // Initial load: Apply filters and sorting
    applyFiltersAndSort();
});
