import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, Platform } from 'react-native';
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface AnimatedDriverMarkerProps {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  isMoving?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function AnimatedDriverMarker({
  latitude,
  longitude,
  heading = 0,
  speed = 0,
  isMoving = false,
}: AnimatedDriverMarkerProps) {
  const rotationAnim = useRef(new Animated.Value(heading)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.3)).current;
  const previousHeadingRef = useRef(heading);

  useEffect(() => {
    // Smooth rotation animation with easing for natural movement
    const headingDiff = Math.abs(heading - previousHeadingRef.current);
    const duration = headingDiff > 180 ? 600 : 800; // Longer animation for smoother movement

    Animated.timing(rotationAnim, {
      toValue: heading,
      duration,
      useNativeDriver: true,
    }).start();

    previousHeadingRef.current = heading;
  }, [heading]);

  useEffect(() => {
    if (isMoving) {
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.5,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(pulseOpacity, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseOpacity, {
              toValue: 0.3,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    }
  }, [isMoving]);

  useEffect(() => {
    if (speed > 0) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [latitude, longitude]);

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.pulseContainer,
          {
            transform: [{ scale: pulseAnim }],
            opacity: pulseOpacity,
          },
        ]}
      >
        <Svg height="80" width="80" style={styles.pulseSvg}>
          <Circle
            cx="40"
            cy="40"
            r="30"
            fill="#FFA500"
            fillOpacity="0.3"
          />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[
          styles.markerContainer,
          {
            transform: [{ rotate: rotation }, { scale: scaleAnim }],
          },
        ]}
      >
        <Svg height="60" width="60" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="carBody" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#3B82F6" stopOpacity="1" />
              <Stop offset="100%" stopColor="#1E40AF" stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="carTop" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#60A5FA" stopOpacity="1" />
              <Stop offset="100%" stopColor="#3B82F6" stopOpacity="1" />
            </LinearGradient>
            <LinearGradient id="carWindow" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#93C5FD" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#60A5FA" stopOpacity="0.6" />
            </LinearGradient>
          </Defs>

          {/* Car body - bottom */}
          <Path
            d="M 30 55 L 45 45 L 70 45 L 70 60 L 30 60 Z"
            fill="url(#carBody)"
            stroke="#1E3A8A"
            strokeWidth="1.5"
          />

          {/* Car body - top cabin */}
          <Path
            d="M 35 45 L 45 35 L 60 35 L 65 45 Z"
            fill="url(#carTop)"
            stroke="#1E3A8A"
            strokeWidth="1.5"
          />

          {/* Front windshield */}
          <Path
            d="M 45 35 L 50 40 L 60 40 L 60 35 Z"
            fill="url(#carWindow)"
            stroke="#1E40AF"
            strokeWidth="1"
          />

          {/* Side window */}
          <Path
            d="M 35 45 L 40 40 L 45 40 L 45 45 Z"
            fill="url(#carWindow)"
            stroke="#1E40AF"
            strokeWidth="1"
          />

          {/* Front wheel */}
          <Circle cx="60" cy="60" r="5" fill="#1F2937" stroke="#374151" strokeWidth="1.5" />
          <Circle cx="60" cy="60" r="3" fill="#4B5563" />

          {/* Rear wheel */}
          <Circle cx="38" cy="60" r="5" fill="#1F2937" stroke="#374151" strokeWidth="1.5" />
          <Circle cx="38" cy="60" r="3" fill="#4B5563" />

          {/* Headlights */}
          <Circle cx="68" cy="52" r="2" fill="#FCD34D" opacity="0.9" />

          {/* Side mirror */}
          <Path
            d="M 70 48 L 73 47 L 73 49 Z"
            fill="#2563EB"
            stroke="#1E40AF"
            strokeWidth="1"
          />

          {/* Hood details */}
          <Path
            d="M 50 45 L 53 45"
            stroke="#1E40AF"
            strokeWidth="1"
            opacity="0.6"
          />
        </Svg>
      </Animated.View>

      <View style={styles.shadowContainer}>
        <View style={styles.shadow} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseSvg: {
    position: 'absolute',
  },
  markerContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  carImageContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carImage: {
    width: 60,
    height: 60,
  },
  shadowContainer: {
    position: 'absolute',
    bottom: -10,
    zIndex: 1,
  },
  shadow: {
    width: 40,
    height: 8,
    borderRadius: 20,
    backgroundColor: '#000000',
    opacity: 0.2,
  },
});
