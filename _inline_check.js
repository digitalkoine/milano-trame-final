

      // ---- Normalisers (robust matching across dataset quirks) ----
      // Some entries may contain trailing spaces or multiple inner spaces.
      // We normalise to compare reliably (case-insensitive, trimmed, collapsed whitespace).
      function normSiteName(v) {
        return (v == null ? "" : String(v))
          .replace(/\s+/g, " " )
          .trim()
          .toLowerCase();
      }

      // ---- Derive slider interval from data (fallback to 1927–2026) ----
      function getYearRange(arr) {
        var minY = 9999, maxY = 0;
        for (var i = 0; i < arr.length; i++) {
          var s = Number(arr[i].start_year);
          var e = Number(arr[i].end_year);
          if (!isNaN(s)) minY = Math.min(minY, s);
          if (!isNaN(e)) maxY = Math.max(maxY, e);
        }
        if (minY === 9999) minY = 1927;
        if (maxY === 0) maxY = 2026;
        return { min: minY, max: maxY };
      }

      var yr = getYearRange(milanoSites);
      var startISO = yr.min + "-01-01";
      var endISO = yr.max + "-12-31";

      var map = createAndSetUpMapMilano(startISO, endISO);

      // ---- Build points GeoJSON ----
      var sitesGeojson = buildPointsForSites(milanoSites);

      // ---- Category list (used to build the checkbox filter UI) ----
      // We collect distinct categories from the dataset and keep the original labels for display.
      function getCategories(arr) {
        var seen = {};
        for (var i = 0; i < arr.length; i++) {
          var c = (arr[i].categoria || '').toString().trim();
          if (c) seen[c.toLowerCase()] = c;
        }
        var out = Object.keys(seen).map(function(k){ return seen[k]; });
        out.sort(function(a,b){ return a.localeCompare(b, 'it'); });
        return out;
      }

      

// ---- Affiliation list (Comunità) ----
function getAffiliations(arr) {
  var seen = {};
  var hasNone = false;
  for (var i = 0; i < arr.length; i++) {
    var a = (arr[i].affiliazione || '').toString().trim();
    if (a) seen[a.toLowerCase()] = a;
    else hasNone = true;
  }
  var out = Object.keys(seen).map(function(k){ return seen[k]; });
  out.sort(function(a,b){ return a.localeCompare(b, 'it'); });
  if (hasNone) out.unshift('(nessuna)');
  return out;
}

var categories = getCategories(milanoSites);


var affiliations = getAffiliations(milanoSites);

var affiliationsLowerAll = affiliations.map(function(x){ return (x || '').toString().trim().toLowerCase(); });
// NOTE: Comunità is used for HIGHLIGHTING ONLY (marker outlines).
// It must not filter which points are shown.
var activeAffiliationsLower = affiliationsLowerAll.slice(); // kept for backward compatibility (always = all)

// Comunità selection state (multi-select highlight)
// Empty = no highlight (no outlines)
var selectedAffiliationsLower = [];

// Deterministic outline colours for communities (used as marker borders)
var AFF_OUTLINE_COLORS = (function(){
  var palette = ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666','#1f78b4','#b2df8a','#fb9a99','#cab2d6','#fdbf6f','#b15928'];
  var m = {};
  for (var i=0;i<affiliationsLowerAll.length;i++){
    var k = affiliationsLowerAll[i];
    if (k === '(nessuna)') m[k] = '#555';
    else m[k] = palette[i % palette.length];
  }
  return m;
})();


      var categoriesLowerAll = categories.map(function(x){ return (x || '').toString().trim().toLowerCase(); });
      var activeCategoriesLower = categoriesLowerAll.slice(); // start with all selected

      // Category colours (used by the point style and by the checkbox 'swatches').
      // Keys are normalised to lower-case so matching is robust.
      // If your dataset uses different labels, add aliases here (e.g., 'associazioni' -> same blue).
      var CATEGORY_COLORS = {
        "religioso": "#d95f0e",
        "educazione": "#66bd63",
        "associazione": "#74add1",
        "associazioni": "#74add1",
        "comunitario": "#fe9929",
        "assistenza": "#a6cee3",
        "altro": "#ffb6c1",
        "altro / non classificato": "#ffb6c1",
        "non classificato": "#ffb6c1"
      };

      function bindPopupHtml(feature, layer) {
        var p = feature.properties || {};
        var yearsLabel = (p.start_year === p.end_year)
          ? (p.start_year)
          : (p.start_year + "–" + p.end_year);

        var html = ''
          + '<div>'
          + '<h2 style="margin:0 0 6px 0;">' + (p.sito || '') + '</h2>'
          + '<p style="margin:0 0 4px 0;"><strong>Categoria:</strong> ' + (p.categoria || p.category || '') + '</p>'
          + (p.affiliazione ? '<p style="margin:0 0 4px 0;"><strong>Affiliazione:</strong> ' + p.affiliazione + '</p>' : '')
          + (p.indirizzo ? '<p style="margin:0 0 4px 0;"><strong>Indirizzo:</strong> ' + p.indirizzo + '</p>' : '')
          + '<p style="margin:0 0 6px 0;"><strong>Periodo:</strong> ' + yearsLabel + '</p>'
          + (p.popup_text ? '<p style="margin:0 0 0 0;">' + p.popup_text + '</p>' : '')
          + '</div>';

        layer.bindPopup(html, { autoClose: false, closeOnClick: false });
      }


      // Extra interactions:
      // - Clicking a marker in the general view isolates that place and shows its story (all phases).
      // - In story mode, each phase shows its date range as a permanent label above the marker.
      var selectedFocusUid = null;

      function bindFeatureInteractions(feature, layer) {
        var p = (feature && feature.properties) ? feature.properties : {};
        var siteName = normSiteName(p.sito);

        // In story mode: we used to show date ranges as labels above markers,
        // but it made the map harder to read. Dates remain visible in popups and sidebar.

        // Click handling:
        // - In the GENERAL view, clicks are managed by updateOverlapStyles() so stacks can "spiderfy".
        // - In STORY mode (isolated place), we keep a simple click to open popup + update focus.
        if (selectedSiteName) {
          layer.on('click', function(e) {
            if (!p || !siteName) return;
            selectedFocusUid = String(p.uid || '');
            try { renderPlaceInfoForSelected(); } catch(err) {}
            try { layer.openPopup(); } catch(err2) {}
            try { if (e) L.DomEvent.stop(e); } catch(err3) {}
          });
        }
      }

      function onEachSiteFeature(feature, layer) {
        bindPopupHtml(feature, layer);
        bindFeatureInteractions(feature, layer);
      }

