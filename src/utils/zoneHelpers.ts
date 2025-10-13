import { Zone } from '../services/zoneService';

/**
 * Check if a point is within any of the active zones
 * Only checks against the Outer Ring zone
 */
export function isPointInAnyActiveZone(
  coordinates: { latitude: number; longitude: number },
  zones: Zone[]
): boolean {
  console.log('🔍 Checking if point is in service area:', {
    coordinates,
    zonesCount: zones.length,
    zones: zones.map(z => ({
      name: z.name,
      type: z.coordinates?.type,
      radius_km: z.radius_km,
      center_lat: z.center_latitude,
      center_lng: z.center_longitude
    }))
  });

  const outerRing = zones.find(z => z.name === 'Outer Ring');

  if (!outerRing) {
    console.warn('⚠️ Outer Ring zone not found, denying location by default');
    return false;
  }

  // Check if zone is a circle type (our current format)
  if (outerRing.coordinates?.type === 'circle') {
    console.log('🔍 Using circle-based zone validation');
    console.log('🔍 Raw Outer Ring data:', {
      center_latitude: outerRing.center_latitude,
      center_latitude_type: typeof outerRing.center_latitude,
      center_longitude: outerRing.center_longitude,
      center_longitude_type: typeof outerRing.center_longitude,
      radius_km: outerRing.radius_km,
      radius_km_type: typeof outerRing.radius_km,
    });

    const centerLat = typeof outerRing.center_latitude === 'string'
      ? parseFloat(outerRing.center_latitude)
      : outerRing.center_latitude;
    const centerLng = typeof outerRing.center_longitude === 'string'
      ? parseFloat(outerRing.center_longitude)
      : outerRing.center_longitude;
    const radiusKm = typeof outerRing.radius_km === 'string'
      ? parseFloat(outerRing.radius_km)
      : outerRing.radius_km;

    console.log('🔍 Parsed values:', {
      centerLat,
      centerLng,
      radiusKm,
      allValid: !isNaN(centerLat) && !isNaN(centerLng) && !isNaN(radiusKm)
    });

    const center = {
      latitude: centerLat,
      longitude: centerLng
    };

    const isInside = isPointInCircle(coordinates, center, radiusKm);
    console.log(`🔍 Point is ${isInside ? 'INSIDE' : 'OUTSIDE'} Outer Ring (${radiusKm}km radius)`);
    return isInside;
  }

  // Fallback to polygon check if coordinates exist
  if (outerRing.coordinates?.coordinates) {
    console.log('🔍 Using polygon-based zone validation');
    const isInside = isPointInPolygon(coordinates, outerRing.coordinates.coordinates);
    console.log(`🔍 Point is ${isInside ? 'INSIDE' : 'OUTSIDE'} Outer Ring polygon`);
    return isInside;
  }

  // Final fallback to direct radius check
  console.warn('⚠️ Outer Ring has no valid coordinates, using direct radius check');
  return isPointInCircle(
    coordinates,
    { latitude: parseFloat(outerRing.center_latitude), longitude: parseFloat(outerRing.center_longitude) },
    parseFloat(outerRing.radius_km)
  );
}

/**
 * Check if a point is within a specific zone
 */
function isPointInZone(
  coordinates: { latitude: number; longitude: number },
  zone: Zone
): boolean {
  // If zone has polygon coordinates, use polygon check
  if (zone.coordinates && Array.isArray(zone.coordinates)) {
    return isPointInPolygon(coordinates, zone.coordinates);
  }

  // Fallback to circular zone check using center and radius
  const centerLat = typeof zone.center_latitude === 'string'
    ? parseFloat(zone.center_latitude)
    : zone.center_latitude;
  const centerLng = typeof zone.center_longitude === 'string'
    ? parseFloat(zone.center_longitude)
    : zone.center_longitude;
  const radiusKm = typeof zone.radius_km === 'string'
    ? parseFloat(zone.radius_km)
    : zone.radius_km;

  return isPointInCircle(
    coordinates,
    { latitude: centerLat, longitude: centerLng },
    radiusKm
  );
}

/**
 * Check if a point is within a circular zone
 */
export function isPointInCircle(
  point: { latitude: number; longitude: number },
  center: { latitude: number; longitude: number },
  radiusKm: number
): boolean {
  // Validate inputs
  if (isNaN(point.latitude) || isNaN(point.longitude)) {
    console.error('❌ Invalid point coordinates:', point);
    return false;
  }

  if (isNaN(center.latitude) || isNaN(center.longitude)) {
    console.error('❌ Invalid center coordinates:', center);
    return false;
  }

  if (isNaN(radiusKm) || radiusKm <= 0) {
    console.error('❌ Invalid radius:', radiusKm);
    return false;
  }

  const distance = calculateHaversineDistance(
    point.latitude,
    point.longitude,
    center.latitude,
    center.longitude
  );

  if (isNaN(distance)) {
    console.error('❌ Haversine calculation returned NaN:', {
      point,
      center,
      radiusKm
    });
    return false;
  }

  const isInside = distance <= radiusKm;

  console.log('🔍 Circle zone check:', {
    point,
    center,
    radiusKm: radiusKm + 'km',
    calculatedDistance: distance.toFixed(2) + 'km',
    difference: (distance - radiusKm).toFixed(2) + 'km',
    isInside: isInside ? '✅ INSIDE' : '❌ OUTSIDE'
  });

  return isInside;
}

/**
 * Check if a point is within a polygon zone
 */
export function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: number[][]
): boolean {
  console.log('🔍 Polygon zone check:', {
    point,
    polygonPoints: polygon.length
  });

  if (!polygon || polygon.length < 3) {
    console.warn('⚠️ Invalid polygon data, falling back to false');
    return false;
  }

  let isInside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1]; // longitude
    const yi = polygon[i][0]; // latitude
    const xj = polygon[j][1]; // longitude
    const yj = polygon[j][0]; // latitude

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      isInside = !isInside;
    }
  }

  console.log('🔍 Polygon check result:', isInside);
  return isInside;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get the zone that contains a specific point
 */
export function getZoneForPoint(
  coordinates: { latitude: number; longitude: number },
  zones: Zone[]
): Zone | null {
  for (const zone of zones) {
    if (isPointInZone(coordinates, zone)) {
      return zone;
    }
  }
  return null;
}

/**
 * Get all zones that contain a specific point
 */
export function getZonesForPoint(
  coordinates: { latitude: number; longitude: number },
  zones: Zone[]
): Zone[] {
  return zones.filter(zone => isPointInZone(coordinates, zone));
}