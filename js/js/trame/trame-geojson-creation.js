/* utility functions */
const CubicBezierCurve = function (start, end, variant) {
    this.controlPoints = this.calcControlPoints(start, end, variant);
}

CubicBezierCurve.prototype = {
    B1: function (t) { return t*t*t; },
    B2: function (t) { return 3*t*t*(1-t); },
    B3: function (t) { return 3*t*(1-t)*(1-t); },
    B4: function (t) { return (1-t)*(1-t)*(1-t); },
    calcControlPoints: function (start, end, variant) {
        if (!variant) {
          variant = 0;
        }
        const points = [start, [], [], end];
        const latInc = Math.abs(start[1] - end[1]) / 3;
        const lngInc = Math.abs(start[0] - end[0]) / 3;
      
        if (start[1] < end[1]) {
          points[1][1] = start[1] + 2 + variant + latInc;
          points[2][1] = start[1] + 2 + variant + 2 * latInc;
        } else {
          points[1][1] = start[1] - 2 - latInc;
          points[2][1] = start[1] - 2 - 2 * latInc;
        }
      
        if (start[0] < end[0]) {
          points[1][0] = start[0] + lngInc;
          points[2][0] = start[0] + 2 * lngInc;
        } else {
          points[1][0] = start[0] - lngInc;
          points[2][0] = start[0] - 2 * lngInc;
        }
      
        return points;
    },
    getBezier: function (t) {
        p = this.controlPoints;
        const percent = 1-t;
        const pos = [];
        pos[1] = p[0][1]*this.B1(percent) + p[1][1]*this.B2(percent) + p[2][1]*this.B3(percent) + p[3][1]*this.B4(percent);
        pos[0] = p[0][0]*this.B1(percent) + p[1][0]*this.B2(percent) + p[2][0]*this.B3(percent) + p[3][0]*this.B4(percent);
        return pos;
    }
}

function buildCubicBezierCurve(start, end, variant, resolution) {
    var resolution = resolution ? resolution : 0.05;
    var points = [];
    var curve = new CubicBezierCurve(start, end, variant);

    for (i = 0; i <= 1; i += resolution) {
        points.push(curve.getBezier(i));
    }

    points.push(curve.getBezier(1));

    return points;
}

function incrementCountriesCount(countriesMap, country, startYear, endYear, person) {
    var firstYear = 1915;
    var lastYear = 2025;
    var totalYearsCount = lastYear - firstYear;

    var countryKey = country;
    var countriesCounts = countriesMap.get(countryKey);

    if (!countriesCounts) {
        countriesCounts = {
            name: country,
            counts: new Array(totalYearsCount).fill(0),
            peopleList: Array.from({ length: totalYearsCount }, () => [])
        };
        countriesMap.set(countryKey, countriesCounts);
    }

    var yearsCount = endYear - startYear + 1;
    var startIndex = startYear - firstYear;
    for (var k = 0; k < yearsCount; k++) {
        var currentIndex = startIndex + k;
        if (currentIndex >= 0 && currentIndex < totalYearsCount) {
            countriesCounts.counts[currentIndex]++;
            if (!countriesCounts.peopleList[currentIndex].includes(person)) {
                countriesCounts.peopleList[currentIndex].push(person);
            }
        }
    }
}

function buildCountryPopulationFeature(country, startYear, endYear, peopleList) {
    // Extract unique people in the time period
    var uniquePeople = new Set();
    for (var year = startYear - 1915; year <= endYear - 1915; year++) {
        if (peopleList[year]) { // Ensure peopleList[year] is defined
            peopleList[year].forEach(person => uniquePeople.add(person));
        }
    }

    var popCount = uniquePeople.size;
    var feature = {
        type: "Feature",
        geometry: {
            type: "MultiPolygon",
            coordinates: []
        },
        properties: {
            country: country,
            start_date: `${startYear}-01-01`,
            end_date: `${endYear}-12-31`,
            population: popCount,
            people: Array.from(uniquePeople).map(person => `${person.name} ${person.surname}`)
        }
    };

    return feature;
}


