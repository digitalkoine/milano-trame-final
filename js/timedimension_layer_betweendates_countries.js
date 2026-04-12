L.TimeDimension.Layer.BetweenDatesCountries = L.TimeDimension.Layer.GeoJson.extend({
    initialize: function(layer, options, globalCountries) {
        // Call the parent constructor
        L.TimeDimension.Layer.GeoJson.prototype.initialize.call(this, layer, options);
        this.globalCountries = globalCountries; // Store the globalCountries GeoJSON
    },
    
    // Function to join geometries based on the specified properties
    _joinGeometries: function(feature) {
        if (!this.globalCountries || !this.globalCountries.features) {
            return feature; // Return the original feature if no globalCountries are provided
        }

        country = this.globalCountries.features.find((el) => (el.properties.ADMIN == feature.properties.country));
        if (country) {
            feature.geometry = country.geometry;
        }
        
        return feature; // Return the modified feature
    },

    _getFeatureTimes: function(feature) {
        if (!feature.properties) {
            return [];
        } else if (feature.properties.hasOwnProperty('coordTimes')) {
            return feature.properties.coordTimes;
        } else if (feature.properties.hasOwnProperty('times')) {
            return feature.properties.times;
        } else if (feature.properties.hasOwnProperty('linestringTimestamps')) {
            return feature.properties.linestringTimestamps;
        } else if (feature.properties.hasOwnProperty('time')) {
            return feature.properties.time;
        } else if (feature.properties.hasOwnProperty('start_date') && feature.properties.hasOwnProperty('end_date')) {
            return [feature.properties.start_date, feature.properties.end_date];
        }
        return [];
    },

    _getFeatureBetweenDates: function(feature, minTime, maxTime) {
        var featureStringTimes = this._getFeatureTimes(feature);
        if (featureStringTimes.length === 0) {
            return feature;
        }

        var featureTimes = [];
        for (var i = 0, l = featureStringTimes.length; i < l; i++) {
            var time = featureStringTimes[i];
            if (typeof time === 'string' || time instanceof String) {
                var americanTime = time.replace(/(\d+[/])(\d+[/])/, '$2$1');
                time = Date.parse(americanTime.trim());
            }
            featureTimes.push(time);
        }

        if (featureTimes[0] > maxTime || featureTimes[l - 1] < maxTime) {
            return null;
        }

        var new_coordinates = feature.geometry.coordinates;

        // Adding noise to each coordinate based on the map's zoom level.
        var zoomLevel = this._map.getZoom();
        new_coordinates = new_coordinates.map(function(coord) {
            var noiseFactor = 0.001 * (feature.properties.index + 2^zoomLevel);
            var lonNoise = noiseFactor; // Longitude noise
            var latNoise = noiseFactor; // Latitude noise
            return [coord[0] + lonNoise, coord[1] + latNoise];
        });

        // Join geometries with globalCountries
        feature = this._joinGeometries(feature);

        return feature;
    },
});

// Constructor function to create a new instance
L.TimeDimension.Layer.betweendatescountries = function(layer, options, globalCountries) {
    return new L.TimeDimension.Layer.BetweenDatesCountries(layer, options, globalCountries);
};