function buildLayers(selectedCategoriesLower, selectedAffiliationsLower) {
  // selectedCategoriesLower: array of lower-cased categories to show.
  // If null/undefined -> show all. If empty -> show none.
  var selected = Array.isArray(selectedCategoriesLower)
    ? selectedCategoriesLower.map(function(x){ return (x || '').toString().trim().toLowerCase(); }).filter(Boolean)
    : null;

  // Comunità selection is highlight-only, so we DO NOT filter features by affiliation.
  // (selectedAffiliationsLower is ignored and kept only for backward compatibility.)
  var selectedAff = null;

  var filtered;
  if (selected === null) {
    filtered = sitesGeojson;
  } else if (selected.length === 0) {
    filtered = { type: 'FeatureCollection', features: [] };
  } else {
    // Filter features whose categoria is in selected
    filtered = {
      type: 'FeatureCollection',
      features: (sitesGeojson.features || []).filter(function(f) {
        var p = (f.properties || {});
        var craw = (p.category && p.category.toString().trim()) ? p.category : (p.categoria || '');
        var c = craw.toString().trim().toLowerCase();
        return (selected.indexOf(c) !== -1);
      })
    };
  }

  // Optional: isolate one place entity by `sito` (story mode in the right sidebar).
  // In story mode we intentionally show *all* phases of that place, regardless of the
  // category filter, so the user can follow changes over time.
  if (selectedSiteName) {
    filtered = {
      type: 'FeatureCollection',
      features: (sitesGeojson.features || []).filter(function(f){
        return normSiteName((f.properties || {}).sito) === normSiteName(selectedSiteName);
      })
    };
  }

  var base = L.geoJSON(filtered, {
    pointToLayer: function(feature, latlng) {
      var p = (feature && feature.properties) ? feature.properties : {};
      // Story mode: keep category colour so selection from the list is immediately recognisable
      if (selectedSiteName) {
        var present = [];
        try {
          for (var si = 0; si < (window.selectedAffiliationsLower || []).length; si++) {
            var ksel = (window.selectedAffiliationsLower || [])[si];
            if (featureHasSelectedAff(p, ksel)) present.push(ksel);
          }
        } catch(e) {}
        var rings = present.length ? ringsCssForSelectedKeys(present) : '';
        return L.marker(latlng, { icon: makeCountIcon(1, catColorFor(p), 22, rings) });
      }
      // Main chronology: base style will be refined by updateOverlapStyles()
      return L.marker(latlng, { icon: makeCountIcon(1, PAL_LIGHT, 20, '') });
    },
    onEachFeature: onEachSiteFeature
  });

  var timed = L.TimeDimension.Layer.betweendates(
    base,
    { timeDimension: map.timeDimension }
  );

  return { base: base, timed: timed };
}

      // Initial layers (all categories)
      var layers = buildLayers(null, null);
      var baseGeoJsonLayer = layers.base;
      var timeSitesLayer = layers.timed;

      // ---- Layer selector removed (no longer needed) ----
      // The project now has a single temporal layer always shown.
      // Keeping Leaflet's layer control adds UI clutter.
      var layerControl = null;

      // Default: visible
      timeSitesLayer.addTo(map);

      // ---- Ensure a sane initial time + apply dynamic styling immediately ----
      // Without this, the first render can show "inactive" styling until the first
      // user-triggered time change (e.g. Reset).
      try {
        var minYear = null;
        (sitesGeojson.features || []).forEach(function(f){
          var y = Number((f.properties||{}).start_year);
          if (!isNaN(y)) minYear = (minYear === null) ? y : Math.min(minYear, y);
        });
        if (minYear !== null && map.timeDimension) {
          map.timeDimension.setCurrentTime(Date.UTC(minYear, 0, 1));
        }
      } catch(e) {}

      // First paint (after TD builds its first _currentLayer)
      try {
        setTimeout(function(){
          try { updateOverlapStyles(); } catch(e1) {}
          try { updateSidebarList(); } catch(e2) {}
        }, 0);
      } catch(e) {}

      // ---- Autoplay on load ----
      // Start the TimeDimension player automatically when the map is ready.
      try {
        if (map && map._tdPlayer && typeof map._tdPlayer.start === 'function') {
          // Small delay ensures the control/layers are fully attached.
          setTimeout(function(){ try { map._tdPlayer.start(); } catch(e) {} }, 300);
        }
      } catch(e) {}


// ---- Shared references (for rebuilding layers when filters change) ----
var searchControl = null;

// Sidebar selection state
// When set, we enter "story mode" and isolate all records with the same `sito`
// so the map shows how that place changes across time.
var selectedSiteName = null;
    selectedFocusUid = null;
var selectedCategoryColor = null;

// Precompute time bounds for fast filtering in the sidebar
try {
  (sitesGeojson.features || []).forEach(function(f){
    var p = f.properties || {};
    p._t0 = Date.parse(String(p.start_date || '').trim());
    p._t1 = Date.parse(String(p.end_date || '').trim());
  });
} catch(e) {}