function buildCountryFeatures(country, counts, peopleList) {
    var oldCounts = counts[0];
    var firstYear = 1915;
    var startYear = firstYear;
    var features = [];
    var oldPeopleSet = new Set(peopleList[0].map(person => `${person.name} ${person.surname}`));

    // Group data in ranges with the same population count
    for (var i = 1; i < counts.length; i++) {
        var currentPeopleSet = new Set(peopleList[i].map(person => `${person.name} ${person.surname}`));
        if (counts[i] != oldCounts || !areSetsEqual(oldPeopleSet, currentPeopleSet)) {
            if (oldCounts >= 1) { // Include features with population greater than or equal to 1
                var feature = buildCountryPopulationFeature(country, startYear, firstYear + i - 1, peopleList);
                features.push(feature);
            }
            oldCounts = counts[i];
            oldPeopleSet = currentPeopleSet;
            startYear = firstYear + i;
        }
    }

    // Add the last value
    if (oldCounts >= 1) {
        var feature = buildCountryPopulationFeature(country, startYear, firstYear + counts.length - 1, peopleList);
        features.push(feature);
    }

    return features;
}


function buildPolygonsForCountries(population) {
    var result = {
        type: "FeatureCollection",
        features: []
    };
    var countriesMap = new Map();
    
    // Create population count by year for every country
    for (var i = 0; i < population.length; i++) {
        var person = population[i];

        // Increment counts since birth year
        var birthCountry = person.birth.place.country;
        var birthYear = parseInt(person.birth.date.substr(0,4));
        var departureYear = parseInt(person.journeys[0].departure.date.substr(0,4));
        incrementCountriesCount(countriesMap, birthCountry, birthYear, departureYear, person);

        // Increment counts for journeys
        for (var j = 0; j < person.journeys.length-1; j++) {
            var arrivalCountry = person.journeys[j].arrival.place.country;
            var arrivalYear = parseInt(person.journeys[j].arrival.date.substr(0,4));
            var departureYear = parseInt(person.journeys[j+1].departure.date.substr(0,4));
            incrementCountriesCount(countriesMap, arrivalCountry, arrivalYear, departureYear, person);
        }
        // Increment for the last place until 2025
        var lastCountry = person.journeys[person.journeys.length - 1].arrival.place.country;
        var lastDepartureYear = parseInt(person.journeys[person.journeys.length - 1].arrival.date.substr(0, 4));
        incrementCountriesCount(countriesMap, lastCountry, lastDepartureYear, 2025, person);
    }

    // Create features for all countries
    var countries = Array.from(countriesMap.values());
    for (var i = 0; i < countries.length; i++) {
        var country = countries[i];
        var features = buildCountryFeatures(country.name, country.counts, country.peopleList);
        
        // Add all features to result.features array
        Array.prototype.push.apply(result.features, features);
    }
    
    return result;
}

/* ### CREATE THE PLACE POINTS ### */

function incrementPlacesCount(placesMap, placeName, coordinates, startYear, endYear, person) {
    var firstYear = 1915;
    var lastYear = 2025;
    var totalYearsCount = lastYear - firstYear;

    var placeKey = placeName;
    var placesCounts = placesMap.get(placeKey);

    if (!placesCounts) {
        placesCounts = {
            name: placeName,
            coordinates: coordinates,
            counts: new Array(totalYearsCount).fill(0),
            peopleList: Array.from({ length: totalYearsCount }, () => [])
        };
        placesMap.set(placeKey, placesCounts);
    }

    var yearsCount = endYear - startYear + 1;
    var startIndex = startYear - firstYear;
    for (var k = 0; k < yearsCount; k++) {
        var currentIndex = startIndex + k;
        if (currentIndex >= 0 && currentIndex < totalYearsCount) {
            placesCounts.counts[currentIndex]++;
            if (!placesCounts.peopleList[currentIndex].includes(person)) {
                placesCounts.peopleList[currentIndex].push(person);
            }
        }
    }
}

