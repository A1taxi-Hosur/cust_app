import { supabase } from '../utils/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  // Subscribe to ride status updates
  subscribeToRide(rideId: string, callback: (ride: any) => void) {
    const channelName = `ride_${rideId}`;

    if (this.channels.has(channelName)) {
      console.log(`🔄 [REALTIME] Unsubscribing from existing channel: ${channelName}`);
      this.channels.get(channelName)?.unsubscribe();
    }

    console.log(`📡 [REALTIME] Setting up subscription for ride: ${rideId}`);

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'rides',
        filter: `id=eq.${rideId}`,
      }, (payload) => {
        console.log(`🔔 [REALTIME] *** RIDE UPDATE CALLBACK FIRED ***`);
        console.log(`🔔 [REALTIME] Ride ID: ${rideId}`);
        console.log(`🔔 [REALTIME] Payload:`, payload);
        callback(payload.new);
      })
      .subscribe((status) => {
        console.log(`📡 [REALTIME] Ride subscription status for ${rideId}:`, status);
      });

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to driver location updates
  // Note: driverId parameter can be either driver.id or driver.user_id depending on context
  // For driver_locations table, we need driver_id (driver.id)
  // For live_locations table (legacy), we use user_id
  subscribeToDriverLocation(driverId: string, callback: (location: any) => void) {
    const channelName = `driver_location_${driverId}`;

    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    // Try both tables for backwards compatibility
    const channel = supabase
      .channel(channelName)
      // Primary: driver_locations table (uses driver_id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      }, (payload) => {
        console.log('📍 [REALTIME] Driver location from driver_locations:', payload.new);
        callback(payload.new);
      })
      // Fallback: live_locations table (uses user_id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_locations',
        filter: `user_id=eq.${driverId}`,
      }, (payload) => {
        console.log('📍 [REALTIME] Driver location from live_locations:', payload.new);
        callback(payload.new);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to scheduled booking updates
  subscribeToBooking(bookingId: string, callback: (booking: any) => void) {
    const channelName = `booking_${bookingId}`;
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'scheduled_bookings',
        filter: `id=eq.${bookingId}`,
      }, (payload) => {
        callback(payload.new);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to new ride requests for drivers
  subscribeToRideRequests(vehicleType: string, callback: (ride: any) => void) {
    const channelName = `ride_requests_${vehicleType}`;
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'rides',
        filter: `vehicle_type=eq.${vehicleType}`,
      }, (payload) => {
        if (payload.new.status === 'requested') {
          callback(payload.new);
        }
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Subscribe to notifications
  subscribeToNotifications(userId: string, callback: (notification: any) => void) {
    const channelName = `notifications_${userId}`;
    
    if (this.channels.has(channelName)) {
      this.channels.get(channelName)?.unsubscribe();
    }

    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        callback(payload.new);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  // Unsubscribe from a specific channel
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.unsubscribe();
      this.channels.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    this.channels.forEach((channel) => {
      channel.unsubscribe();
    });
    this.channels.clear();
  }

  // Broadcast location update to all subscribers
  async broadcastLocationUpdate(userId: string, location: any) {
    const channel = supabase.channel(`location_broadcast_${userId}`);
    
    await channel.send({
      type: 'broadcast',
      event: 'location_update',
      payload: {
        userId,
        ...location,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Listen for location broadcasts
  subscribeToLocationBroadcast(userId: string, callback: (location: any) => void) {
    const channelName = `location_broadcast_${userId}`;
    
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'location_update' }, (payload) => {
        callback(payload.payload);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }
}

export const realtimeService = new RealtimeService();