function rebuildOverlaysAndSearch() {
  // Preserve whether the layer is currently visible
  var wasVisible = map.hasLayer(timeSitesLayer);

  // Preserve whether the player was running
  var wasPlaying = false;
  try { wasPlaying = !!(map && map._tdPlayer && map._tdPlayer._playing); } catch(e) {}

  // Stop player while we swap layers (prevents TimeDimension desync)
  try { if (map && map._tdPlayer && typeof map._tdPlayer.stop === 'function') map._tdPlayer.stop(); } catch(e) {}

  // Remove old layer/control/search safely
  try { if (layerControl) map.removeControl(layerControl); } catch(e) {}
  try { if (searchControl) map.removeControl(searchControl); } catch(e) {}
  try { if (map.hasLayer(timeSitesLayer)) map.removeLayer(timeSitesLayer); } catch(e) {}

  // Rebuild layers using current activeCategoriesLower + activeAffiliationsLower
  var layersNew = buildLayers(activeCategoriesLower, activeAffiliationsLower);
  baseGeoJsonLayer = layersNew.base;
  timeSitesLayer = layersNew.timed;

  // --- Update the TimeDimension available times so the slider range follows filters
  // This makes the time slider interact with Categoria + Comunità by shrinking/expanding
  // the available year range to the currently selected subset.
  try {
    if (map && map.timeDimension) {
      var years = [];
      var minY = null, maxY = null;
      (sitesGeojson.features || []).forEach(function(f){
        var p = (f && f.properties) ? f.properties : {};
        // In story mode keep global range (narrative traversal)
        if (selectedSiteName) return;
        if (!passesActiveFilters(p)) return;
        var sy = Number(p.start_year);
        var ey = Number(p.end_year);
        if (isNaN(sy) || isNaN(ey)) return;
        minY = (minY === null) ? sy : Math.min(minY, sy);
        maxY = (maxY === null) ? ey : Math.max(maxY, ey);
      });

      // Fallback to global bounds if filters yield none
      if (minY === null || maxY === null) {
        (sitesGeojson.features || []).forEach(function(f){
          var p = (f && f.properties) ? f.properties : {};
          var sy = Number(p.start_year);
          var ey = Number(p.end_year);
          if (isNaN(sy) || isNaN(ey)) return;
          minY = (minY === null) ? sy : Math.min(minY, sy);
          maxY = (maxY === null) ? ey : Math.max(maxY, ey);
        });
      }

      if (minY !== null && maxY !== null) {
        for (var yy = minY; yy <= maxY; yy++) years.push(Date.UTC(yy, 0, 1));
        map.timeDimension.setAvailableTimes(years, 'replace');
      }
    }
  } catch(e) {}

  // Layer selector removed
  layerControl = null;

  // Restore visibility
  if (wasVisible) timeSitesLayer.addTo(map);

  // Recreate search (binds to the rebuilt baseGeoJsonLayer)
  searchControl = new L.Control.Search({
    layer: baseGeoJsonLayer,
    propertyName: 'sito',
    marker: false,
    moveToLocation: function(latlng, title, map) { map.setView(latlng, 15); },
    textPlaceholder: 'Cerca un luogo…'
  });
  map.addControl(searchControl);

  // Re-bind the search handler (defined below)
  bindSearchAutoPopup();

  // Force TimeDimension to re-render the current frame against the new layer
  try {
    if (map && map.timeDimension) {
      var t = map.timeDimension.getCurrentTime();
      map.timeDimension.setCurrentTime(t);
    }
  } catch(e) {}

  // Update the sidebar list + restyle overlaps for the current time (after TD paints)
  setTimeout(function(){
    try { updateSidebarList(); } catch(e1) {}
    try { updateOverlapStyles(); } catch(e2) {}
    // Resume autoplay if it was running
    try { if (wasPlaying && map && map._tdPlayer && typeof map._tdPlayer.start === 'function') map._tdPlayer.start(); } catch(e3) {}
  }, 0);
}

      // Ensure the first frame is rendered immediately (otherwise markers can look "faded"
      // until the first timeload event is fired).
      try {
        var t0init = Date.parse(String(startISO));
        if (!isNaN(t0init) && map && map.timeDimension) {
          map.timeDimension.setCurrentTime(t0init);
        }
      } catch(e) {}
      setTimeout(function(){
        try { updateSidebarList(); } catch(e) {}
        try { updateOverlapStyles(); } catch(e) {}
      }, 0);

      

// ---- UI: Categoria in sidebar + Comunità dropdown on map ----

// Monochrome (B/W) symbolic SVG icons for categories.
var CATEGORY_SVGS = {
  'associazione': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14c2-1 3-3 5-3s3 2 5 3" /><path d="M5 12c1-2 2-3 4-3" /><path d="M19 12c-1-2-2-3-4-3" /><path d="M8 15l-2 2" /><path d="M16 15l2 2" /></svg>',
  'comunitario': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M4.5 20c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M13.5 20c.3-2.3 2-3.7 4-3.7 1.8 0 3.2.9 3.8 3.7"/></svg>',
  'educazione': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M7 11v5c0 1.5 3 3 5 3s5-1.5 5-3v-5"/><path d="M21 10v6"/></svg>',
  'assistenza': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.5-9.5-9C.8 8.8 3 6 6 6c1.8 0 3.2 1 4 2 0.8-1 2.2-2 4-2 3 0 5.2 2.8 3.5 6-2.5 4.5-9.5 9-9.5 9z"/></svg>',
  'religioso': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 4.5L20 8l-3.8 3.2L17 17l-5-2.4L7 17l.8-5.8L4 8l5.4-.5L12 3z"/></svg>',
  'altro': '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="2.2"/></svg>',
  'all': '<svg viewBox="0 0 24 24 aria-hidden="true"><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></svg>'
};

function catIcon(catName) {
  var key = (catName || '').toString().trim().toLowerCase();
  if (key === 'associazioni') key = 'associazione';
  if (key.indexOf('altro') === 0 || key.indexOf('non classificato') >= 0) key = 'altro';
  return (CATEGORY_SVGS && CATEGORY_SVGS[key]) ? CATEGORY_SVGS[key] : CATEGORY_SVGS['altro'];
}

// ---- Categoria filter (moved to right sidebar) ----
var sidebarCatMount = document.getElementById('sidebarCategoryFilters');
var catCbs = [];
var allCatCb = null;

function buildSidebarCategoryFilters() {
  if (!sidebarCatMount) return;

  sidebarCatMount.innerHTML = '';
  var head = document.createElement('div');
  head.className = 'sidebar-filter-head';
  head.innerHTML = '<strong>Categoria</strong>';
  sidebarCatMount.appendChild(head);

  function makeRow(labelText, iconHtml, checked, onChange) {
    var row = document.createElement('label');
    row.className = 'sidebar-cat-row';

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!checked;
    cb.addEventListener('change', function(){ try{ onChange(); } catch(e){} });

    var icon = document.createElement('span');
    icon.className = 'filter-icon';
    icon.innerHTML = (iconHtml != null) ? String(iconHtml) : '';

    var txt = document.createElement('span');
    txt.className = 'sidebar-cat-label';
    txt.textContent = labelText;

    row.appendChild(cb);
    row.appendChild(icon);
    row.appendChild(txt);
    sidebarCatMount.appendChild(row);
    return cb;
  }

  catCbs = [];
  allCatCb = makeRow('Tutte', CATEGORY_SVGS['all'], true, function() {
    var wantAll = allCatCb.checked;
    for (var i = 0; i < catCbs.length; i++) catCbs[i].checked = wantAll;
    applyFromCheckboxes();
  });

  for (var i = 0; i < categories.length; i++) {
    (function(catName) {
      var cb = makeRow(catName, catIcon(catName), true, function(){ applyFromCheckboxes(); });
      catCbs.push(cb);
    })(categories[i]);
  }

  function applyFromCheckboxes() {
    var selectedCats = [];
    for (var i = 0; i < categories.length; i++) {
      if (catCbs[i].checked) selectedCats.push(categoriesLowerAll[i]);
    }
    activeCategoriesLower = selectedCats;
    if (allCatCb) allCatCb.checked = (selectedCats.length === categories.length);

    // Categoria filter affects which points exist: rebuild TD layers + search
    rebuildOverlaysAndSearch();
  }
}

buildSidebarCategoryFilters();

