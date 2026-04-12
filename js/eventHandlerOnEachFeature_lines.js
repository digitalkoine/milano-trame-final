
      map.createPane('pane_jsonLayer_lines');
      map.getPane('pane_jsonLayer_lines').style.zIndex = 401;
      map.getPane('pane_jsonLayer_lines').style['mix-blend-mode'] = 'normal';

      var jsonLayer_lines=L.geoJson.multiStyle(line_birth,{
        onEachFeature: function(feature, layer) {
          var prevLayerClicked = null
          layer.bindPopup(
            '<p>'+'<strong>'+feature.properties.name+'</strong>'+
            '<p>'+'Data di nascita: '+feature.properties.dateOfBirth_label+
            '<br>'+'Data di arresto a Milano e di trasferimento a '+feature.properties.detentionPlace+': '+feature.properties.arrestDate_label+
            '<br>'+'Data di arrivo a '+feature.properties.labelToNaziCamp+' con convoglio numero '+feature.properties.convoyNumber_1+': '+ feature.properties.convoyArrivalDate2+
            '<br>'+feature.properties.deathDescription+
            '</p>'
            );
          /*layer.on({
            'click': function(event) {
              if (prevLayerClicked !== null){
                event.target.setStyle({
                    pane: 'pane_jsonLayer_lines',
                    opacity: 1,
                    color: 'rgba(206,0,206,1.0)',
                    dashArray: '',
                    lineCap: 'round',
                    lineJoin: 'round',
                    weight: 0.2,
                    fill: false,
                    interactive: true,
                })
                prevLayerClicked = null
              }
              else {
                event.target.setStyle({
                    pane: 'pane_jsonLayer_lines',
                    opacity: 1,
                    color: 'yellow',
                    dashArray: '',
                    lineCap: 'round',
                    lineJoin: 'round',
                    weight: 4,
                    fill: false,
                    interactive: true,
                  });
                  //event.target.bringToFront();
                  prevLayerClicked = layer;
              }
            }
          });*/
        },
        pane: 'pane_jsonLayer_lines_second',
        styles:[style_line_1, style_line_0],
        arrowheads: {
          yawn:'90',
          fill: false,
          frequency: '2',
          size: '5px'
        }
      });

      map.createPane('pane_jsonLayer_lines_second');
      map.getPane('pane_jsonLayer_lines_second').style.zIndex = 400;
      map.getPane('pane_jsonLayer_lines_second').style['mix-blend-mode'] = 'normal';

      var jsonLayer_lines_second = L.geoJson(line,{
        onEachFeature: function(feature, layer){
          layer.bindPopup(
            '<p>'+'<strong>'+feature.properties.name+'</strong>'+
            '<p>'+'Data di nascita: '+feature.properties.dateOfBirth_label+
            '<br>'+'Data di arresto a Milano e di trasferimento a '+feature.properties.detentionPlace+': '+feature.properties.arrestDate+
            '<br>'+'Data di arrivo a '+feature.properties.labelToNaziCamp+' con convoglio numero '+feature.properties.convoyNumber_1+': '+ feature.properties.convoyArrivalDate2+
            '<br>'+feature.properties.deathDescription+
            '</p>'
            );
        },
        pane: 'pane_jsonLayer_lines_second',
        style:style_line_2,
        arrowheads: {
          yawn:'120',
          fill: false,
          frequency: '2',
          size: '5px'
        }
      });

      var jsonLayer_lines_time = L.TimeDimension.Layer.lines (jsonLayer_lines_second, {
        updateTimeDimensionMode: 'union', //changing this changes the way the point appear on the map
        duration: 'P0D',//how long the feature remains there until its time as passed
      });
      jsonLayer_lines_time.addTo(map);
