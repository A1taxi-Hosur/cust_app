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
import { CircleCheck, X, MapPin, Download, Star } from 'lucide-react-native';
import { supabase } from '../utils/supabase';
import { useRideNotifications } from '../hooks/useRideNotifications';

const { width, height } = Dimensions.get('window');

export default function TripCompletionNotification() {
  const { notifications, markAsRead } = useRideNotifications();

  console.log('🎯 [TRIP_NOTIFICATION] Component mounted, notifications count:', notifications?.length || 0);

  const [visible, setVisible] = useState(false);
  const [notification, setNotification] = useState<any>(null);
  const [fareBreakdown, setFareBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.9));
  const [shownNotifications, setShownNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    console.log('🎯 [TRIP_NOTIFICATION] ===== useEffect TRIGGERED - CHECKING FOR COMPLETION NOTIFICATIONS =====');
    console.log('🎯 [TRIP_NOTIFICATION] Notifications array length:', notifications.length);
    console.log('🎯 [TRIP_NOTIFICATION] Notifications array reference:', notifications);
    console.log('🎯 [TRIP_NOTIFICATION] Total notifications received:', notifications.length);
    console.log('🎯 [TRIP_NOTIFICATION] Notification types:', notifications.map(n => n.type));
    console.log('🎯 [TRIP_NOTIFICATION] ride_completed count:', notifications.filter(n => n.type === 'ride_completed').length);
    console.log('🎯 [TRIP_NOTIFICATION] Unread ride_completed:', notifications.filter(n => n.type === 'ride_completed' && n.status === 'unread').length);
    console.log('🎯 [TRIP_NOTIFICATION] Already shown count:', shownNotifications.size);
    console.log('🎯 [TRIP_NOTIFICATION] Currently visible:', visible);

    // Find unread trip_completed, booking_completed, or ride_completed notifications
    const tripCompletedNotifications = notifications.filter(n =>
      (n.type === 'trip_completed' || n.type === 'booking_completed' || n.type === 'ride_completed') &&
      n.status === 'unread' &&
      !shownNotifications.has(n.id)
    );

    console.log('🎯 [TRIP_NOTIFICATION] Filtered completion notifications:', tripCompletedNotifications.length);
    if (tripCompletedNotifications.length > 0) {
      console.log('🎯 [TRIP_NOTIFICATION] First notification:', {
        id: tripCompletedNotifications[0].id,
        type: tripCompletedNotifications[0].type,
        status: tripCompletedNotifications[0].status,
        alreadyShown: shownNotifications.has(tripCompletedNotifications[0].id),
        currentNotificationId: notification?.id
      });
    }

    // Show new notification if it's different from the currently displayed one
    if (tripCompletedNotifications.length > 0) {
      const latest = tripCompletedNotifications[0];
      const isNewNotification = !notification || notification.id !== latest.id;

      if (isNewNotification) {
        console.log('🎉 [TRIP_NOTIFICATION] Showing NEW trip completion:', {
          notificationId: latest.id,
          rideId: latest.data?.ride_id,
          previousNotificationId: notification?.id
        });
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
    }
  }, [notifications, notification]);

  const fetchFareBreakdown = async (rideOrBookingId: string) => {
    if (!rideOrBookingId) return;

    setLoading(true);
    try {
      console.log('🔍 [TRIP_NOTIFICATION] Fetching fare breakdown for ID:', rideOrBookingId);

      // First, determine the booking type from scheduled_bookings
      const { data: bookingData } = await supabase
        .from('scheduled_bookings')
        .select('booking_type')
        .eq('id', rideOrBookingId)
        .maybeSingle();

      const bookingType = notification?.data?.bookingType || notification?.data?.booking_type || bookingData?.booking_type || 'regular';
      console.log('📋 [TRIP_NOTIFICATION] Booking type:', bookingType);

      let fareData = null;

      // Fetch from the appropriate trip completion table based on booking type
      if (bookingType === 'rental') {
        console.log('🔍 [TRIP_NOTIFICATION] Fetching from rental_trip_completions');
        const { data } = await supabase
          .from('rental_trip_completions')
          .select('*')
          .eq('scheduled_booking_id', rideOrBookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fareData = data;
      } else if (bookingType === 'outstation') {
        console.log('🔍 [TRIP_NOTIFICATION] Fetching from outstation_trip_completions');
        const { data } = await supabase
          .from('outstation_trip_completions')
          .select('*')
          .eq('scheduled_booking_id', rideOrBookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fareData = data;
      } else if (bookingType === 'airport') {
        console.log('🔍 [TRIP_NOTIFICATION] Fetching from airport_trip_completions');
        const { data } = await supabase
          .from('airport_trip_completions')
          .select('*')
          .eq('scheduled_booking_id', rideOrBookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fareData = data;
      } else {
        // Regular ride - try trip_completions table
        console.log('🔍 [TRIP_NOTIFICATION] Fetching from trip_completions');
        const { data } = await supabase
          .from('trip_completions')
          .select('*')
          .eq('ride_id', rideOrBookingId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fareData = data;
      }

      if (fareData) {
        console.log('✅ [TRIP_NOTIFICATION] Fare breakdown fetched:', fareData);
        setFareBreakdown(fareData);
      } else {
        console.log('⚠️ [TRIP_NOTIFICATION] No fare breakdown found, fetching booking estimate');
        // Fallback to scheduled_bookings for basic info
        const { data: bookingInfo } = await supabase
          .from('scheduled_bookings')
          .select('*')
          .eq('id', rideOrBookingId)
          .maybeSingle();

        if (bookingInfo) {
          console.log('✅ [TRIP_NOTIFICATION] Using booking estimate as fallback');
          setFareBreakdown({
            booking_type: bookingInfo.booking_type,
            base_fare: bookingInfo.estimated_fare || 0,
            total_fare: bookingInfo.estimated_fare || 0,
            actual_distance_km: 0,
            actual_duration_minutes: 0,
            pickup_address: bookingInfo.pickup_address,
            destination_address: bookingInfo.destination_address,
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

  const handleDownloadBill = async () => {
    if (!fareBreakdown) {
      console.error('📄 [TRIP_NOTIFICATION] Fare breakdown not available');
      return;
    }

    try {
      console.log('📄 [TRIP_NOTIFICATION] Downloading bill...');

      // Generate bill content
      const billContent = generateBillContent();

      // On web, create a downloadable HTML file
      if (typeof window !== 'undefined') {
        const blob = new Blob([billContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trip-bill-${Date.now()}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('✅ [TRIP_NOTIFICATION] Bill downloaded successfully!');
      }
    } catch (error) {
      console.error('❌ [TRIP_NOTIFICATION] Error downloading bill:', error);
    }
  };

  const generateBillContent = () => {
    const bookingId = notification?.data?.booking_id || notification?.data?.bookingId || 'N/A';
    const date = fareBreakdown?.completed_at || new Date().toISOString();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trip Bill</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #10B981; margin: 0; }
          .info { margin: 20px 0; }
          .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #E5E7EB; }
          .fare-section { margin: 30px 0; }
          .fare-row { display: flex; justify-content: space-between; padding: 10px 0; }
          .total-row { font-weight: bold; font-size: 18px; border-top: 2px solid #000; padding-top: 15px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>A1 Taxi</h1>
          <p>Trip Bill</p>
        </div>

        <div class="info">
          <div class="info-row">
            <span>Booking ID:</span>
            <span>${bookingId}</span>
          </div>
          <div class="info-row">
            <span>Date:</span>
            <span>${new Date(date).toLocaleString()}</span>
          </div>
          <div class="info-row">
            <span>Booking Type:</span>
            <span>${fareBreakdown?.booking_type || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span>From:</span>
            <span>${fareBreakdown?.pickup_address || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span>To:</span>
            <span>${fareBreakdown?.destination_address || 'N/A'}</span>
          </div>
        </div>

        <div class="fare-section">
          <h3>Fare Breakdown</h3>
          ${fareBreakdown?.base_fare > 0 ? `<div class="fare-row"><span>Base Fare</span><span>₹${fareBreakdown.base_fare.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.hourly_charges > 0 ? `<div class="fare-row"><span>Hourly Charges</span><span>₹${fareBreakdown.hourly_charges.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.per_day_charges > 0 ? `<div class="fare-row"><span>Per Day Charges</span><span>₹${fareBreakdown.per_day_charges.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.distance_fare > 0 ? `<div class="fare-row"><span>Distance Charges (${fareBreakdown.actual_distance_km?.toFixed(1)}km)</span><span>₹${fareBreakdown.distance_fare.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.platform_fee > 0 ? `<div class="fare-row"><span>Platform Fee</span><span>₹${fareBreakdown.platform_fee.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.gst_on_charges > 0 ? `<div class="fare-row"><span>GST on Charges (5%)</span><span>₹${fareBreakdown.gst_on_charges.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.gst_on_platform_fee > 0 ? `<div class="fare-row"><span>GST on Platform Fee (18%)</span><span>₹${fareBreakdown.gst_on_platform_fee.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.driver_allowance > 0 ? `<div class="fare-row"><span>Driver Allowance</span><span>₹${fareBreakdown.driver_allowance.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.extra_km_charges > 0 ? `<div class="fare-row"><span>Extra KM Charges</span><span>₹${fareBreakdown.extra_km_charges.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.extra_hour_charges > 0 ? `<div class="fare-row"><span>Extra Hour Charges</span><span>₹${fareBreakdown.extra_hour_charges.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.airport_surcharge > 0 ? `<div class="fare-row"><span>Airport Surcharge</span><span>₹${fareBreakdown.airport_surcharge.toFixed(2)}</span></div>` : ''}
          ${fareBreakdown?.toll_charges > 0 ? `<div class="fare-row"><span>Toll Charges</span><span>₹${fareBreakdown.toll_charges.toFixed(2)}</span></div>` : ''}

          <div class="fare-row total-row">
            <span>Total Fare</span>
            <span>₹${fareBreakdown?.total_fare?.toFixed(2) || '0.00'}</span>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleRating = async (selectedRating: number) => {
    setRating(selectedRating);
    setSubmittingRating(true);

    try {
      const driverId = fareBreakdown?.driver_id;
      const bookingId = notification?.data?.booking_id || notification?.data?.bookingId;
      const rideId = notification?.data?.ride_id || notification?.data?.rideId;

      if (!driverId) {
        console.error('⭐ [TRIP_NOTIFICATION] Driver information not available');
        return;
      }

      console.log('⭐ [TRIP_NOTIFICATION] Submitting rating:', {
        rating: selectedRating,
        driverId,
        bookingId,
        rideId,
      });

      // Update the appropriate table based on booking type
      const bookingType = fareBreakdown?.booking_type || 'regular';

      if (bookingType === 'rental' || bookingType === 'outstation' || bookingType === 'airport') {
        // Update scheduled_bookings rating
        const { error } = await supabase
          .from('scheduled_bookings')
          .update({
            customer_rating: selectedRating,
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);

        if (error) throw error;
      } else {
        // Update rides table rating
        const { error } = await supabase
          .from('rides')
          .update({
            rating: selectedRating,
            updated_at: new Date().toISOString()
          })
          .eq('id', rideId);

        if (error) throw error;
      }

      // Update driver's average rating
      const { data: driverData } = await supabase
        .from('drivers')
        .select('rating, total_rides')
        .eq('id', driverId)
        .maybeSingle();

      if (driverData) {
        const currentRating = driverData.rating || 0;
        const totalRides = driverData.total_rides || 0;
        const newAverageRating = ((currentRating * totalRides) + selectedRating) / (totalRides + 1);

        await supabase
          .from('drivers')
          .update({
            rating: newAverageRating,
            updated_at: new Date().toISOString()
          })
          .eq('id', driverId);
      }

      setRatingSubmitted(true);
      console.log('✅ [TRIP_NOTIFICATION] Rating submitted successfully');

    } catch (error) {
      console.error('❌ [TRIP_NOTIFICATION] Error submitting rating:', error);
      setRating(0);
    } finally {
      setSubmittingRating(false);
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
      setRating(0);
      setRatingSubmitted(false);
    });
  };

  if (!visible || !notification) {
    console.log('🔍 [TRIP_NOTIFICATION] Component render - visible:', visible, 'notification:', !!notification);
    return null;
  }

  console.log('✅ [TRIP_NOTIFICATION] Rendering modal with notification:', notification);

  // Get addresses from fareBreakdown (trip completion data) first, then fallback to notification data
  const pickupAddress = fareBreakdown?.pickup_address ||
                       notification.data?.pickupAddress ||
                       notification.data?.pickup_address ||
                       'Pickup location';
  const destinationAddress = fareBreakdown?.destination_address ||
                            notification.data?.destinationAddress ||
                            notification.data?.destination_address ||
                            'Destination';
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

              {/* Hourly Charges (rental only) */}
              {fareBreakdown.hourly_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>
                    Hourly Charges
                    {fareBreakdown.rental_hours > 0 &&
                      `\n${fareBreakdown.rental_hours}hrs package`}
                  </Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.hourly_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* Per Day Charges (outstation only) */}
              {fareBreakdown.per_day_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>
                    Per Day Charges
                    {fareBreakdown.actual_days > 0 &&
                      `\n${fareBreakdown.actual_days} day${fareBreakdown.actual_days > 1 ? 's' : ''}`}
                  </Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.per_day_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* Per KM Charges (distance_fare in trip_completions) */}
              {fareBreakdown.distance_fare > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>
                    {fareBreakdown.booking_type === 'rental' ? 'Distance Charges' : 'Per KM Charges'}
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

              {/* Extra Hour Charges (rental only) */}
              {fareBreakdown.extra_hour_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Extra Hour Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.extra_hour_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* Extra Time Charges (regular rides) */}
              {fareBreakdown.extra_time_charges > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Extra Time Charges</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.extra_time_charges.toFixed(2)}</Text>
                </View>
              )}

              {/* Airport Surcharge (airport only) */}
              {fareBreakdown.airport_surcharge > 0 && (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Airport Surcharge</Text>
                  <Text style={styles.fareValue}>₹{fareBreakdown.airport_surcharge.toFixed(2)}</Text>
                </View>
              )}

              {/* Airport Fee (regular rides) */}
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
              {fareBreakdown.actual_distance_km > 0 && (
                <View style={styles.tripSummary}>
                  <Text style={styles.tripSummaryText}>
                    Trip Summary: {fareBreakdown.actual_distance_km.toFixed(1)}km in {Math.round(fareBreakdown.actual_duration_minutes || 0)}min
                  </Text>
                  {fareBreakdown.booking_type === 'rental' && fareBreakdown.actual_hours_used > 0 && (
                    <Text style={styles.tripSummaryText}>
                      Used {fareBreakdown.actual_hours_used.toFixed(1)} hours of {fareBreakdown.rental_hours}hr package
                    </Text>
                  )}
                  {fareBreakdown.booking_type === 'outstation' && fareBreakdown.actual_days > 0 && (
                    <Text style={styles.tripSummaryText}>
                      {fareBreakdown.actual_days} day{fareBreakdown.actual_days > 1 ? 's' : ''} trip
                    </Text>
                  )}
                  {fareBreakdown.booking_type === 'airport' && (
                    <Text style={styles.tripSummaryText}>
                      Airport transfer completed
                    </Text>
                  )}
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

          {/* Rating Section */}
          {fareBreakdown?.driver_id && (
            <View style={styles.ratingSection}>
              <Text style={styles.ratingTitle}>Rate Your Driver</Text>
              {fareBreakdown?.driver_name && (
                <Text style={styles.driverName}>{fareBreakdown.driver_name}</Text>
              )}

              {!ratingSubmitted ? (
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => handleRating(star)}
                      disabled={submittingRating}
                      style={styles.starButton}
                    >
                      <Star
                        size={32}
                        color={star <= rating ? '#FCD34D' : '#D1D5DB'}
                        fill={star <= rating ? '#FCD34D' : 'transparent'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={styles.ratingSubmittedContainer}>
                  <CircleCheck size={24} color="#10B981" />
                  <Text style={styles.ratingSubmittedText}>Thank you for rating!</Text>
                </View>
              )}
            </View>
          )}

          {/* Download Bill Button */}
          <TouchableOpacity
            style={styles.downloadButton}
            onPress={handleDownloadBill}
            disabled={!fareBreakdown}
          >
            <Download size={20} color="#10B981" />
            <Text style={styles.downloadButtonText}>Download Bill</Text>
          </TouchableOpacity>

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
  ratingSection: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 8,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  driverName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  starButton: {
    padding: 4,
  },
  ratingSubmittedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  ratingSubmittedText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#10B981',
  },
  downloadButton: {
    backgroundColor: '#F0FDF4',
    borderRadius: 14,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  downloadButtonText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600',
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
