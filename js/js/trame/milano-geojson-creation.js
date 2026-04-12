/*
  Milano Jewish sites — GeoJSON creation helpers
  Input: milanoSites (array of objects with lat/lon + start_date/end_date)
*/

function normaliseCategory(cat) {
  if (!cat) return "altro";
  return String(cat).trim().toLowerCase();
}

function buildPointsForSites(milanoSites) {
  var result = {
    type: "FeatureCollection",
    features: []
  };

  for (var i = 0; i < milanoSites.length; i++) {
    var s = milanoSites[i];
    if (s.lat === null || s.lon === null || s.lat === undefined || s.lon === undefined) {
      continue;
    }

    var category = normaliseCategory(s.categoria);

    // Build a single point feature (one "site instance" with a time window)
    result.features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [Number(s.lon), Number(s.lat)]
      },
      properties: {
        // Stable-ish unique id for linking search -> timed layer
        uid: (s.uid !== undefined && s.uid !== null)
          ? String(s.uid)
          : String(i) + '|' + String(s.sito || '') + '|' + String(s.indirizzo || '') + '|' + String(s.start_year || '') + '|' + String(s.end_year || ''),
        category: category,
        categoria: s.categoria,
        sito: s.sito,
        indirizzo: s.indirizzo,
        affiliazione: s.affiliazione,
        start_date: s.start_date,
        end_date: s.end_date,
        start_year: s.start_year,
        end_year: s.end_year,
        // Keep a "population" field so we can reuse existing styling logic/patterns if needed
        population: 1,
        popup_text: s.popup_text,
        image_ref: s.image_ref
      }
    });
  }

  return result;
}
