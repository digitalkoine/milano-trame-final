//L.TimeDimension.Layer.GeoJson only accepts one time value: this is the time when the feature appears, and stays on map
// for a time defined by the duration option. To ensure that the feature stays on map in between two dates (start_date and end_date), we need to extend the function.
//In javasctipt, extending a class means creating a child class (which inherits the methods of the parent one) with some additional method.
L.TimeDimension.Layer.BetweenDates = L.TimeDimension.Layer.GeoJson.extend({
  //_getFeatureTimes is a method (more specifically, a function with parameter feature) that return the time variable that it is used later. As per the normal L.TimeDimension.Layer.GeoJson class, the
  // method recognised as valid times properties called 'coordTimes', 'linestringTimestamps','time'. Alll these need to be in format 'YYYY-MM-DD'.
  // As per usual behaviour, it accept 'times' as an array of multiple times, in the form of ['YYYY-MM-DD','YYYY-MM-DD',...]
  // the addition here is the creation of an array combining start_date and end_date.
  initialize: function(layer, options) {
    // Store layerOptions, defaulting to an empty object if not provided
    this._layerOptions = options.layerOptions || {};
    // Call the parent class's initialize method
    L.TimeDimension.Layer.GeoJson.prototype.initialize.call(this, layer, options);
  },
  
  _getFeatureTimes: function(feature) {
    // if there is no property, it return an empty array rather than crashing
      if (!feature.properties) {
          return [];
      }
      else if (feature.properties.hasOwnProperty('coordTimes')) {
          return feature.properties.coordTimes;
      }
      else if (feature.properties.hasOwnProperty('times')) {
          return feature.properties.times;
      }
      else if (feature.properties.hasOwnProperty('linestringTimestamps')) {
          return feature.properties.linestringTimestamps;
      }
      else if (feature.properties.hasOwnProperty('time')) {
          return feature.properties.time;
      }
      //we check here if both property start_date and end_date exists
      else if (feature.properties.hasOwnProperty('start_date') && feature.properties.hasOwnProperty('end_date') ) {
        //if they exist, it will return an array ['YYYY-MM-DD','YYYY-MM-DD'], with start and end date respectivelly.
          return [feature.properties.start_date,feature.properties.end_date];
      }
      return [];
  },
  //create a new method to consider dates in between. _getFeatureBetweenDates is a function method that takes as parameters
  // feature, minTime and maxTime.
  _getFeatureBetweenDates: function(feature, minTime, maxTime) {
       //whatever comes out of the _getFeatureTimes function (see above) is stored in this variable
        var featureStringTimes = this._getFeatureTimes(feature);
      // if this variable has a length of 0, i.e. it is empty, it outputs the feature
        if (featureStringTimes.length == 0) {
            return feature;
        }
        //creates an empty array variable called featureTimes
        var featureTimes = [];
        //here loops through the elements in the array featureStringTimes
        for (var i = 0, l = featureStringTimes.length; i < l; i++) {
            var time = featureStringTimes[i]
            //check if element i of the times is a string, than turns it into a date, and puts it into the array featureTimes, in the last position
            if (typeof time == 'string' || time instanceof String) {
                var americanTime = time.replace(/(\d+[/])(\d+[/])/, '$2$1');
                time = Date.parse(americanTime.trim());
            }
            featureTimes.push(time);
        }
        //it then checks that the first element of the array (start_date) is not higher than maxTime, and that the last element(end_date) is not below minTime
        // if they are, it does not return the feature, otherwise it returns it.
        // maxTime and minTime are defined elsewhere in the parent class leaflet.timedimension.layer.geojson. More specifically, maxTime is always updated as the current time,
        //so if the start_date is higher than the current time, its moment is yet to come. If the end_date is below currentTime, it should disappear.
        //in the original code, it was '...|| featureTimes[l - 1] < minTime)...', but I cannot understand what minTime is. In this way work in any case.
        if (featureTimes[0] > maxTime || featureTimes[l - 1] < maxTime) {
            return null;
        }
        return feature;
    },
});

//We create a class, but to create a new instance (i.e. an object that use the prototype of the class), need to use the key word new L.TimeDimension.Layer.BetweenDates
// We could indeed always call L.TimeDimension.Layer.BetweenDates with 'new' in front of it, but it easier to bundle it into a specific function that returns 'new L.TimeDimension.Layer.BetweenDates'
// a function such as the one below is called a "constructor" in javascript.
L.TimeDimension.Layer.betweendates = function(layer, options) {
  return new L.TimeDimension.Layer.BetweenDates(layer, options);
};
