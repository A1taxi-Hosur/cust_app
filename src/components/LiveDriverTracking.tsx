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
      <LinearGradient colors={['#FFFFFF', '#F9FAFB']} style={styles.card}>
        {/* Compact ETA Display */}
        <View style={styles.compactEtaSection}>
          <View style={styles.etaCircle}>
            <Text style={styles.etaNumber}>{eta}</Text>
            <Text style={styles.etaLabel}>min</Text>
          </View>
          <View style={styles.etaDetails}>
            <Text style={styles.etaTitle}>
              {eta <= 1 ? 'Almost there!' : 'Arriving soon'}
            </Text>
            <Text style={styles.etaSubtitle}>
              {formatDistance(distance)} away
            </Text>
          </View>
        </View>

        {/* Driver Info Row */}
        <View style={styles.driverRow}>
          <View style={styles.driverIconSmall}>
            <Car size={16} color="#2563EB" />
          </View>
          <View style={styles.driverInfoCompact}>
            <Text style={styles.driverNameSmall}>{driverInfo.name}</Text>
            <Text style={styles.vehicleInfoSmall}>
              {driverInfo.vehicle} • {driverInfo.plateNumber}
            </Text>
          </View>
          {driverLocation && (
            <View style={styles.liveIndicatorCompact}>
              <View style={styles.liveDotSmall} />
              <Text style={styles.liveTextSmall}>LIVE</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  // Compact ETA Section
  compactEtaSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  etaCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  etaNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  etaLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  etaDetails: {
    flex: 1,
  },
  etaTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  etaSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  // Driver Info Row
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  driverInfoCompact: {
    flex: 1,
  },
  driverNameSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  vehicleInfoSmall: {
    fontSize: 12,
    color: '#6B7280',
  },
  liveIndicatorCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
    marginRight: 4,
  },
  liveTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
    letterSpacing: 0.5,
  },
});