// ---- Comunità dropdown (highlight-only) ----
var CommunityDropdownControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd: function() {
    var container = L.DomUtil.create('div', 'leaflet-bar community-control');

    // Toggle button
    var btn = L.DomUtil.create('button', 'community-toggle', container);
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span class="community-toggle-label">Comunità</span><span class="community-toggle-count" id="communityCount"></span><span class="community-chevron" aria-hidden="true">▾</span>';

    // Panel (dropdown body)
    var panel = L.DomUtil.create('div', 'community-panel', container);
    panel.setAttribute('role', 'menu');
    panel.hidden = true;

    
    // Prevent map interactions from hijacking clicks inside the dropdown.
    panel.addEventListener('mousedown', function(e){ try { L.DomEvent.stop(e); } catch(err){} });
    panel.addEventListener('click', function(e){ try { L.DomEvent.stop(e); } catch(err){} });
function updateToggleCount() {
      var el = container.querySelector('#communityCount');
      if (!el) return;
      if (!selectedAffiliationsLower || selectedAffiliationsLower.length === 0) {
        el.textContent = '';
      } else {
        el.textContent = ' (' + selectedAffiliationsLower.length + ')';
      }
    }

    function closePanel() {
      panel.hidden = true;
      container.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function openPanel() {
      panel.hidden = false;
      container.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
    }
    btn.addEventListener('click', function(e){
      try { L.DomEvent.stop(e); } catch(err) {}
      if (panel.hidden) openPanel();
      else closePanel();
    });

    // Close dropdown when clicking outside the control (robust for Safari + file://).
    // Using a document-level handler avoids immediate close triggered by Leaflet map click.
    function onDocPointerDown(ev){
      try {
        if (!container.contains(ev.target)) closePanel();
      } catch(e){}
    }
    document.addEventListener('mousedown', onDocPointerDown, true);
    document.addEventListener('touchstart', onDocPointerDown, true);

    function makeAffButton(label, keyLower, isClear) {
      var b = L.DomUtil.create('button', 'aff-btn', panel);
      b.type = 'button';
      b.setAttribute('data-aff', isClear ? '__clear__' : keyLower);
      b.setAttribute('aria-pressed', 'false');

      var strokeCol = isClear ? '#111' : (AFF_OUTLINE_COLORS[keyLower] || '#111');
      b.innerHTML =
        '<span class="aff-swatch" style="--stroke:' + strokeCol + '"></span>' +
        '<span class="aff-label">' + label + '</span>';

      b.addEventListener('click', function(e){
        try { L.DomEvent.stop(e); } catch(err) {}
        if (e && e.preventDefault) e.preventDefault();

        if (isClear) {
          selectedAffiliationsLower = [];
        } else {
          var idx = selectedAffiliationsLower.indexOf(keyLower);
          if (idx >= 0) selectedAffiliationsLower.splice(idx, 1);
          else selectedAffiliationsLower.push(keyLower);
          // stable ring order
          try {
            selectedAffiliationsLower.sort(function(a,b){ return affiliationsLowerAll.indexOf(a) - affiliationsLowerAll.indexOf(b); });
          } catch(eSort) {}
        }

        updateAffButtons();
        updateToggleCount();
        try { clearSpiderfy(); } catch(e1) {}
        try { updateOverlapStyles(); } catch(e2) {}
      });

      return b;
    }

    var affButtons = [];
    function updateAffButtons() {
      affButtons.forEach(function(b){
        var k = b.getAttribute('data-aff');
        var active = false;
        if (k === '__clear__') active = (selectedAffiliationsLower.length === 0);
        else active = (selectedAffiliationsLower.indexOf(k) !== -1);

        if (active) b.classList.add('is-active');
        else b.classList.remove('is-active');

        try { b.setAttribute('aria-pressed', active ? 'true' : 'false'); } catch(e) {}
      });
    }

    // Build dropdown body
    affButtons.push(makeAffButton('Nessuna evidenza', null, true));
    for (var k = 0; k < affiliations.length; k++) {
      var kk = affiliationsLowerAll[k];
      affButtons.push(makeAffButton(affiliations[k], kk, false));
    }
    updateAffButtons();
    updateToggleCount();

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    return container;
  }
});

map.addControl(new CommunityDropdownControl());

// ---- Sidebar: list of ALL places, with inactive ones greyed out for the current year ----
var sidebarYearEl = document.getElementById('sidebarYear');
var sidebarTitleEl = document.getElementById('sidebarTitle');
var sidebarCountEl = document.getElementById('sidebarCount');
var placesListEl = document.getElementById('placesList');
var btnClearSelection = document.getElementById('btnClearSelection');
var placeInfoEl = document.getElementById('placeInfo');

function getCurrentYear() {
  var t = map && map.timeDimension ? map.timeDimension.getCurrentTime() : NaN;
  if (isNaN(t)) return null;
  return new Date(t).getFullYear();
}

function yearLabelForFeature(p) {
  if (!p) return '';
  return (String(p.start_year) === String(p.end_year)) ? String(p.start_year) : (String(p.start_year) + '–' + String(p.end_year));
}

function isFeatureActiveAtTime(f, t) {
  var p = (f && f.properties) ? f.properties : {};
  var t0 = p._t0;
  var t1 = p._t1;
  if (isNaN(t0) || isNaN(t1)) {
    // fallback to year bounds
    var y = new Date(t).getFullYear();
    var ys = Number(p.start_year);
    var ye = Number(p.end_year);
    if (!isNaN(ys) && !isNaN(ye)) return (y >= ys && y <= ye);
    return false;
  }
  return (t >= t0 && t <= t1);
}

function categoryIsActive(p) {
  if (!p) return false;
  if (!Array.isArray(activeCategoriesLower)) return true;
  var craw = (p.category && p.category.toString().trim()) ? p.category : (p.categoria || '');
  var c = craw.toString().trim().toLowerCase();
  return activeCategoriesLower.indexOf(c) !== -1;
}


function affiliationIsActive(p) {
  if (!p) return false;
  if (!Array.isArray(activeAffiliationsLower)) return true;
  var araw = (p.affiliazione || '').toString().trim();
  var key = araw ? araw.toLowerCase() : '(nessuna)';
  // normalise "(nessuna)" sentinel
  if (!araw) key = '(nessuna)';
  return activeAffiliationsLower.indexOf(key) !== -1;
}

function passesActiveFilters(p) {
  // Comunità selection must NOT filter the dataset; it is used only for outline highlighting.
  return categoryIsActive(p);
}

function catColorFor(p) {
  var craw = (p && p.category && p.category.toString().trim()) ? p.category : (p ? (p.categoria || '') : '');
  var key = craw.toString().trim().toLowerCase();
  return (CATEGORY_COLORS && CATEGORY_COLORS[key]) ? CATEGORY_COLORS[key] : '#999';
}

function affKeysFor(p) {
  var raw = (p && p.affiliazione != null) ? String(p.affiliazione) : '';
  raw = raw.trim();
  if (!raw) return ['(nessuna)'];
  // Allow multiple affiliations in one cell (e.g., "Persiani; Libanesi")
  var parts = raw.split(/[;,\/|\n]+/).map(function(s){ return String(s).trim(); }).filter(function(s){ return !!s; });
  if (!parts.length) return ['(nessuna)'];
  return parts.map(function(s){ return s.toLowerCase(); });
}

