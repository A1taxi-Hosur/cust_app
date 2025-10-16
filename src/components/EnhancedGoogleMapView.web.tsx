import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { GOOGLE_MAPS_API_KEY, HOSUR_COORDINATES } from '../config/maps';
import { googleMapsService } from '../services/googleMapsService';
import { enhancedLocationService } from '../services/enhancedLocationService';
import { AvailableDriver } from '../services/driverLocationService';

interface EnhancedGoogleMapViewProps {
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  pickupCoords?: { latitude: number; longitude: number };
  destinationCoords?: { latitude: number; longitude: number };
  driverLocation?: { latitude: number; longitude: number; heading?: number; speed?: number };
  availableDrivers?: AvailableDriver[];
  showRoute?: boolean;
  showDriverToPickupRoute?: boolean;
  onMapPress?: (coordinate: { latitude: number; longitude: number }) => void;
  onRouteReady?: (result: { distance: number; duration: number }) => void;
  style?: any;
  showUserLocation?: boolean;
  followUserLocation?: boolean;
}

export interface MapRef {
  fitToCoordinates: (coordinates: any[], options?: any) => void;
  animateToRegion: (region: any, duration?: number) => void;
  getMapBoundaries: () => Promise<any>;
}

const EnhancedGoogleMapView = forwardRef<MapRef, EnhancedGoogleMapViewProps>(({
  initialRegion,
  pickupCoords,
  destinationCoords,
  driverLocation,
  availableDrivers = [],
  showRoute = false,
  showDriverToPickupRoute = false,
  onMapPress,
  onRouteReady,
  style,
  showUserLocation = true,
  followUserLocation = false,
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const previousDriverLocationRef = useRef<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [userLocation, setUserLocation] = useState<any>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  // Debug props when they change
  useEffect(() => {
    console.log('🗺️ [WEB-MAP] Props updated:', {
      showRoute,
      showDriverToPickupRoute,
      hasDriverLocation: !!driverLocation,
      hasPickupCoords: !!pickupCoords,
      hasDestinationCoords: !!destinationCoords,
      driverLocation: driverLocation ? { lat: driverLocation.latitude, lng: driverLocation.longitude } : null,
      pickupCoords: pickupCoords ? { lat: pickupCoords.latitude, lng: pickupCoords.longitude } : null,
      destinationCoords: destinationCoords ? { lat: destinationCoords.latitude, lng: destinationCoords.longitude } : null,
    });
  }, [showRoute, showDriverToPickupRoute, driverLocation, pickupCoords, destinationCoords]);

  useImperativeHandle(ref, () => ({
    fitToCoordinates: (coordinates: any[], options?: any) => {
      if (googleMapRef.current && coordinates.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        coordinates.forEach(coord => {
          bounds.extend(new google.maps.LatLng(coord.latitude, coord.longitude));
        });
        googleMapRef.current.fitBounds(bounds);
      }
    },
    animateToRegion: (region: any, duration: number = 1000) => {
      if (googleMapRef.current) {
        googleMapRef.current.panTo({
          lat: region.latitude,
          lng: region.longitude
        });
        googleMapRef.current.setZoom(15);
      }
    },
    getMapBoundaries: async () => {
      if (googleMapRef.current) {
        const bounds = googleMapRef.current.getBounds();
        return bounds;
      }
      return null;
    },
  }));

  useEffect(() => {
    loadGoogleMapsScript();
  }, []);

  useEffect(() => {
    if (isGoogleMapsLoaded) {
      initializeMap();
    }
  }, [isGoogleMapsLoaded]);

  useEffect(() => {
    if (showUserLocation) {
      getCurrentUserLocation();
    }
  }, [showUserLocation]);

  useEffect(() => {
    if (isMapReady) {
      updateMarkers();
    }
  }, [isMapReady, pickupCoords, destinationCoords, userLocation, availableDrivers]);

  useEffect(() => {
    if (isMapReady && googleMapRef.current && driverLocation) {
      const hasChanged = !previousDriverLocationRef.current ||
        previousDriverLocationRef.current.latitude !== driverLocation.latitude ||
        previousDriverLocationRef.current.longitude !== driverLocation.longitude ||
        previousDriverLocationRef.current.heading !== driverLocation.heading;

      if (hasChanged) {
        console.log('🗺️ Map: Driver location changed!', {
          old: previousDriverLocationRef.current,
          new: driverLocation,
        });
        updateDriverMarker(driverLocation);
        previousDriverLocationRef.current = { ...driverLocation };
      } else {
        console.log('⚠️ Map: driverLocation prop updated but values unchanged');
      }
    }
  }, [isMapReady, driverLocation]);

  useEffect(() => {
    if (isMapReady && showRoute) {
      if (showDriverToPickupRoute && driverLocation && pickupCoords) {
        console.log('🗺️ [WEB-MAP] Calculating driver → pickup route');
        calculateAndDisplayRoute(driverLocation, pickupCoords);
      } else if (!showDriverToPickupRoute && pickupCoords && destinationCoords) {
        console.log('🗺️ [WEB-MAP] Calculating pickup → destination route');
        calculateAndDisplayRoute(pickupCoords, destinationCoords);
      }
    }
  }, [isMapReady, showRoute, showDriverToPickupRoute, driverLocation, pickupCoords, destinationCoords]);

  const loadGoogleMapsScript = () => {
    if (window.google && window.google.maps) {
      setIsGoogleMapsLoaded(true);
      return;
    }

    // Check if Google Maps script is already being loaded or exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      console.log('🗺️ Google Maps script already exists, waiting for load...');
      
      // If script exists but Google Maps isn't loaded yet, wait for it
      const checkGoogleMaps = () => {
        if (window.google && window.google.maps) {
          setIsGoogleMapsLoaded(true);
        } else {
          setTimeout(checkGoogleMaps, 100);
        }
      };
      checkGoogleMaps();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✅ Google Maps script loaded successfully');
      setIsGoogleMapsLoaded(true);
    };
    script.onerror = (error) => {
      console.error('❌ Error loading Google Maps script:', error);
      setIsGoogleMapsLoaded(false);
    };
    
    document.head.appendChild(script);
  };

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps || !window.google.maps.Map) {
      console.error('Cannot initialize map: missing dependencies');
      return;
    }

    const region = initialRegion || HOSUR_COORDINATES;
    
    try {
      const map = new google.maps.Map(mapRef.current, {
        center: {
          lat: region.latitude,
          lng: region.longitude,
        },
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      });

      googleMapRef.current = map;
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#2563EB',
          strokeWeight: 4,
        },
      });
      directionsRenderer.current.setMap(map);

      map.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (onMapPress && event.latLng) {
          onMapPress({
            latitude: event.latLng.lat(),
            longitude: event.latLng.lng(),
          });
        }
      });

      setIsMapReady(true);
      console.log('🗺️ Web map initialized successfully');
    } catch (error) {
      console.error('Error initializing Google Map:', error);
    }
  };

  const getCurrentUserLocation = async () => {
    try {
      const location = await enhancedLocationService.getCurrentLocation();
      if (location) {
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (!pickupCoords && !destinationCoords && googleMapRef.current) {
          googleMapRef.current.panTo({
            lat: location.coords.latitude,
            lng: location.coords.longitude,
          });
          googleMapRef.current.setZoom(15);
        }
      }
    } catch (error) {
      console.error('Error getting user location:', error);
    }
  };

  const createCarIcon = (heading: number = 0) => {
    const rotation = heading;
    const svg = `
      <svg width="70" height="70" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="carBody" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#3B82F6" stop-opacity="1" />
            <stop offset="100%" stop-color="#1E40AF" stop-opacity="1" />
          </linearGradient>
          <linearGradient id="carTop" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#60A5FA" stop-opacity="1" />
            <stop offset="100%" stop-color="#3B82F6" stop-opacity="1" />
          </linearGradient>
          <linearGradient id="carWindow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#93C5FD" stop-opacity="0.8" />
            <stop offset="100%" stop-color="#60A5FA" stop-opacity="0.6" />
          </linearGradient>
        </defs>
        <g transform="rotate(${rotation} 50 50)">
          <!-- Shadow -->
          <ellipse cx="50" cy="70" rx="18" ry="4" fill="rgba(0,0,0,0.3)"/>

          <!-- Isometric 3D Car -->
          <g transform="translate(0, 0)">
            <!-- Car body - bottom -->
            <path d="M 30 55 L 45 45 L 70 45 L 70 60 L 30 60 Z" fill="url(#carBody)" stroke="#1E3A8A" stroke-width="1.5"/>

            <!-- Car body - top cabin -->
            <path d="M 35 45 L 45 35 L 60 35 L 65 45 Z" fill="url(#carTop)" stroke="#1E3A8A" stroke-width="1.5"/>

            <!-- Front windshield -->
            <path d="M 45 35 L 50 40 L 60 40 L 60 35 Z" fill="url(#carWindow)" stroke="#1E40AF" stroke-width="1"/>

            <!-- Side window -->
            <path d="M 35 45 L 40 40 L 45 40 L 45 45 Z" fill="url(#carWindow)" stroke="#1E40AF" stroke-width="1"/>

            <!-- Front wheel -->
            <circle cx="60" cy="60" r="5" fill="#1F2937" stroke="#374151" stroke-width="1.5"/>
            <circle cx="60" cy="60" r="3" fill="#4B5563"/>

            <!-- Rear wheel -->
            <circle cx="38" cy="60" r="5" fill="#1F2937" stroke="#374151" stroke-width="1.5"/>
            <circle cx="38" cy="60" r="3" fill="#4B5563"/>

            <!-- Headlights -->
            <circle cx="68" cy="52" r="2" fill="#FCD34D" opacity="0.9"/>

            <!-- Side mirror -->
            <path d="M 70 48 L 73 47 L 73 49 Z" fill="#2563EB" stroke="#1E40AF" stroke-width="1"/>

            <!-- Hood details -->
            <path d="M 50 45 L 53 45" stroke="#1E40AF" stroke-width="1" opacity="0.6"/>
          </g>
        </g>
      </svg>
    `;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(60, 60),
      anchor: new google.maps.Point(30, 30),
    };
  };

  const updateDriverMarker = (location: { latitude: number; longitude: number; heading?: number }) => {
    if (!googleMapRef.current || !window.google) return;

    const position = new google.maps.LatLng(location.latitude, location.longitude);
    const heading = location.heading || 0;

    if (driverMarkerRef.current) {
      console.log('🚗 Updating driver marker position:', location);
      driverMarkerRef.current.setPosition(position);
      driverMarkerRef.current.setIcon(createCarIcon(heading));
    } else {
      console.log('🚗 Creating driver marker at:', location);
      const driverMarker = new google.maps.Marker({
        position,
        map: googleMapRef.current,
        title: 'Driver Location',
        icon: createCarIcon(heading),
        optimized: false,
        zIndex: 1000,
      });
      driverMarkerRef.current = driverMarker;
    }
  };

  const updateMarkers = () => {
    if (!googleMapRef.current || !window.google) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add user location marker
    if (userLocation && showUserLocation) {
      const userMarker = new google.maps.Marker({
        position: { lat: userLocation.latitude, lng: userLocation.longitude },
        map: googleMapRef.current,
        title: 'Your Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#2563EB',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 2,
        },
      });
      markersRef.current.push(userMarker);
    }

    // Add pickup marker
    if (pickupCoords) {
      const pickupMarker = new google.maps.Marker({
        position: { lat: pickupCoords.latitude, lng: pickupCoords.longitude },
        map: googleMapRef.current,
        title: 'Pickup Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#059669',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(pickupMarker);
    }

    // Add destination marker
    if (destinationCoords) {
      const destinationMarker = new google.maps.Marker({
        position: { lat: destinationCoords.latitude, lng: destinationCoords.longitude },
        map: googleMapRef.current,
        title: 'Destination',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#DC2626',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
      });
      markersRef.current.push(destinationMarker);
    }

    // Driver marker is handled separately in updateDriverMarker to enable smooth animation

    // Add available drivers markers
    if (availableDrivers && availableDrivers.length > 0) {
      availableDrivers.forEach((driver, index) => {
        const availableDriverMarker = new google.maps.Marker({
          position: { lat: driver.latitude, lng: driver.longitude },
          map: googleMapRef.current,
          title: `${driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1)} Driver`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="15" fill="white" stroke="#E5E7EB" stroke-width="2"/>
                <text x="16" y="22" text-anchor="middle" font-size="16" fill="${getVehicleColor(driver.vehicle_type)}">🚗</text>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16),
          },
        });
        markersRef.current.push(availableDriverMarker);
      });
    }
  };

  const calculateAndDisplayRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    if (!origin || !destination || !directionsRenderer.current) return;

    try {
      console.log('🗺️ [WEB-MAP] Drawing route between:', origin, 'and', destination);

      // Skip route calculation if no valid API key
      if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY.includes('placeholder')) {
        console.warn('⚠️ No valid Google Maps API key, using fallback route');
        drawFallbackRoute(origin, destination);
        return;
      }

      // Use direct Google Directions Service with error handling
      const directionsService = new google.maps.DirectionsService();

      const request = {
        origin: { lat: origin.latitude, lng: origin.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        travelMode: google.maps.TravelMode.DRIVING,
      };
      
      directionsService.route(request, (result, status) => {
        try {
          if (status === google.maps.DirectionsStatus.OK && result && directionsRenderer.current) {
            directionsRenderer.current.setDirections(result);
            
            // Extract route info from result
            const route = result.routes[0];
            const leg = route.legs[0];
            
            onRouteReady?.({
              distance: leg.distance?.value ? leg.distance.value / 1000 : 0,
              duration: leg.duration?.value ? leg.duration.value / 60 : 0,
            });
            
            console.log('✅ Route drawn successfully on web map');
          } else {
            console.warn('⚠️ Directions service failed with status:', status, '- using fallback route');
            drawFallbackRoute(origin, destination);
          }
        } catch (directionsError) {
          console.error('❌ Error processing directions result:', directionsError);
          drawFallbackRoute(origin, destination);
        }
      });
    } catch (error) {
      console.error('Error calculating route for web:', error);
      drawFallbackRoute(origin, destination);
    }
  };

  const drawFallbackRoute = (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number }
  ) => {
    if (!googleMapRef.current || !origin || !destination) return;

    console.log('🗺️ [WEB-MAP] Drawing fallback straight line route');

    // Draw a simple polyline as fallback
    const routePath = new google.maps.Polyline({
      path: [
        { lat: origin.latitude, lng: origin.longitude },
        { lat: destination.latitude, lng: destination.longitude },
      ],
      geodesic: true,
      strokeColor: '#2563EB',
      strokeOpacity: 0.8,
      strokeWeight: 4,
    });
    
    routePath.setMap(googleMapRef.current);
    
    // Calculate simple distance
    const distance = enhancedLocationService.calculateHaversineDistance(
      pickupCoords.latitude,
      pickupCoords.longitude,
      destinationCoords.latitude,
      destinationCoords.longitude
    );
    
    onRouteReady?.({
      distance,
      duration: (distance / 30) * 60,
    });
  };

  return (
    <View style={[styles.container, style]}>
      <div
        ref={mapRef}
        style={{
          width: '100%',
          height: '100%',
        }}
      />
    </View>
  );
});

// Get color for different vehicle types
const getVehicleColor = (vehicleType: string): string => {
  const colorMap: { [key: string]: string } = {
    'hatchback': '#059669',
    'hatchback_ac': '#0891B2',
    'sedan': '#2563EB',
    'sedan_ac': '#7C3AED',
    'suv': '#DC2626',
    'suv_ac': '#EA580C',
  };
  return colorMap[vehicleType] || '#6B7280';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default EnhancedGoogleMapView;