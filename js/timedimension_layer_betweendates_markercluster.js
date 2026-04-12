// Extend the TimeDimension Layer to handle MarkerClusterGroup
L.TimeDimension.Layer.BetweenDates.MarkerCluster = L.TimeDimension.Layer.GeoJson.extend({
    initialize: function(layer, options) {
        L.TimeDimension.Layer.GeoJson.prototype.initialize.call(this, layer, options);

        // Ensure the timeDimension is set
        if (!options.timeDimension) {
            throw new Error('timeDimension option is required');
        }
        
        this._timeDimension = options.timeDimension;
        this._markerClusterGroup = L.markerClusterGroup(); // Create MarkerClusterGroup
        this._updateMarkers(); // Initial marker update
    },

    onAdd: function(map) {
        // Call parent onAdd to ensure internal wiring happens
        L.TimeDimension.Layer.GeoJson.prototype.onAdd.call(this, map);

        // TimeDimension emits events on the TimeDimension instance (not on the layer)
        // so we bind here to refresh the cluster whenever the time changes.
        if (this._timeDimension) {
            this._timeDimension.on('timeload', this._updateMarkers, this);
            this._timeDimension.on('timeloading', this._updateMarkers, this);
            this._timeDimension.on('currenttimechanged', this._updateMarkers, this);
        }

        // Ensure the cluster group is on the map
        if (!map.hasLayer(this._markerClusterGroup)) {
            map.addLayer(this._markerClusterGroup);
        }
        return this;
    },

    onRemove: function(map) {
        if (this._timeDimension) {
            this._timeDimension.off('timeload', this._updateMarkers, this);
            this._timeDimension.off('timeloading', this._updateMarkers, this);
            this._timeDimension.off('currenttimechanged', this._updateMarkers, this);
        }
        if (map && map.hasLayer(this._markerClusterGroup)) {
            map.removeLayer(this._markerClusterGroup);
        }
        return L.TimeDimension.Layer.GeoJson.prototype.onRemove.call(this, map);
    },

    _getFeatureTimes: function(feature) {
        if (!feature.properties) {
            return [];
        }
        if (feature.properties.hasOwnProperty('start_date') && feature.properties.hasOwnProperty('end_date')) {
            return [feature.properties.start_date, feature.properties.end_date];
        }
        return [];
    },

    _getFeatureBetweenDates: function(feature, minTime, maxTime) {
        var featureTimes = this._getFeatureTimes(feature);

        if (featureTimes.length < 2) {
            return null; // Need both start and end times
        }

        var startTime = new Date(featureTimes[0]).getTime();
        var endTime = new Date(featureTimes[1]).getTime();

        if (startTime > maxTime || endTime < minTime) {
            return null; // Feature is not within the current time range
        }

        return feature;
    },

    _updateMarkers: function() {
        if (!this._timeDimension) {
            console.error('TimeDimension is not set');
            return;
        }
        
        var minTime = this._timeDimension.getCurrentTime();
        var maxTime = minTime;

        // Clear the existing MarkerClusterGroup
        this._markerClusterGroup.clearLayers();

        // Iterate through each feature in the GeoJSON layer
        this._layer.eachLayer(function(layer) {
            var feature = layer.feature;
            var filteredFeature = this._getFeatureBetweenDates(feature, minTime, maxTime);
            if (filteredFeature) {
                this._markerClusterGroup.addLayer(layer);
            }
        }.bind(this));

        // Add the MarkerClusterGroup to the map if not already added
        if (!this._map.hasLayer(this._markerClusterGroup)) {
            this._map.addLayer(this._markerClusterGroup);
        }
    },

    _onTimeDimensionChange: function() {
        this._updateMarkers();
    }
});

// Function to initialize the TimeDimension Layer with MarkerCluster
L.TimeDimension.Layer.betweendates.markercluster = function(layer, options) {
    if (!options.timeDimension) {
        throw new Error('timeDimension option is required');
    }
    
    return new L.TimeDimension.Layer.BetweenDates.MarkerCluster(layer, options);
};