function affKeyFor(p) {
  return affKeysFor(p)[0];
}
function affColorForKey(k) {
  if (!k) return '#555';
  var kk = String(k).trim().toLowerCase();
  return (AFF_OUTLINE_COLORS && AFF_OUTLINE_COLORS[kk]) ? AFF_OUTLINE_COLORS[kk] : '#555';
}

function affColorFor(p) {
  return affColorForKey(affKeyFor(p));
}


function hexToRgb(hex) {
  if (!hex) return null;
  var h = String(hex).replace('#','').trim();
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  if (h.length !== 6) return null;
  var n = parseInt(h, 16);
  if (isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r,g,b){
  function toHex(x){ var s = Math.max(0, Math.min(255, Math.round(x))).toString(16); return (s.length===1?'0':'')+s; }
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

// Darken a colour by factor in [0..1]
function darken(hex, factor) {
  var rgb = hexToRgb(hex);
  if (!rgb) return hex || '#999';
  var f = Math.max(0, Math.min(1, factor || 0));
  return rgbToHex(rgb.r * (1 - f), rgb.g * (1 - f), rgb.b * (1 - f));
}


// --- Global palette for main chronology (single Greens palette) ---
// Lighter end of the Greens palette: keep it visibly green (not "almost white")
// Use a clearly visible light green (the previous one looked "transparent" on light basemaps)
var PAL_LIGHT = '#74c476';
var PAL_DARK  = '#006d2c';

function lerp(a,b,t){ return a + (b-a)*t; }
function mixHex(hexA, hexB, t) {
  var A = hexToRgb(hexA), B = hexToRgb(hexB);
  if (!A || !B) return hexA || '#999';
  var tt = Math.max(0, Math.min(1, t));
  return rgbToHex(lerp(A.r,B.r,tt), lerp(A.g,B.g,tt), lerp(A.b,B.b,tt));
}


// Build one or more outline "rings" (marker borders) using CSS box-shadow.
// We keep the marker body untouched; rings are only shown when one or more Comunità are selected.
function ringsCssForColors(colors) {
  if (!colors || !colors.length) return '0 0 0 0 transparent';
  var base = 3; // ring thickness
  var gap  = 1; // spacing between rings
  var out = [];
  for (var i = 0; i < colors.length; i++) {
    var w = base * (i + 1) + gap * i; // 3,7,11,...
    out.push('0 0 0 ' + w + 'px ' + colors[i]);
  }
  return out.join(', ');
}

function ringsCssForSelectedKeys(presentKeysLower) {
  if (!presentKeysLower || !presentKeysLower.length) return '0 0 0 0 transparent';
  var cols = presentKeysLower.map(function(k){ return affColorForKey(k); });
  return ringsCssForColors(cols);
}

function featureHasSelectedAff(p, keyLower) {
  var keys = affKeysFor(p || {});
  return keys.indexOf(keyLower) !== -1;
}

function makeCountIcon(count, color, size, rings) {
  var sz = Math.max(12, Number(size) || 18);
  var fs = Math.max(10, Math.round(sz * 0.55));
  var col = color || PAL_LIGHT;
  // No outline by default: outlines are enabled only when one or more Comunità are selected.
  var ringsCss = (rings !== undefined && rings !== null && String(rings).trim() !== '') ? String(rings) : '0 0 0 0 transparent';
  return L.divIcon({
    className: 'count-marker-wrap',
    html: '<div class="count-marker" style="--cm:' + col + ';--rings:' + ringsCss + ';--sz:' + sz + 'px;--fs:' + fs + 'px">' + (count||1) + '</div>',
    iconSize: [sz, sz],
    iconAnchor: [sz/2, sz/2]
  });
}

// --- Spiderfy (cluster-like expansion) for stacked markers ---
var spiderfyLayer = null;
var spiderfyOriginKey = null;

function ensureSpiderfyLayer() {
  if (!spiderfyLayer) {
    spiderfyLayer = L.layerGroup().addTo(map);
    // Close spiderfy when user clicks elsewhere
    try {
      map.on('click', function(){ clearSpiderfy(); });
      map.on('zoomstart', function(){ clearSpiderfy(); });
      map.on('movestart', function(){ clearSpiderfy(); });
      map.timeDimension && map.timeDimension.on('timeload', function(){ clearSpiderfy(); });
    } catch(e) {}
  }
}

function clearSpiderfy() {
  if (!spiderfyLayer) return;
  try { spiderfyLayer.clearLayers(); } catch(e) {}
  spiderfyOriginKey = null;
}

function makeCategoryIcon(color, sizePx, rings) {
  var sz = Math.max(12, Number(sizePx) || 16);
  // No outline by default: outlines are enabled only when one or more Comunità are selected.
  var ringsCss = (rings !== undefined && rings !== null && String(rings).trim() !== '') ? String(rings) : '0 0 0 0 transparent';
  return L.divIcon({
    className: 'cat-marker-wrap',
    html: '<div class="cat-marker" style="--cm:' + (color||'#999') + ';--rings:' + ringsCss + ';--sz:' + sz + 'px"></div>',
    iconSize: [sz, sz],
    iconAnchor: [sz/2, sz/2]
  });
}

function selectPlaceFromFeature(feature) {
  if (!feature || !feature.properties) return;
  var p = feature.properties || {};
  try { selectedCategoryColor = catColorFor(p); } catch(e) { selectedCategoryColor = null; }
  selectPlaceByName(p.sito, String(p.uid || ''));
}

function spiderfyStack(originLatLng, key, features) {
  ensureSpiderfyLayer();
  if (!features || features.length <= 1) return;

  // Toggle behaviour: clicking the same stack closes it.
  if (spiderfyOriginKey && spiderfyOriginKey === key) {
    clearSpiderfy();
    return;
  }
  clearSpiderfy();
  spiderfyOriginKey = key;

  var n = features.length;
  var centerPt = map.latLngToLayerPoint(originLatLng);
  var radiusPx = Math.max(18, Math.min(45, 14 + 6 * Math.sqrt(n)));

  for (var i = 0; i < n; i++) {
    var ang = (Math.PI * 2 * i) / n;
    var pt = L.point(centerPt.x + radiusPx * Math.cos(ang), centerPt.y + radiusPx * Math.sin(ang));
    var ll = map.layerPointToLatLng(pt);

    var p = (features[i].properties || {});
    var catKey = (p.categoria || '').toString().trim().toLowerCase();
    var catCol = (CATEGORY_COLORS && CATEGORY_COLORS[catKey]) ? CATEGORY_COLORS[catKey] : '#666';

    // Comunità outlines are opt-in: only when one or more communities are selected.
    var present = [];
    try {
      for (var si = 0; si < selectedAffiliationsLower.length; si++) {
        var ksel = selectedAffiliationsLower[si];
        if (featureHasSelectedAff(p, ksel)) present.push(ksel);
      }
    } catch(e) {}
    var rings = present.length ? ringsCssForSelectedKeys(present) : '';
    var m = L.marker(ll, { icon: makeCategoryIcon(catCol, 16, rings), riseOnHover: true });
try { bindPopupHtml(features[i], m); } catch(e) {}

    // Clicking one of the spiderfied points: open its popup.
    // IMPORTANT: stop propagation so the map click handler doesn't immediately clear spiderfy.
    m.on('click', (function(feature){
      return function(e){
        try {
          if (e && e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
            L.DomEvent.preventDefault(e.originalEvent);
          }
          L.DomEvent.stop(e);
        } catch(err) {}
        try { this.openPopup(); } catch(err2) {}
      };
    })(features[i]));

    spiderfyLayer.addLayer(m);
  }
}

// In the general view (main chronology), dynamically emphasise stacks of points that share
// the same coordinates at the current time:
//   - SAME hue for all points
//   - more points => darker + larger
function updateOverlapStyles() {
  if (!map || !map.timeDimension) return;
  if (selectedSiteName) return; // story mode: keep fixed styling

  var t = map.timeDimension.getCurrentTime();
  var counts = {};
  var groups = {};

  function keyForLatLng(ll) {
    return ll.lat.toFixed(6) + ',' + ll.lng.toFixed(6);
  }

  // Prefer the actually displayed geojson layer (TimeDimension's current layer)
  // so styling always matches what the user sees.
  var displayed = (timeSitesLayer && timeSitesLayer._currentLayer) ? timeSitesLayer._currentLayer : baseGeoJsonLayer;
  if (!displayed) return;

  // Pass 1: count active points per coordinate (and keep the layers grouped)
  displayed.eachLayer(function(l){
    if (!l || !l.feature || !l.feature.properties || !l.getLatLng) return;
    var f = l.feature;
    var p = f.properties || {};
    if (!passesActiveFilters(p)) return;
    if (!isFeatureActiveAtTime(f, t)) return;

    var k = keyForLatLng(l.getLatLng());
    counts[k] = (counts[k] || 0) + 1;
    if (!groups[k]) groups[k] = [];
    groups[k].push(l);
  });

  // Determine scaling range
  var maxCount = 1;
  Object.keys(counts).forEach(function(k){ maxCount = Math.max(maxCount, counts[k] || 1); });
  // Color palette (single Greens) defined globally: PAL_LIGHT -> PAL_DARK

  // Pass 2: apply styles
  // NOTE: points are Leaflet Markers (DivIcons) so we style with setIcon/setOpacity.
  // We also make them behave like a cluster: for a stack, show ONE aggregate marker
  // and hide the duplicates; clicking the aggregate "spiderfies" the stack.
  displayed.eachLayer(function(l){
    if (!l || !l.feature || !l.feature.properties || !l.getLatLng) return;
    var f = l.feature;
    var p = f.properties || {};
    var activeNow = passesActiveFilters(p) && isFeatureActiveAtTime(f, t);
    if (!activeNow) {
      try { l.setOpacity(0); } catch(e) {}
      return;
    }

    var k = keyForLatLng(l.getLatLng());
    var c = counts[k] || 1;

    // Determine if this layer is the "leader" of its coordinate group
    var group = groups[k] || [l];
    var leader = group[0] === l;

    if (!leader) {
      // Hide duplicates so we get a true single marker per coordinate
      try { l.setOpacity(0); } catch(e) {}
      try { if (l._icon) l._icon.style.pointerEvents = 'none'; } catch(e2) {}
      return;
    }

    // Normalised intensity for colour (single Greens palette)
    var tt = (maxCount <= 1) ? 0 : ((c - 1) / (maxCount - 1));
    var col = mixHex(PAL_LIGHT, PAL_DARK, tt);

    // Size scaling (visible)
    var radius = 7 + 5 * Math.sqrt(Math.max(0, c - 1));
    try {
      // When count==1 we still want it clearly visible (verdino)
      if (typeof l.setOpacity === "function") l.setOpacity(1);
      if (l._icon) l._icon.style.pointerEvents = 'auto';
      if (typeof l.setIcon === "function") {
        // Comunità highlight: ONLY add a coloured outline to markers that include
        // at least one feature of the selected affiliation at the current time/coordinate.
        var present = [];
        try {
          for (var si = 0; si < (window.selectedAffiliationsLower || []).length; si++) {
            var ksel = (window.selectedAffiliationsLower || [])[si];
            var hasAff = false;
            for (var gi = 0; gi < group.length; gi++) {
              var fp = (group[gi] && group[gi].feature) ? (group[gi].feature.properties || {}) : {};
              if (featureHasSelectedAff(fp, ksel)) { hasAff = true; break; }
            }
            if (hasAff) present.push(ksel);
          }
        } catch(eAff) {}
        var rings = present.length ? ringsCssForSelectedKeys(present) : '';
        l.setIcon(makeCountIcon(c, col, radius*2.2, rings));
      }
    } catch(e) {}


    // If this marker represents a stack (>1), disable its own popup so click can spiderfy.
    // When it becomes a single point again, restore the popup.
    try {
      if (c > 1) {
        if (typeof l.getPopup === 'function' && l.getPopup()) l.unbindPopup();
      } else {
        if (typeof l.getPopup === 'function' && !l.getPopup()) bindPopupHtml(l.feature, l);
      }
    } catch(ePop) {}
    // Store stack info on the leader marker so the click handler always has fresh data
    try {
      l._stackKey = k;
      l._stackCount = c;
      l._stackFeatures = group.map(function(x){ return x.feature; }).filter(Boolean);
    } catch(e) {}

    // Bind click: if stacked, spiderfy; if single, keep the usual behaviour.
    if (!l._stackClickBound) {
      l._stackClickBound = true;
      l.on('click', function(e){
        try { if (e) L.DomEvent.stop(e); } catch(err) {}
        var ll = this.getLatLng ? this.getLatLng() : null;
        if (!ll) return;
        var kk = this._stackKey || keyForLatLng(ll);
        var feats = this._stackFeatures || [];
        var cc = this._stackCount || feats.length || 1;
        if (cc > 1 && feats.length) {
          // Spiderfy to individual category-coloured markers with popups
          spiderfyStack(ll, kk, feats);
        } else {
          clearSpiderfy();
          // Open popup + enter story mode
          try { this.openPopup && this.openPopup(); } catch(err2) {}
          try { this.feature && selectPlaceFromFeature(this.feature); } catch(err3) {}
        }
      });
    }
  });
}

function updateSidebarList() {
  if (!placesListEl || !map || !map.timeDimension) return;

  var t = map.timeDimension.getCurrentTime();
  var y = getCurrentYear();
  if (sidebarYearEl) sidebarYearEl.textContent = (y !== null ? y : '—');

  if (sidebarTitleEl) {
    sidebarTitleEl.innerHTML = selectedSiteName
      ? ('Storia: <span style="font-weight:700">' + String(selectedSiteName) + '</span> — <span id="sidebarYear">' + (y !== null ? y : '—') + '</span>')
      : ('Enti ebraici a Milano<br>anno <span id="sidebarYear">' + (y !== null ? y : '—') + '</span>');
    // Re-bind sidebarYearEl if we replaced the innerHTML
    sidebarYearEl = document.getElementById('sidebarYear');
  }

  // STORY MODE: show the sequence of phases for the selected place (its changes over time)
  if (selectedSiteName) {
    var phases = (sitesGeojson.features || []).filter(function(f){
      return normSiteName((f.properties||{}).sito) === normSiteName(selectedSiteName);
    });
    phases.sort(function(a,b){
      return Number((a.properties||{}).start_year) - Number((b.properties||{}).start_year);
    });

    if (sidebarCountEl) sidebarCountEl.textContent = phases.length + ' fasi';
    placesListEl.innerHTML = '';

    phases.forEach(function(f){
      var p = f.properties || {};
      var activeNow = isFeatureActiveAtTime(f, t);

      var item = document.createElement('div');
      item.className = 'place-item' + (activeNow ? '' : ' is-inactive');
      item.setAttribute('role', 'button');
      item.tabIndex = 0;

      var name = document.createElement('div');
      name.className = 'place-name';
      name.textContent = (p.indirizzo ? String(p.indirizzo) : '—');

      var meta = document.createElement('div');
      meta.className = 'place-meta';

      var left = document.createElement('div');
      left.className = 'place-cat';

      var dot = document.createElement('span');
      dot.className = 'place-dot';
      dot.style.background = activeNow ? catColorFor(p) : '#bdbdbd';

      var cat = document.createElement('span');
      cat.textContent = String(p.categoria || p.category || '');

      left.appendChild(dot);
      left.appendChild(cat);

      var yrs = document.createElement('div');
      yrs.className = 'place-years';
      yrs.textContent = yearLabelForFeature(p);

      meta.appendChild(left);
      meta.appendChild(yrs);

      item.appendChild(name);
      item.appendChild(meta);

      function activatePhase(){
        // Jump to this phase and open its popup
        try { if (map._tdPlayer && map._tdPlayer.isPlaying && map._tdPlayer.isPlaying()) map._tdPlayer.stop(); } catch(err) {}
        var t0 = Date.parse(String(p.start_date || '').trim());
        if (!isNaN(t0)) map.timeDimension.setCurrentTime(t0);

        try {
          var targetLayer = null;
          baseGeoJsonLayer.eachLayer(function(l){
            if (l && l.feature && l.feature.properties && String(l.feature.properties.uid) === String(p.uid)) targetLayer = l;
          });
          if (targetLayer) {
            map.setView(targetLayer.getLatLng(), 15);
            map.timeDimension.once('timeload', function(){ try { targetLayer.openPopup(); } catch(e) {} });
          }
        } catch(e) {}
      }

      item.addEventListener('click', activatePhase);
      item.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activatePhase(); }
      });

      placesListEl.appendChild(item);
    });

    if (btnClearSelection) btnClearSelection.disabled = false;
    return;
  }

  // NORMAL MODE: list only the places active in the current year \(respecting category filter\)\n  // NORMAL MODE: list ALL places in the dataset, grouped by category.
  // (No time filtering here: the list is the complete index; the map is filtered by the timeline.)
  var byCategory = {};
  (sitesGeojson.features || []).forEach(function(f){
    var p = f.properties || {};
    var nm = String(p.sito || '').trim();
    if (!nm) return;

    var craw = (p.categoria || p.category || '').toString().trim();
    var catLabel = craw || 'Altro / non classificato';

    if (!byCategory[catLabel]) byCategory[catLabel] = {};
    if (!byCategory[catLabel][nm]) byCategory[catLabel][nm] = [];
    byCategory[catLabel][nm].push(f);
  });

  var catNames = Object.keys(byCategory);
  catNames.sort(function(a,b){ return a.localeCompare(b, 'it'); });

  // Count total unique places
  var totalPlaces = 0;
  catNames.forEach(function(cn){ totalPlaces += Object.keys(byCategory[cn] || {}).length; });

  if (sidebarCountEl) sidebarCountEl.textContent = totalPlaces + ' luoghi (dataset)';
  placesListEl.innerHTML = '';

  catNames.forEach(function(catLabel){
    var section = document.createElement('div');
    section.className = 'place-section';

    var head = document.createElement('div');
    head.className = 'place-section-head';

    var dot = document.createElement('span');
    dot.className = 'place-dot';
    dot.style.background = catColorFor({ categoria: catLabel });

    var title = document.createElement('span');
    title.textContent = catLabel;

    head.appendChild(dot);
    head.appendChild(title);
    section.appendChild(head);

    var names = Object.keys(byCategory[catLabel] || {});
    names.sort(function(a,b){ return a.localeCompare(b, 'it'); });

    names.forEach(function(nm){
      var group = byCategory[catLabel][nm] || [];
      group.sort(function(a,b){ return Number((a.properties||{}).start_year) - Number((b.properties||{}).start_year); });
      var rep = group[0];
      var p = rep.properties || {};

      var item = document.createElement('div');
      item.className = 'place-item';
      item.setAttribute('role', 'button');
      item.tabIndex = 0;

      var name = document.createElement('div');
      name.className = 'place-name';
      name.textContent = nm;

      var meta = document.createElement('div');
      meta.className = 'place-meta';

      var left = document.createElement('div');
      left.className = 'place-cat';

      var d2 = document.createElement('span');
      d2.className = 'place-dot';
      d2.style.background = catColorFor(p);

      var phases = document.createElement('span');
      phases.textContent = (group.length > 1) ? (group.length + ' fasi') : yearLabelForFeature(p);

      left.appendChild(d2);
      left.appendChild(phases);
      meta.appendChild(left);

      item.appendChild(name);
      item.appendChild(meta);

      function activate(){ selectedCategoryColor = catColorFor(p); selectPlaceByName(nm, String((p && p.uid) ? p.uid : '')); }
      item.addEventListener('click', activate);
      item.addEventListener('keydown', function(ev){
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(); }
      });

      section.appendChild(item);
    });

    placesListEl.appendChild(section);
  });

  if (btnClearSelection) btnClearSelection.disabled = true;
}

