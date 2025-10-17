import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Car } from 'lucide-react-native';

const { width } = Dimensions.get('window');

interface LiveDriverTrackingProps {
  driverLocation: {
    latitude: number;
    longitude: number;
    heading?: number;
  } | null;
  pickupLocation: {
    latitude: number;
    longitude: number;
    address: string;
  };
  driverInfo: {
    name: string;
    vehicle: string;
    plateNumber: string;
    phone?: string;
  };
  onDriverArrived?: () => void;
}

export default function LiveDriverTracking({
  driverLocation,
  pickupLocation,
  driverInfo,
  onDriverArrived,
}: LiveDriverTrackingProps) {
  const [distance, setDistance] = useState<number>(0);
  const [eta, setEta] = useState<number>(5);
  const [calculatedHeading, setCalculatedHeading] = useState<number>(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (driverLocation) {
      const dist = calculateDistance(
        driverLocation.latitude,
        driverLocation.longitude,
        pickupLocation.latitude,
        pickupLocation.longitude
      );
      setDistance(dist);

      const calculatedETA = Math.max(1, Math.round((dist / 30) * 60));
      setEta(calculatedETA);

      const heading = calculateHeading(
        driverLocation.latitude,
        driverLocation.longitude,
        pickupLocation.latitude,
        pickupLocation.longitude
      );
      setCalculatedHeading(heading);

      if (dist < 0.05) {
        onDriverArrived?.();
      }
    }
  }, [driverLocation, pickupLocation]);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const calculateHeading = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(dLon);
    const heading = Math.atan2(y, x);
    return ((heading * 180) / Math.PI + 360) % 360;
  };

  const formatDistance = (km: number): string => {
    if (km < 1) {
      return `${Math.round(km * 1000)}m`;
    }
    return `${km.toFixed(1)}km`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.98)', 'rgba(249,250,251,0.98)']}
        style={styles.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <View style={styles.horizontalRow}>
          <View style={styles.etaBadge}>
            <Text style={styles.etaText}>{eta}min</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.distanceText}>{formatDistance(distance)}</Text>

          <View style={styles.divider} />

          <View style={styles.driverCompact}>
            <Car size={12} color="#2563EB" />
            <Text style={styles.driverText} numberOfLines={1} ellipsizeMode="tail">
              {driverInfo.name || 'Driver'}
            </Text>
            <Text style={styles.plateText}>• {driverInfo.plateNumber}</Text>
          </View>

          {driverLocation && (
            <View style={styles.liveBadge}>
              <View style={styles.livePulse} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 10,
    marginVertical: 6,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  horizontalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  etaBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  etaText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 8,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  driverCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginHorizontal: 8,
  },
  driverText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    flexShrink: 1,
    maxWidth: 80,
  },
  plateText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
    flexShrink: 0,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  livePulse: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
});
