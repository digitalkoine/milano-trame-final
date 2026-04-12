/*
  Map bootstrap for TRAME — Milano ebraica nel tempo

  Responsibilities:
  - Create the Leaflet map centered on Milan.
  - Enable Leaflet.TimeDimension and configure the time interval (years).
  - Add base tiles and common controls (scale, coordinates).
  - Create the TimeDimension control and expose a stable reference for autoplay.
*/

function createAndSetUpMapMilano(start_date, end_date) {
  var timeInterval = `${start_date}/${end_date}`;
  // Create the map with TimeDimension enabled, but instantiate the control manually
  // so we always have a reliable reference to the player (needed for autoplay).
  var map = L.map('map',  {
    // Start a bit more centred on Milano (dataset centroid) and slightly closer.
    // We still fit bounds once data are loaded (see index.html) to keep all points visible.
    center: [45.4632, 9.1719],
    zoom: 13,
    preferCanvas: false,
    // Default Leaflet behaviour: opening a popup closes the previous one.
    closePopupOnClick: true,
    timeDimension: true,
    timeDimensionOptions: {
      timeInterval: timeInterval,
      period: "P1Y",
      currentTime: Date.parse(start_date),
    },
    timeDimensionControl: false
  });

  // TimeDimension player + control (bottom-left)
// We create the player explicitly so autoplay is always reliable.
var tdPlayer = new L.TimeDimension.Player({
  transitionTime: 400,
  loop: true,
  startOver: true
}, map.timeDimension);

var tdControl = L.control.timeDimension({
  position: 'topright',
  loopButton: true,
  displayDate: false,
  autoPlay: false, // we start it ourselves after the map is ready
  minSpeed: 2,
  maxSpeed: 50,
  limitSliders: true,
  timeSliderDragUpdate: true,
  player: tdPlayer
}).addTo(map);

// Keep stable references for autoplay.
map._tdControl = tdControl;
map._tdPlayer = tdPlayer;

  L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{
      minZoom: 0,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }
  ).addTo(map);

  // Coordinates: move away from the year box (both were bottom-right and overlapped)
  // Top-left keeps them visible without colliding with the time slider.
  var coordinatesControl = new L.control.coordinates({
    position:"topleft",
    decimals:5,
    decimalSeperator:",",
    labelTemplateLat:  "Lat: {y}",
    labelTemplateLng:  "Lon: {x}"
  });
  coordinatesControl.addTo(map);

  // Year box removed: the sidebar already shows the current year.

  return map;
}
