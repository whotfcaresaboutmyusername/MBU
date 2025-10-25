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
// import { useRouter } from 'expo-router';
// import { useAuth } from '@/contexts/AuthContext';

// export default function LoginScreen() {
//   const [phone, setPhone] = useState('');
//   const [loading, setLoading] = useState(false);
//   const { signInWithPhone } = useAuth();
//   const router = useRouter();

//   const handleSendOtp = async () => {
//     if (!phone || phone.length < 10) {
//       Alert.alert('Error', 'Please enter a valid phone number');
//       return;
//     }

//     setLoading(true);
//     const { error } = await signInWithPhone(phone);
//     setLoading(false);

//     if (error) {
//       Alert.alert('Error', error.message);
//     } else {
//       router.push({ pathname: '/verify-otp', params: { phone } });
//     }
//   };

//   return (
//     <View style={styles.container}>
//       <View style={styles.content}>
//         <Text style={styles.title}>Welcome to ChatApp</Text>
//         <Text style={styles.subtitle}>Enter your phone number to continue</Text>

//         <View style={styles.inputContainer}>
//           <TextInput
//             style={styles.input}
//             placeholder="Phone number (e.g., +1234567890)"
//             value={phone}
//             onChangeText={setPhone}
//             keyboardType="phone-pad"
//             autoComplete="tel"
//             editable={!loading}
//           />
//         </View>

//         <TouchableOpacity
//           style={[styles.button, loading && styles.buttonDisabled]}
//           onPress={handleSendOtp}
//           disabled={loading}
//         >
//           {loading ? (
//             <ActivityIndicator color="#fff" />
//           ) : (
//             <Text style={styles.buttonText}>Send OTP</Text>
//           )}
//         </TouchableOpacity>

//         <Text style={styles.infoText}>
//           You'll receive a verification code via SMS
//         </Text>
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
//     fontSize: 16,
//     backgroundColor: '#f9f9f9',
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
//   infoText: {
//     fontSize: 14,
//     color: '#999',
//     textAlign: 'center',
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
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { signInWithEmail } = useAuth();
  const router = useRouter();

  const handleSendOtp = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    const { error } = await signInWithEmail(email);
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.push({ pathname: '/verify-otp', params: { email } });
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
        <Text style={styles.title}>SECURE ACCESS</Text>
        <Text style={styles.subtitle}>Enter credentials to continue</Text>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.infoText}>
          You'll receive a verification code via email
        </Text>
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
    fontSize: 28,
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
    fontSize: 16,
    backgroundColor: '#141824',
    color: '#e0e0e0',
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
  infoText: {
    fontSize: 13,
    color: '#7cb342',
    textAlign: 'center',
  },
});