function selectPlaceByName(name, focusUid) {
  if (!name) return;

  selectedSiteName = normSiteName(name);
  selectedFocusUid = (typeof focusUid !== 'undefined' && focusUid !== null) ? String(focusUid) : null;

  // Ensure temporal layer is visible
  if (!map.hasLayer(timeSitesLayer)) timeSitesLayer.addTo(map);

  // Stop autoplay so the selection feels stable
  try { if (map._tdPlayer && map._tdPlayer.isPlaying && map._tdPlayer.isPlaying()) map._tdPlayer.stop(); } catch(err) {}

  // Jump the slider to the first phase (earliest start) so the story is visible immediately
  var phases = (sitesGeojson.features || []).filter(function(ff){
    return normSiteName((ff.properties||{}).sito) === normSiteName(selectedSiteName);
  });
  phases.sort(function(a,b){ return Number((a.properties||{}).start_year) - Number((b.properties||{}).start_year); });
  if (phases.length && phases[0].properties) {
    var t0 = Date.parse(String(phases[0].properties.start_date || '').trim());
    if (!isNaN(t0)) map.timeDimension.setCurrentTime(t0);
  }

  // Rebuild the layer stack so the map shows ONLY this place (all its phases) across time
  rebuildOverlaysAndSearch();

  // Fit to all phases and open the focused popup (or the first one)
  try {
    var bounds = [];
    var firstLayer = null;
    var focusLayer = null;

    baseGeoJsonLayer.eachLayer(function(l){
      if (l && l.getLatLng) {
        bounds.push(l.getLatLng());
        if (!firstLayer) firstLayer = l;

        try {
          if (selectedFocusUid && l.feature && l.feature.properties && String(l.feature.properties.uid) === String(selectedFocusUid)) {
            focusLayer = l;
          }
        } catch(e) {}
      }
    });

    if (bounds.length) {
      map.fitBounds(L.latLngBounds(bounds).pad(0.25));
    } else if (firstLayer) {
      map.setView(firstLayer.getLatLng(), 15);
    }

    var toOpen = focusLayer || firstLayer;
    if (toOpen) {
      map.timeDimension.once('timeload', function(){ try { toOpen.openPopup(); } catch(e) {} });
    }
  } catch(e) {}

  // Update the sidebar info box for this place
  try { renderPlaceInfoForSelected(); } catch(e) {}

  updateSidebarList();
}

