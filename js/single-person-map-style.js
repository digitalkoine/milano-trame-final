function style_journeyline_reason(feature) {
    var weight = 2
    var reasonStyles = {
        "economic": {
            weight: weight,
            color: '#00ffff'
        },
        "personal": {
            weight: weight,
            color: '#00ff00'
        },
        "politics": {
            weight: weight,
            color: '#ff0000'
        },
        "study": {
            weight: weight,
            color: '#0000ff'
        },
        "in transit": {
            weight: weight,
            color: '#000000'
        },
        "unknown": {
            weight: weight,
            color: '#aaaaaa'
        }
    };

    if (feature.geometry.type == 'LineString') {
        var reason = feature.properties.reason;
        return reasonStyles[reason];
    } else {
        return {
            radius: 2,
            fillColor: "#000000",
            color: "#000000",
            weight: 5,
            opacity: 1,          
            fillOpacity: 1,
            interactive: true
        };
    }
}
