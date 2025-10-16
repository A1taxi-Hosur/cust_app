import { Ride } from '../types/database';
import { supabase } from '../utils/supabase';

interface BillData {
  ride: Ride & {
    drivers?: {
      users: { full_name: string; phone_number: string };
      vehicles: { make: string; model: string; registration_number: string; color: string };
    };
  };
  fareBreakdown: any;
}

class BillService {
  generateBillHTML(billData: BillData): string {
    const { ride, fareBreakdown } = billData;
    const date = fareBreakdown?.completed_at || ride.created_at || new Date().toISOString();

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
            <span>${ride.ride_code || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span>Date:</span>
            <span>${new Date(date).toLocaleString()}</span>
          </div>
          <div class="info-row">
            <span>Booking Type:</span>
            <span>${fareBreakdown?.booking_type || ride.booking_type || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span>From:</span>
            <span>${fareBreakdown?.pickup_address || ride.pickup_address || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span>To:</span>
            <span>${fareBreakdown?.destination_address || ride.destination_address || 'N/A'}</span>
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
            <span>₹${(fareBreakdown?.total_fare || ride.fare_amount || 0).toFixed(2)}</span>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async fetchFareBreakdown(ride: any): Promise<any> {
    try {
      console.log('📄 [BILL] Fetching fare breakdown for ride:', ride.id, 'Type:', ride.booking_type);

      let fareData = null;
      const bookingType = ride.booking_type;

      // Determine which table to query based on booking type
      if (bookingType === 'rental') {
        console.log('📄 [BILL] Fetching from rental_trip_completions');
        const { data } = await supabase
          .from('rental_trip_completions')
          .select('*')
          .eq('scheduled_booking_id', ride.scheduled_booking_id || ride.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fareData = data;
      } else if (bookingType === 'outstation') {
        console.log('📄 [BILL] Fetching from outstation_trip_completions');
        const { data } = await supabase
          .from('outstation_trip_completions')
          .select('*')
          .eq('scheduled_booking_id', ride.scheduled_booking_id || ride.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fareData = data;
      } else if (bookingType === 'airport') {
        console.log('📄 [BILL] Fetching from airport_trip_completions');
        const { data } = await supabase
          .from('airport_trip_completions')
          .select('*')
          .eq('scheduled_booking_id', ride.scheduled_booking_id || ride.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fareData = data;
      } else {
        // Regular ride - try trip_completions table
        console.log('📄 [BILL] Fetching from trip_completions');
        const { data } = await supabase
          .from('trip_completions')
          .select('*')
          .eq('ride_id', ride.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        fareData = data;
      }

      if (fareData) {
        console.log('✅ [BILL] Fare breakdown fetched:', fareData);
        return fareData;
      } else {
        console.log('⚠️ [BILL] No fare breakdown found, using basic ride info');
        // Fallback to basic ride info
        return {
          booking_type: ride.booking_type,
          base_fare: ride.fare_amount || 0,
          total_fare: ride.fare_amount || 0,
          actual_distance_km: ride.distance_km || 0,
          actual_duration_minutes: ride.duration_minutes || 0,
          pickup_address: ride.pickup_address,
          destination_address: ride.destination_address,
        };
      }
    } catch (error) {
      console.error('❌ [BILL] Error fetching fare breakdown:', error);
      // Return basic fallback
      return {
        booking_type: ride.booking_type,
        base_fare: ride.fare_amount || 0,
        total_fare: ride.fare_amount || 0,
        pickup_address: ride.pickup_address,
        destination_address: ride.destination_address,
      };
    }
  }

  async downloadBill(ride: any): Promise<void> {
    try {
      console.log('📄 [BILL] Generating bill for ride:', ride.ride_code);

      const fareBreakdown = await this.fetchFareBreakdown(ride);
      const billData: BillData = { ride, fareBreakdown };

      const htmlContent = this.generateBillHTML(billData);

      // Create blob and download
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = `A1Taxi_Bill_${ride.ride_code}_${new Date().toISOString().split('T')[0]}.html`;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      URL.revokeObjectURL(url);

      console.log('✅ [BILL] Bill downloaded successfully');
    } catch (error) {
      console.error('❌ [BILL] Error downloading bill:', error);
      throw error;
    }
  }

  async printBill(ride: any): Promise<void> {
    try {
      console.log('🖨️ [BILL] Opening print dialog for ride:', ride.ride_code);

      const fareBreakdown = await this.fetchFareBreakdown(ride);
      const billData: BillData = { ride, fareBreakdown };

      const htmlContent = this.generateBillHTML(billData);

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();

        // Wait for content to load then print
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }

      console.log('✅ [BILL] Print dialog opened successfully');
    } catch (error) {
      console.error('❌ [BILL] Error printing bill:', error);
      throw error;
    }
  }
}

export const billService = new BillService();