function buildPlacePopulationFeature(placeName, coordinates, startYear, endYear, peopleList) {
    // Extract unique people in the time period
    var uniquePeople = new Set();
    for (var year = startYear - 1915; year <= endYear - 1915; year++) {
        if (peopleList[year]) { // Ensure peopleList[year] is defined
            peopleList[year].forEach(person => uniquePeople.add(person));
        }
    }

    var popCount = uniquePeople.size;
    var feature = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: coordinates
        },
        properties: {
            place: placeName,
            start_date: `${startYear}-01-01`,
            end_date: `${endYear}-12-31`,
            population: popCount,
            people: Array.from(uniquePeople).map(person => `${person.name} ${person.surname}`)
        }
    };

    return feature;
}

function buildPlaceFeatures(placeName, coordinates, counts, peopleList) {
    var firstYear = 1915;
    var startYear = firstYear;
    var features = [];
    var oldPeopleSet = new Set(peopleList[0].map(person => `${person.name} ${person.surname}`));
    var oldCounts = counts[0];

    for (var i = 1; i < counts.length; i++) {
        var currentPeopleSet = new Set(peopleList[i].map(person => `${person.name} ${person.surname}`));
        if (counts[i] != oldCounts || !areSetsEqual(oldPeopleSet, currentPeopleSet)) {
            if (oldCounts >= 1) { // Include features with population greater than or equal to 1
                var feature = buildPlacePopulationFeature(placeName, coordinates, startYear, firstYear + i - 1, peopleList);
                features.push(feature);
            }
            oldCounts = counts[i];
            oldPeopleSet = currentPeopleSet;
            startYear = firstYear + i;
        }
    }

    if (oldCounts >= 1) {
        var feature = buildPlacePopulationFeature(placeName, coordinates, startYear, firstYear + counts.length - 1, peopleList);
        features.push(feature);
    }

    return features;
}

function areSetsEqual(setA, setB) {
    if (setA.size !== setB.size) {
        return false;
    }
    for (var item of setA) {
        if (!setB.has(item)) {
            return false;
        }
    }
    return true;
}

function buildPointForPlaces(population) {
    var result = {
        type: "FeatureCollection",
        features: []
    };
    var placesMap = new Map();

    // Create population count by year for every place
    for (var i = 0; i < population.length; i++) {
        var person = population[i];

        // Increment counts for the birth place
        var birthPlace = person.birth.place.name;
        var birthCoordinates = person.birth.place.coordinates;
        var birthYear = parseInt(person.birth.date.substr(0, 4));
        var departureYear = parseInt(person.journeys[0].departure.date.substr(0, 4));
        incrementPlacesCount(placesMap, birthPlace, birthCoordinates, birthYear, departureYear, person);

        // Increment counts for each journey's arrival place
        for (var j = 0; j < person.journeys.length - 1; j++) {
            var arrivalPlace = person.journeys[j].arrival.place.name;
            var arrivalCoordinates = person.journeys[j].arrival.place.coordinates;
            var arrivalYear = parseInt(person.journeys[j].arrival.date.substr(0, 4));
            var departureYear = parseInt(person.journeys[j + 1].departure.date.substr(0, 4));
            incrementPlacesCount(placesMap, arrivalPlace, arrivalCoordinates, arrivalYear, departureYear, person);
        }

        // Increment for the last place until 2025
        var lastPlace = person.journeys[person.journeys.length - 1].arrival.place.name;
        var lastCoordinates = person.journeys[person.journeys.length - 1].arrival.place.coordinates;
        var lastDepartureYear = parseInt(person.journeys[person.journeys.length - 1].arrival.date.substr(0, 4));
        incrementPlacesCount(placesMap, lastPlace, lastCoordinates, lastDepartureYear, 2025, person);
    }

    // Create features for all places
    var places = Array.from(placesMap.values());
    for (var i = 0; i < places.length; i++) {
        var place = places[i];
        var features = buildPlaceFeatures(place.name, place.coordinates, place.counts, place.peopleList);

        // Add all features to result.features array
        Array.prototype.push.apply(result.features, features);
    }

    return result;
}
 
