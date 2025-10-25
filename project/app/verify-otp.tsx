// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   StyleSheet,
//   Alert,
//   ActivityIndicator,
// } from 'react-native';
// import { useRouter, useLocalSearchParams } from 'expo-router';
// import { useAuth } from '@/contexts/AuthContext';

// export default function VerifyOtpScreen() {
//   const [otp, setOtp] = useState('');
//   const [loading, setLoading] = useState(false);
//   const { verifyOtp, signInWithPhone } = useAuth();
//   const router = useRouter();
//   const { phone } = useLocalSearchParams<{ phone: string }>();

//   const handleVerifyOtp = async () => {
//     if (!otp || otp.length < 6) {
//       Alert.alert('Error', 'Please enter a valid OTP');
//       return;
//     }

//     setLoading(true);
//     const { error } = await verifyOtp(phone, otp);
//     setLoading(false);

//     if (error) {
//       Alert.alert('Error', error.message);
//     } else {
//       router.replace('/(tabs)');
//     }
//   };

//   const handleResendOtp = async () => {
//     setLoading(true);
//     const { error } = await signInWithPhone(phone);
//     setLoading(false);

//     if (error) {
//       Alert.alert('Error', error.message);
//     } else {
//       Alert.alert('Success', 'OTP resent successfully');
//     }
//   };

//   return (
//     <View style={styles.container}>
//       <View style={styles.content}>
//         <Text style={styles.title}>Verify OTP</Text>
//         <Text style={styles.subtitle}>
//           Enter the code sent to {phone}
//         </Text>

//         <View style={styles.inputContainer}>
//           <TextInput
//             style={styles.input}
//             placeholder="Enter 6-digit OTP"
//             value={otp}
//             onChangeText={setOtp}
//             keyboardType="number-pad"
//             maxLength={6}
//             editable={!loading}
//             autoFocus
//           />
//         </View>

//         <TouchableOpacity
//           style={[styles.button, loading && styles.buttonDisabled]}
//           onPress={handleVerifyOtp}
//           disabled={loading}
//         >
//           {loading ? (
//             <ActivityIndicator color="#fff" />
//           ) : (
//             <Text style={styles.buttonText}>Verify</Text>
//           )}
//         </TouchableOpacity>

//         <TouchableOpacity
//           style={styles.resendButton}
//           onPress={handleResendOtp}
//           disabled={loading}
//         >
//           <Text style={styles.resendText}>Resend OTP</Text>
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fff',
//   },
//   content: {
//     flex: 1,
//     justifyContent: 'center',
//     paddingHorizontal: 24,
//   },
//   title: {
//     fontSize: 32,
//     fontWeight: '700',
//     color: '#1a1a1a',
//     marginBottom: 8,
//     textAlign: 'center',
//   },
//   subtitle: {
//     fontSize: 16,
//     color: '#666',
//     marginBottom: 40,
//     textAlign: 'center',
//   },
//   inputContainer: {
//     marginBottom: 24,
//   },
//   input: {
//     height: 56,
//     borderWidth: 2,
//     borderColor: '#e0e0e0',
//     borderRadius: 12,
//     paddingHorizontal: 16,
//     fontSize: 24,
//     backgroundColor: '#f9f9f9',
//     textAlign: 'center',
//     letterSpacing: 8,
//   },
//   button: {
//     height: 56,
//     backgroundColor: '#007AFF',
//     borderRadius: 12,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: 16,
//   },
//   buttonDisabled: {
//     opacity: 0.6,
//   },
//   buttonText: {
//     color: '#fff',
//     fontSize: 18,
//     fontWeight: '600',
//   },
//   resendButton: {
//     padding: 12,
//     alignItems: 'center',
//   },
//   resendText: {
//     color: '#007AFF',
//     fontSize: 16,
//     fontWeight: '600',
//   },
// });



import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function VerifyOtpScreen() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const { verifyOtp, signInWithEmail } = useAuth();
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      Alert.alert('Error', 'Please enter a valid OTP');
      return;
    }

    setLoading(true);
    const { error } = await verifyOtp(email, otp);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    const { error } = await signInWithEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'OTP resent successfully');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>DEFCOM</Text>
          </View>
          <Text style={styles.teamBadge}>TEAM IIPE</Text>
        </View>
        <Text style={styles.title}>VERIFICATION REQUIRED</Text>
        <Text style={styles.subtitle}>
          Code sent to {email}
        </Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter 6-digit OTP"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleVerifyOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendButton}
          onPress={handleResendOtp}
          disabled={loading}
        >
          <Text style={styles.resendText}>Resend OTP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#141824',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#4CAF50',
    letterSpacing: 4,
    textShadowColor: 'rgba(76, 175, 80, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  teamBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7cb342',
    letterSpacing: 4,
    marginTop: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#7cb342',
    marginBottom: 40,
    textAlign: 'center',
    letterSpacing: 1,
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 16,
    fontSize: 24,
    backgroundColor: '#141824',
    color: '#4CAF50',
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    height: 56,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#7cb342',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 2,
  },
  resendButton: {
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 4,
  },
  resendText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 1,
  },
});