import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Navigation, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

// Coordenadas da barbearia (R. Heide Carneiro, 50 - Trobogy, Salvador - BA)
const BARBERSHOP_COORDS: [number, number] = [-38.4057596, -12.9293001];

const MapView = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: BARBERSHOP_COORDS,
      zoom: 15,
    });

    // Add barbershop marker
    new mapboxgl.Marker({ color: '#3B82F6' })
      .setLngLat(BARBERSHOP_COORDS)
      .setPopup(new mapboxgl.Popup().setHTML('<p><strong>Barbearia</strong><br>R. Heide Carneiro, 50 - Trobogy</p>'))
      .addTo(map.current);

    return () => {
      map.current?.remove();
    };
  }, [mapboxToken]);

  const getUserLocation = () => {
    setIsLoadingLocation(true);
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(coords);
          
          if (map.current) {
            // Add user location marker
            new mapboxgl.Marker({ color: '#10B981' })
              .setLngLat(coords)
              .setPopup(new mapboxgl.Popup().setHTML('<p>Sua localização</p>'))
              .addTo(map.current);
              
            // Fit map to show both locations
            const bounds = new mapboxgl.LngLatBounds();
            bounds.extend(coords);
            bounds.extend(BARBERSHOP_COORDS);
            map.current.fitBounds(bounds, { padding: 50 });
          }
          
          setIsLoadingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setIsLoadingLocation(false);
    }
  };

  const openDirections = () => {
    if (userLocation) {
      // Use Google Maps for better mobile support
      const googleMapsUrl = `https://www.google.com/maps/dir/${userLocation[1]},${userLocation[0]}/-12.9293001,-38.4057596`;
      window.open(googleMapsUrl, '_blank');
    } else {
      // Open directions to barbershop from current location
      const googleMapsUrl = 'https://www.google.com/maps/dir//R.+Heide+Carneiro,+50+-+Trobogy,+Salvador+-+BA,+41745-135';
      window.open(googleMapsUrl, '_blank');
    }
  };

  if (!mapboxToken) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Localização da Barbearia
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Insira seu token público do Mapbox para visualizar o mapa:
          </p>
          <Input
            placeholder="pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJja..."
            value={mapboxToken}
            onChange={(e) => setMapboxToken(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Obtenha seu token em: <a href="https://mapbox.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">mapbox.com</a>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Localização da Barbearia
          </CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={getUserLocation}
              disabled={isLoadingLocation}
            >
              <MapPin className="w-4 h-4" />
              {isLoadingLocation ? 'Localizando...' : 'Minha Localização'}
            </Button>
            <Button
              size="sm"
              onClick={openDirections}
            >
              <Navigation className="w-4 h-4" />
              Como Chegar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={mapContainer} className="w-full h-64 rounded-lg" />
        <p className="text-sm text-muted-foreground mt-2">
          R. Heide Carneiro, 50 - Trobogy, Salvador - BA
        </p>
      </CardContent>
    </Card>
  );
};

export default MapView;