/* ### CREATE THE JOURNEY LINES ### */

function buildLineForJourneys(population) {
    var result = {
        type: "FeatureCollection",
        features: []
    };

    // Map to keep track of journey counts for each line (keyed by start and end places with departure year)
    var journeyMap = new Map();

    // Iterate over the population data
    for (var i = 0; i < population.length; i++) {
        var person = population[i];

        // Process each journey of the person
        for (var j = 0; j < person.journeys.length; j++) {
            var departurePlace = person.journeys[j].departure.place;
            var arrivalPlace = person.journeys[j].arrival.place;
            var departureYear = parseInt(person.journeys[j].departure.date.substr(0, 4));

            // Create a unique key to represent this journey (departure and arrival coordinates + year)
            var journeyKey = `${departurePlace.name}-${arrivalPlace.name}-${departureYear}`;

            // Check if the journey already exists in the map
            var journey = journeyMap.get(journeyKey);
            if (!journey) {
                // Generate the cubic Bezier curve coordinates between departure and arrival places
                var bezierPoints = buildCubicBezierCurve(departurePlace.coordinates, arrivalPlace.coordinates, undefined, 0.01);

                // If not, create a new entry for this journey
                journey = {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: bezierPoints
                    },
                    properties: {
                        start_date: `${departureYear}-01-01`,
                        end_date: `${departureYear}-12-31`,
                        departure_place: departurePlace.name,
                        arrival_place: arrivalPlace.name,
                        departure_year: departureYear,
                        people_count: 0,
                        people: []
                    }
                };
                journeyMap.set(journeyKey, journey);
            }

            // Increment the people count for this journey
            journey.properties.people_count++;
            journey.properties.people.push(`${person.name} ${person.surname}`);
        }
    }

    // Convert the journeyMap values into the FeatureCollection
    result.features = Array.from(journeyMap.values());

    return result;
}


function buildFeaturesForSinglePersonJourneys(person) {
    // features should never disappear so end date is in the future
    var END_DATE = "2050-12-31";
    var result = {
        type: "FeatureCollection",
        features: []
    };

    var birthYear = person.birth.date.substr(0, 4);

    // birth point
    var feature = {
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: person.birth.place.coordinates
        },
        properties: {
            place: person.birth.place.name,
            start_date: `${birthYear}-01-01`,
            end_date: END_DATE,
        }
    };
    result.features.push(feature);
    
    var variants = new Map();

    for (var i = 0; i < person.journeys.length; i++) {
        var journey = person.journeys[i];
        var departurePlace = journey.departure.place;
        var arrivalPlace = journey.arrival.place;
        var journeyKey = `${departurePlace}-arrivalPlace`;
        if (!variants.has(journeyKey)) {
            variants.set(journeyKey, 0);
        }
        var variant = variants.get(journeyKey);
        variants.set(journeyKey, variant+1);
        var departureYear = parseInt(journey.departure.date.substr(0, 4));

        var bezierPoints = buildCubicBezierCurve(departurePlace.coordinates,
                arrivalPlace.coordinates, variant, 0.01);
        
        feature = {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: bezierPoints
            },
            properties: {
                start_date: `${departureYear}-01-01`,
                end_date: END_DATE,
                reason: journey.reason,
                departure_place: departurePlace.name,
                departure_date: journey.departure.date,
                arrival_place: arrivalPlace.name,
                arrival_date: journey.arrival.date,
            }
        };

        result.features.push(feature);
    }

    return result;
}