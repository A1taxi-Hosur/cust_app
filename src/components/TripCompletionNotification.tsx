import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { CircleCheck, X, MapPin } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import { useRideNotifications } from '../hooks/useRideNotifications';

const { width, height } = Dimensions.get('window');

export default function TripCompletionNotification() {
  const { notifications, markAsRead } = useRideNotifications();
  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState<any>(null);
  const [fareBreakdown, setFareBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Find unread trip_completed or booking_completed notifications
    const tripCompletedNotifications = notifications.filter(n =>
      (n.type === 'trip_completed' || n.type === 'booking_completed') &&
      n.status === 'unread' &&
      !shownNotifications.has(n.id)
    );

    if (tripCompletedNotifications.length > 0 && !visible) {
      const latest = tripCompletedNotifications[0];
      console.log('🎉 [TRIP_NOTIFICATION] Showing trip completion:', latest);
      setNotification(latest);
      setShownNotifications(prev => new Set([...prev, latest.id]));

      // Fetch fare breakdown - try to get ride_id or booking_id
      const rideId = latest.data?.ride_id || latest.data?.rideId || latest.data?.booking_id || latest.data?.bookingId;
      if (rideId) {
        fetchFareBreakdown(rideId);
      }

      // Show notification with fade in animation
      setVisible(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [notifications, visible]);

  const fetchFareBreakdown = async (rideOrBookingId: string) => {
    if (!rideOrBookingId) return;

    setLoading(true);
    try {
      // Try to fetch from trip_completions table first (preferred - has detailed breakdown)
      const { data, error } = await supabase
        .from('trip_completions')
        .select('*')
        .eq('ride_id', rideOrBookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        console.log('✅ [TRIP_NOTIFICATION] Fare breakdown fetched from trip_completions:', data);
        setFareBreakdown(data);
      } else {
        // If no trip_completions data, try to get basic info from scheduled_bookings
        console.log('⚠️ [TRIP_NOTIFICATION] No trip_completions data, fetching from scheduled_bookings');
        const { data: bookingData, error: bookingError } = await supabase
          .from('scheduled_bookings')
          .select('*')
          .eq('id', rideOrBookingId)
          .maybeSingle();

        if (bookingData) {
          console.log('✅ [TRIP_NOTIFICATION] Booking data fetched:', bookingData);
          // Create a basic fare breakdown from booking data
          setFareBreakdown({
            booking_type: bookingData.booking_type,
            base_fare: bookingData.estimated_fare || 0,
            total_fare: bookingData.estimated_fare || 0,
            actual_distance_km: 0,
            actual_duration_minutes: 0,
            // No detailed breakdown available
          });
        } else {
          console.log('❌ [TRIP_NOTIFICATION] No data found for ID:', rideOrBookingId);
        }
      }
    } catch (error) {
      console.error('Exception fetching fare breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    if (notification) {
      markAsRead(notification.id);
    }
    handleClose();
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      setNotification(null);
      setFareBreakdown(null);
    });
  };

  if (!visible || !notification) return null;

  const pickupAddress = notification.data?.pickupAddress || notification.data?.pickup_address || '';
  const destinationAddress = notification.data?.destinationAddress || notification.data?.destination_address || '';
  const totalFare = fareBreakdown?.total_fare || notification.data?.fareAmount || 0;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
        />
        <Animated.View style={[styles.modalContent, {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }]}>
          <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <CircleCheck size={24} color="#10B981" />
            <Text style={styles.headerTitle}>Trip Completed!</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Route Details */}
          <View style={styles.routeContainer}>
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.routeText} numberOfLines={1}>{pickupAddress}</Text>
            </View>
            <View style={styles.routeLine} />
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.routeText} numberOfLines={1}>{destinationAddress}</Text>
            </View>
          </View>

          {/* Fare Breakdown */}
          <Text style={styles.sectionTitle}>Fare Breakdown</Text>

          {loading ? (
            <ActivityIndicator size="small" color="#10B981" style={styles.loader} />
          ) : fareBreakdown ? (
            <View style={styles.fareContainer}>
              {/* Base Fare */}
              {fareBreakdown.base_fare > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>
                    {fareBreakdown.booking_type === 'outstation' ? 'Outstation Base Fare' :
                     fareBreakdown.booking_type === 'rental' ? 'Rental Package Base' :
                     fareBreakdown.booking_type === 'airport' ? 'Airport Base Fare' : 'Base Fare'}
                  </Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.base_fare.toFixed(2)}</Text>
                </View>
              )}

              {/* Per KM Charges (distance_fare in trip_completions) */}
              {fareBreakdown.distance_fare > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>
                    Per KM Charges
                    {fareBreakdown.actual_distance_km > 0 &&
                      `\n${fareBreakdown.actual_distance_km.toFixed(1)}km`}
                  </Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.distance_fare.toFixed(2)}</Text>
                </View>
              )}

              {/* Platform Fee */}
              {fareBreakdown.platform_fee > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Platform Fee</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.platform_fee.toFixed(2)}</Text>
                </View>
              )}

              {/* GST on Charges */}
              {fareBreakdown.gst_on_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>GST on Charges (5%)</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.gst_on_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* GST on Platform Fee */}
              {fareBreakdown.gst_on_platform_fee > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>GST on Platform Fee (18%)</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.gst_on_platform_fee.toFixed(2)}</Text>
                </View>
              )}

              {/* Driver Allowance */}
              {fareBreakdown.driver_allowance > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>
                    Driver Allowance ({fareBreakdown.rental_hours || 1} day{(fareBreakdown.rental_hours || 1) > 1 ? 's' : ''})
                  </Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.driver_allowance.toFixed(2)}</Text>
                </View>
              )}

              {/* Time Charges (time_fare in trip_completions) */}
              {fareBreakdown.time_fare > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>
                    Time Charges
                    {fareBreakdown.actual_duration_minutes > 0 &&
                      `\n${Math.round(fareBreakdown.actual_duration_minutes)}min`}
                  </Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.time_fare.toFixed(2)}</Text>
                </View>
              )}

              {/* Extra KM Charges */}
              {fareBreakdown.extra_km_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Extra KM Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.extra_km_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* Extra Time Charges */}
              {fareBreakdown.extra_time_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Extra Time Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.extra_time_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* Airport Fee */}
              {fareBreakdown.airport_fee > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Airport Fee</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.airport_fee.toFixed(2)}</Text>
                </View>
              )}

              {/* Night Charges */}
              {fareBreakdown.night_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Night Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.night_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* Other Charges */}
              {fareBreakdown.toll_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Toll Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.toll_charges.toFixed(2)}</Text>
                </View>
              )}
              {fareBreakdown.parking_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Parking Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.parking_charges.toFixed(2)}</Text>
                </View>
              )}
              {fareBreakdown.waiting_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Waiting Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.waiting_charges.toFixed(2)}</Text>
                </View>
              )}
              {fareBreakdown.surge_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Surge Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.surge_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* Discount */}
              {fareBreakdown.discount_amount > 0 && (
                <View style={styles.fareRow}>
                  <Text style={[styles.fareLabel, { color: '#10B981' }]}>Discount</Text>
                  <Text style={[styles.fareValue, { color: '#10B981' }]}>-₹{fareBreakdown.discount_amount.toFixed(2)}</Text>
                </View>
              )}

              {/* Trip Summary */}
              {fareBreakdown.booking_type === 'outstation' && fareBreakdown.rental_hours && (
                <View style={styles.tripSummary}>
                  <Text style={styles.tripSummaryText}>
                    Trip Summary: {fareBreakdown.actual_distance_km.toFixed(1)}km in {Math.round(fareBreakdown.actual_duration_minutes)}min
                  </Text>
                  <Text style={styles.tripSummaryText}>
                    {fareBreakdown.rental_hours} day trip
                  </Text>
                  <Text style={[styles.tripSummaryText, { fontSize: 11, color: '#9CA3AF' }]}>
                    GPS tracked actual distance
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.fareContainer}>
              <Text style={styles.noDataText}>Fare details not available</Text>
            </View>
          )}

          {/* Total Fare */}
          <View style={styles.totalContainer}>
            <Text style={styles.totalLabel}>Total Fare</Text>
            <Text style={styles.totalValue}>₹{totalFare.toFixed(2)}</Text>
          </View>

          {/* Done Button */}
          <TouchableOpacity style={styles.doneButton} onPress={handleDone}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: width > 500 ? 450 : width - 32,
    maxWidth: 450,
    maxHeight: height * 0.9,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    maxHeight: height * 0.7,
  },
  routeContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeText: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E5E7EB',
    marginLeft: 3,
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  loader: {
    padding: 20,
  },
  fareContainer: {
    paddingHorizontal: 16,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  fareLabel: {
    fontSize: 13,
    color: '#6B7280',
    flex: 1,
    lineHeight: 18,
  },
  fareValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    marginLeft: 12,
  },
  tripSummary: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  tripSummaryText: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 2,
  },
  noDataText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 12,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
  },
  doneButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 16,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