function safeText(x){
  return (x === null || typeof x === 'undefined') ? '' : String(x);
}

function renderPlaceInfoForSelected() {
  if (!placeInfoEl) return;
  if (!selectedSiteName) {
    placeInfoEl.hidden = true;
    placeInfoEl.innerHTML = '';
    return;
  }

  var phases = (sitesGeojson.features || []).filter(function(f){
    return normSiteName((f.properties||{}).sito) === normSiteName(selectedSiteName);
  });
  phases.sort(function(a,b){ return Number((a.properties||{}).start_year) - Number((b.properties||{}).start_year); });
  var rep = phases[0] ? (phases[0].properties || {}) : {};

  var cat = safeText(rep.categoria || rep.category);
  var aff = safeText(rep.affiliazione);
  var desc = safeText(rep.popup_text);
  var indir = safeText(rep.indirizzo);

  var minY = null, maxY = null;
  phases.forEach(function(f){
    var p = f.properties || {};
    var ys = Number(p.start_year);
    var ye = Number(p.end_year);
    if (!isNaN(ys)) minY = (minY === null) ? ys : Math.min(minY, ys);
    if (!isNaN(ye)) maxY = (maxY === null) ? ye : Math.max(maxY, ye);
  });
  var years = (minY !== null && maxY !== null)
    ? ((minY === maxY) ? String(minY) : (minY + '–' + maxY))
    : '';

  var html = ''
    + '<div class="place-info-title">' + safeText(selectedSiteName) + '</div>'
    + '<div class="place-info-meta">'
    +   (cat ? ('<span class="pill"><span class="pill-dot" style="background:' + catColorFor({categoria:cat}) + '"></span>' + cat + '</span>') : '')
    +   (years ? ('<span class="pill">' + years + '</span>') : '')
    +   (phases.length ? ('<span class="pill">' + phases.length + ' fasi</span>') : '')
    + '</div>'
    + (indir ? ('<div class="place-info-line"><strong>Indirizzo:</strong> ' + indir + '</div>') : '')
    + (aff ? ('<div class="place-info-line"><strong>Affiliazione:</strong> ' + aff + '</div>') : '')
    + (desc ? ('<div class="place-info-desc">' + desc + '</div>') : '');

  placeInfoEl.innerHTML = html;
  placeInfoEl.hidden = false;
}

