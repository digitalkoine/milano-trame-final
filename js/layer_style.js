// Create the style function for the country layer based on population
function style_countries(feature) {
    var population = feature.properties.population;
    var fillColor, borderColor = 'white', weight, fillOpacity;

    // Set fillColor and other style properties based on population categories
    if (population > 50) {
        fillColor = "#DB7093"; // Medium Dark Pink
        weight = 2; // Border thickness
    } else if (population > 25) {
        fillColor = "#FF69B4"; // Hot Pink
        weight = 2;
    } else if (population > 10) {
        fillColor = "#FFB6C1"; // Light Pink
        weight = 1;
    } else if (population > 5) {
        fillColor = "#FFC0CB"; // Pink
        weight = 1;
    } else if (population > 1) {
        fillColor = "#FFD1DC"; // Very Light Pink
        weight = 1;
    } else if (population > 0) {
        fillColor = "#FFE4E1"; // Lightest Pink
        weight = 1;
    } else {
        fillColor = "#FFFFFF"; // White for no population
        weight = 0;
    }

    return {
        fillColor: fillColor,
        weight: weight,
        opacity: 1,
        color: borderColor,
        fillOpacity: 0.8,
        interactive: true,
    };
}

// Create the style function for the circle marker based on population
function style_citypoint_1(feature) {
    var population = feature.properties.population;
    var radius, color;

    // Set radius and color based on population categories
    if (population <= 1) {
        radius = 5;
        color = "#FFCA8F";
    } else if (population <= 10) {
        radius = 10;
        color = "#fe9929";
    } else if (population <= 25) {
        radius = 15;
        color = "#d95f0e";
    } else if (population <= 50) {
        radius = 20;
        color = "#993404";
    } else {
        radius = 25;
        color = "#990046";
    }

    return {
        radius: radius,
        fillColor: color,
        color: "#FFF", // Border color of the circle
        weight: 1, // Border thickness
        opacity: 1,
        fillOpacity: 1
    };
}

// Create the style function for the lines based on people_count
function style_journeyline(feature) {
    var peopleCount = feature.properties.people_count;
    var weight, color;

    // Set line weight and color based on people_count categories
    if (peopleCount <= 1) {
        weight = 2;
        color = "#4ED559";
    } else if (peopleCount <= 2) {
        weight = 4;
        color = "#5BAA61";
    } else {
        weight = 6;
        color = "#59805C";
    }

    return {
        color: color,
        weight: weight,
        opacity: 1,
        color: color,
        weight: weight,
        opacity: 1,
    };
}
