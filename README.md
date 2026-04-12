# TRAME — Milan Jewish Places (Time Map)

This repository contains an interactive time-enabled map centered on **Milan** to explore changes over time in places related to **Jewish life in Milan** (religious, educational, associations, community services, and other categories).

The map is built with **Leaflet** and a **time slider** (Leaflet.TimeDimension). Places appear/disappear according to their start/end dates. A category panel allows comparing multiple categories at the same time.

https://digitalkoine.github.io/milano-trame-draft-final/

---

## Features

- **Time slider** (bottom-left) to browse year-by-year changes
- **Autoplay** on page load (the animation starts automatically)
- **Category filters** (top-right) with multi-selection checkboxes
- **Search**: type a place name, zoom to it, and open its popup
- **Popups** with place details
- Consistent styling across categories (distinct colors)

---

## Project Structure

Typical structure:

- `milano.html`  
  Main map page.
- `css/`  
  Map and UI styles.
- `js/`  
  Map logic, TimeDimension setup, styling helpers.
- `data/`  
  Dataset in JavaScript format (exported from the JSON source).

> Note: some versions of the project bundle external libraries locally; others load them via CDN.

---

## Run Locally

Because browsers restrict some features when opening files directly (`file://`), run a local web server.

### Option A — Python (recommended)

From the project folder:

```bash
python -m http.server 8000