if (btnClearSelection) {
  btnClearSelection.addEventListener('click', function(){
    // Hard reset: reload the page to guarantee TimeDimension + layers are back in sync.
    // This avoids the "map becomes unusable after reset" issue seen after entering story mode.
    try { clearSpiderfy(); } catch(e) {}
    try { window.location.reload(); } catch(e) {
      // Fallback (should rarely happen): at least rebuild layers.
      selectedSiteName = null;
      selectedFocusUid = null;
      rebuildOverlaysAndSearch();
      updateSidebarList();
      try { map.setView([45.4642, 9.1900], 12); } catch(e2) {}
    }
  });
}

// Keep the sidebar in sync with the time slider / autoplay
map.timeDimension.on('timeload', function(){
  updateSidebarList();
  updateOverlapStyles();
});



      // ---- Legend ----
      // Legend removed
      // ---- Search (by "sito" or address) ----
      // Search control is (re)created by rebuildOverlaysAndSearch()
// When a place is found via search, move there AND open its popup automatically.
// We also jump the time slider inside the feature's time window so the feature is visible.
function bindSearchAutoPopup() {
  if (!searchControl) return;

  // Remove previous listener (defensive)
  map.off('search:locationfound');

  map.on('search:locationfound', function(e) {
    var lyr = e.layer;
    if (!lyr || !lyr.feature || !lyr.feature.properties) return;

    // Ensure the temporal layer is visible (user may have hidden it via layer selector)
    if (!map.hasLayer(timeSitesLayer)) timeSitesLayer.addTo(map);

    // Pause autoplay so the popup does not disappear on the next tick
    try { if (map._tdPlayer && map._tdPlayer.isPlaying && map._tdPlayer.isPlaying()) map._tdPlayer.stop(); } catch(err) {}
    try { if (map._tdControl && map._tdControl._player && map._tdControl._player.isPlaying && map._tdControl._player.isPlaying()) map._tdControl._player.stop(); } catch(err) {}
    var t = Date.parse(String(lyr.feature.properties.start_date || '').trim());

    function openNow(){ try{ lyr.openPopup(); }catch(e){} }

    if (!isNaN(t)) {
      map.timeDimension.once('timeload', openNow);
      map.timeDimension.setCurrentTime(t);
    } else {
      openNow();
    }
  });
}

// Don't auto-close popups when the search UI collapses.


      // ---- A small console hint about missing coordinates ----
      if (typeof milanoSitesNoCoords !== 'undefined' && milanoSitesNoCoords.length) {
        console.log("Records without coordinates (not mapped):", milanoSitesNoCoords.length);
      }

    