//L.TimeDimension.Layer.GeoJson only accepts one time value: this is the time when the feature appears, and stays on map
// for a time defined by the duration option. To ensure that the feature stays on map in between two dates (start_date and end_date), we need to extend the function.
//In javasctipt, extending a class means creating a child class (which inherits the methods of the parent one) with some additional method.
L.TimeDimension.Layer.Lines = L.TimeDimension.Layer.GeoJson.extend({
    //_getFeatureTimes is a method (more specifically, a function with parameter feature) that return the time variable that it is used later. As per the normal L.TimeDimension.Layer.GeoJson class, the
    // method recognised as valid times properties called 'coordTimes', 'linestringTimestamps','time'. Alll these need to be in format 'YYYY-MM-DD'.
    // As per usual behaviour, it accept 'times' as an array of multiple times, in the form of ['YYYY-MM-DD','YYYY-MM-DD',...]
    _getFeatureTimes: function(feature) {
      // if there is no property, it return an empty array rather than crashing
        if (!feature.properties) {
            return [];
        }
        //takes the array times and returns it, making it available for later
        else if (feature.properties.hasOwnProperty('times')) {
            return feature.properties.times;
        }
        return [];
    },
    // _getFeatureBetweenDates is a function method that takes as parameters feature, minTime and maxTime.
    //feature is the current feature of the geoJson, while maxTime is the current time in the map. It is not clear what minTime but it is not used in the function.
    _getFeatureBetweenDates: function(feature, minTime, maxTime) {
         //whatever is returned by the _getFeatureTimes function (see above) is stored in this variable
          var featureStringTimes = this._getFeatureTimes(feature);
        // if this variable has a length of 0, i.e. it is empty, it outputs the feature
          if (featureStringTimes.length == 0) {
              return feature;
          }
          //creates an empty array variable called featureTimes
          var featureTimes = [];
          //here loops through the elements in the array featureStringTimes, turning them into a date, and placing inside the empty container featureTimes. At the end of this process featureTimes is a list of dates.
          for (var i = 0, l = featureStringTimes.length; i < l; i++) {
              var time = featureStringTimes[i]
              //check if element i of the times is a string, than turns it into a date, and puts it into the array featureTimes, in the last position
              if (typeof time == 'string' || time instanceof String) {
                var americanTime = time.replace(/(\d{2})-(\d{2})-(\d{4})/, "$3-$2-$1");
                time = Date.parse(americanTime.trim());
              }
              featureTimes.push(time);
          }
          // create an empty varibale index_max, assigning value null. index_max will be used to identify the maximum vertex of the line to be show at different times.
          var index_max = null;
          // this is simply the number of element inside the featureTimes array, which is equal to the number of vertexes of the line plus 1.
          var l = featureTimes.length;
  
          // maxTime and minTime are defined elsewhere in the parent class leaflet.timedimension.layer.geojson. More specifically, maxTime is always updated as the current time.
          // if the first element of the featureTimes array is later than current time, its moment is yet to come, so the function does nothing
          if (featureTimes[0] > maxTime) {
            return null;
          }
          // as soon as the first element of the featureTimes array is before maxTime, it is the moment to start showing the line feature.
         if (featureTimes[0] <= maxTime){
           // We loop on all the times within the featureTimes array. As soon as one of them is above the maxTime, we get out of the for loop (using break) and we replace index_max with the index of that time.
           //For instance, if the 10th vertex of a line (ergo index 9) is associated with 15 March 2001, as soon as the map change to the 16th March we get out of the loop and index_max=9
            for (var i = 0; i < l; i++) {
              if (featureTimes[i] > maxTime ) {
                index_max = i;
                break;
              }
            }
          }
  
        //at this point we retrieve the geometry coordinates of the feature. This is an array of arrays, i.e. [[long_vertex_1,lat_vertex_1],[long_vertex_2,lat_vertex_2],...,[long_vertex_n,lat_vertex_n]]
        // and we slice it, taking only in between index 0, included (i.d. the coordinates of the first vertex), and index_max, not included.
        //In our example, it would output an array of array including 8 elements (between 0 and 9, excluding 9), which are 8 vertexes and therefore 7 segments.
        var new_coordinates = feature.geometry.coordinates.slice(0, index_max);
        //it now returns a geojson with the same characteristics of the original one, but with new coordinates.
        //Since it repeats the process every time a new time is fired, it will alway add vertexes and therefore segments
        // NB since we want to show all the segments, the number of times in featureTimes but be equal to the number of vertices + 1
        return {
          type: 'Feature',
          properties: feature.properties,
          geometry: {
              type: "LineString",
              coordinates: new_coordinates
            }
        };
    },
  });
  
  //We create a class, but to create a new instance (i.e. an object that use the prototype of the class), need to use the key word new L.TimeDimension.Layer.BetweenDates
  // We could indeed always call L.TimeDimension.Layer.Lines with 'new' in front of it, but it easier to bundle it into a specific function that returns 'new L.TimeDimension.Layer.BetweenDates'
  // a function such as the one below is called a "constructor" in javascript.
  L.TimeDimension.Layer.lines = function(layer, options) {
    return new L.TimeDimension.Layer.Lines(layer, options);
  };
  