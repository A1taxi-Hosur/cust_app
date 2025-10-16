import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Car } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const { sendOTP } = useAuth();
  const router = useRouter();

  const formatPhoneNumber = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    return cleaned;
  };

  const handleSendOTP = async () => {
    console.log('🚀 ===== HANDLE SEND OTP CLICKED =====');

    if (!name.trim()) {
      console.log('❌ Name is empty');
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!phoneNumber.trim()) {
      console.log('❌ Phone number is empty');
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    if (phoneNumber.length !== 10) {
      console.log('❌ Phone number must be 10 digits');
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    const formattedPhone = `+91${phoneNumber}`;
    console.log('📱 Formatted phone:', formattedPhone);

    console.log('⏳ Setting loading true...');
    setLoading(true);

    try {
      console.log('📞 Calling sendOTP...');
      const result = await sendOTP(formattedPhone, name.trim());
      console.log('📞 sendOTP returned:', result);

      if (result.error) {
        console.error('❌ Result has error:', result.error);
        Alert.alert('Error', result.error.message);
        setLoading(false);
        return;
      }

      console.log('✅ No error in result');
      console.log('📱 OTP received:', result.otp);
      console.log('📱 SMS sent status:', result.smsSent);
      console.log('📱 SMS error:', result.smsError);

      setLoading(false);

      let message = `Your OTP code is: ${result.otp}\n\n`;
      if (result.smsSent) {
        message += '✅ SMS sent successfully! Check your phone.';
      } else if (result.smsError) {
        message += `⚠️ SMS failed: ${result.smsError}\nPlease use the code above.`;
      } else {
        message += '⚠️ SMS not configured. Please use the code above.';
      }

      console.log('💬 Showing alert with message:', message);
      console.log('🧭 Will navigate to verify-otp after alert');

      if (Platform.OS === 'web') {
        console.log('🌐 Web platform - using window.confirm');
        const confirmed = window.confirm(`OTP Sent\n\n${message}\n\nClick OK to continue to verification.`);
        if (confirmed) {
          console.log('🧭 User confirmed, navigating to verify-otp...');
          console.log('🧭 Target params:', { phoneNumber: formattedPhone, name: name.trim() });
          router.push({
            pathname: '/auth/verify-otp',
            params: { phoneNumber: formattedPhone, name: name.trim() }
          });
          console.log('🧭 Navigation triggered');
        }
      } else {
        Alert.alert(
          'OTP Sent',
          message,
          [
            {
              text: 'OK',
              onPress: () => {
                console.log('🧭 Alert dismissed, navigating to verify-otp...');
                console.log('🧭 Target params:', { phoneNumber: formattedPhone, name: name.trim() });
                router.push({
                  pathname: '/auth/verify-otp',
                  params: { phoneNumber: formattedPhone, name: name.trim() }
                });
                console.log('🧭 Navigation triggered');
              }
            }
          ]
        );
      }
      console.log('💬 Alert displayed');
    } catch (err) {
      console.error('💥 Exception caught:', err);
      console.error('💥 Error stack:', err.stack);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
      setLoading(false);
    }
    console.log('🚀 ===== HANDLE SEND OTP END =====');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Car size={48} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>A1 Taxi</Text>
              <Text style={styles.subtitle}>Sign in with your phone number</Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryCodeContainer}>
                    <Text style={styles.countryCodeText}>+91</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    value={phoneNumber}
                    onChangeText={(text) => {
                      const cleaned = formatPhoneNumber(text);
                      if (cleaned.length <= 10) {
                        setPhoneNumber(cleaned);
                      }
                    }}
                    placeholder="Enter 10-digit phone number"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    maxLength={10}
                  />
                </View>
                <Text style={styles.helperText}>Indian phone number (10 digits)</Text>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.disabledButton]}
                onPress={handleSendOTP}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#2563EB" />
                ) : (
                  <Text style={styles.loginButtonText}>Send OTP</Text>
                )}
              </TouchableOpacity>

              <View style={styles.infoContainer}>
                <Text style={styles.infoText}>
                  You will receive a 6-digit verification code via SMS
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  form: {
    flex: 1,
    maxHeight: 450,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  countryCodeContainer: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  phoneInput: {
    flex: 1,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
  },
  helperText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  loginButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});
