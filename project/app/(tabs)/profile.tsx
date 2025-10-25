//ignOut = async () => {
//     await signOut();
//     router.replace('/login');
//   };

//   if (loading) {
//     return (
//       <View style={styles.centered}>
//         <ActivityIndicator size="large" color="#007AFF" />
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <View style={styles.header}>
//         <Text style={styles.headerTitle}>Profile</Text>
//         <TouchableOpacity
//           style={styles.signOutButton}
//           onPress={handleSignOut}
//         >
//           <LogOut size={24} color="#FF3B30" />
//         </TouchableOpacity>
//       </View>

//       <View style={styles.content}>
//         <View style={styles.avatarContainer}>
//           <View style={styles.avatar}>
//             <UserIcon size={48} color="#fff" />
//           </View>
//         </View>

//         <View style={styles.formContainer}>
//           <View style={styles.fieldContainer}>
//             <Text style={styles.label}>Display Name</Text>
//             <TextInput
//               style={styles.input}
//               value={displayName}
//               onChangeText={setDisplayName}
//               placeholder="Enter your display name"
//             />
//           </View>

//           <View style={styles.fieldContainer}>
//             <Text style={styles.label}>Phone Number</Text>
//             <TextInput
//               style={[styles.input, styles.inputDisabled]}
//               value={phoneNumber}
//               editable={false}
//             />
//           </View>

//           <TouchableOpacity
//             style={[styles.saveButton, saving && styles.buttonDisabled]}
//             onPress={handleSaveProfile}
//             disabled={saving}
//           >
//             {saving ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.saveButtonText}>Save Changes</Text>
//             )}
//           </TouchableOpacity>
//         </View>
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#fff',
//   },
//   centered: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//   },
//   header: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//     paddingTop: 60,
//     paddingBottom: 16,
//     backgroundColor: '#fff',
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//   },
//   headerTitle: {
//     fontSize: 32,
//     fontWeight: '700',
//     color: '#1a1a1a',
//   },
//   signOutButton: {
//     width: 40,
//     height: 40,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   content: {
//     flex: 1,
//   },
//   avatarContainer: {
//     alignItems: 'center',
//     paddingVertical: 32,
//   },
//   avatar: {
//     width: 100,
//     height: 100,
//     borderRadius: 50,
//     backgroundColor: '#007AFF',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   formContainer: {
//     paddingHorizontal: 20,
//   },
//   fieldContainer: {
//     marginBottom: 24,
//   },
//   label: {
//     fontSize: 14,
//     fontWeight: '600',
//     color: '#666',
//     marginBottom: 8,
//   },
//   input: {
//     height: 48,
//     borderWidth: 1,
//     borderColor: '#e0e0e0',
//     borderRadius: 8,
//     paddingHorizontal: 12,
//     fontSize: 16,
//     backgroundColor: '#fff',
//   },
//   inputDisabled: {
//     backgroundColor: '#f9f9f9',
//     color: '#999',
//   },
//   saveButton: {
//     height: 48,
//     backgroundColor: '#007AFF',
//     borderRadius: 8,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginTop: 8,
//   },
//   buttonDisabled: {
//     opacity: 0.6,
//   },
//   saveButtonText: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//   },
// });


import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LogOut, User as UserIcon } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ensureDeviceKeys, resetDeviceKeys } from '@/lib/crypto/deviceKeys';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const [displayName, setDisplayName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [refreshingKeys, setRefreshingKeys] = useState(false);
  const { session, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session?.user) {
      loadProfile();
    }
  }, [session]);

  const initializeDeviceKeys = useCallback(async () => {
    if (!session?.user?.id) {
      return;
    }

    const defaultContact =
      session.user.email || session.user.phone || contactEmail || `user-${session.user.id}`;
    const defaultDisplay =
      displayName ||
      session.user.user_metadata?.full_name ||
      (defaultContact.includes('@')
        ? defaultContact.split('@')[0]
        : defaultContact);

    setDeviceStatus('loading');
    setDeviceError(null);

    try {
      await ensureDeviceKeys(session.user.id, 'primary', {
        contact: defaultContact,
        displayName: defaultDisplay,
      });
      setDeviceStatus('ready');
    } catch (error: any) {
      console.warn('[profile] Failed to ensure device keys', error);
      setDeviceStatus('error');
      setDeviceError(error?.message ?? 'Unable to initialize Signal keys for this device.');
    }
  }, [
    session?.user?.id,
    session?.user?.email,
    session?.user?.phone,
    session?.user?.user_metadata?.full_name,
    contactEmail,
    displayName,
  ]);

  useEffect(() => {
    initializeDeviceKeys();
  }, [initializeDeviceKeys]);

  const loadProfile = async () => {
    if (!session?.user) {
      return;
    }

    const contact =
      session.user.email || session.user.phone || `user-${session.user.id}`;

    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, phone_number')
      .eq('id', session.user.id)
      .maybeSingle();

    if (error) {
      console.warn('[profile] Failed to fetch profile', error);
    }

    if (!data) {
      const { data: created } = await supabase
        .from('profiles')
        .upsert(
          {
            id: session.user.id,
            phone_number: contact,
            display_name: displayName || contact.split('@')[0] || 'User',
          },
          { onConflict: 'id' }
        )
        .select('display_name, phone_number')
        .single();

      if (created) {
        setDisplayName(created.display_name || '');
        setContactEmail(created.phone_number || contact);
      } else {
        setContactEmail(contact);
      }
    } else {
      setDisplayName(data.display_name || '');
      setContactEmail(data.phone_number || contact);
    }

    setLoading(false);
  };

  const handleRegenerateDeviceKeys = async () => {
    if (!session?.user?.id) {
      return;
    }

    setRefreshingKeys(true);
    setDeviceError(null);

    try {
      const contactHint =
        session.user.email || session.user.phone || contactEmail || `user-${session.user.id}`;
      const displayHint =
        displayName ||
        session.user.user_metadata?.full_name ||
        (contactHint.includes('@') ? contactHint.split('@')[0] : contactHint);

      await resetDeviceKeys();
      await ensureDeviceKeys(session.user.id, 'primary', {
        contact: contactHint,
        displayName: displayHint,
      });
      setDeviceStatus('ready');
      Alert.alert(
        'Device keys updated',
        'A fresh set of Signal keys has been generated and published for this device.'
      );
    } catch (error: any) {
      console.warn('[profile] Failed to regenerate device keys', error);
      setDeviceStatus('error');
      setDeviceError(error?.message ?? 'Unable to regenerate device keys.');
      Alert.alert(
        'Error',
        error?.message ?? 'Unable to regenerate device keys at this time.'
      );
    } finally {
      setRefreshingKeys(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    if (!session?.user?.id) {
      Alert.alert('Error', 'Missing session information. Please sign in again.');
      return;
    }

    setSaving(true);
    const contact =
      session.user.email || session.user.phone || contactEmail || `user-${session.user.id}`;

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: session.user.id,
          display_name: displayName,
          phone_number: contact,
        },
        { onConflict: 'id' }
      )
      .select('display_name, phone_number')
      .single();

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setDisplayName(data?.display_name || displayName);
    setContactEmail(data?.phone_number || contact);
    Alert.alert('Success', 'Profile updated successfully');
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>PROFILE</Text>
          <Text style={styles.teamBadge}>TEAM IIPE</Text>
        </View>
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <LogOut size={24} color="#ff5252" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <UserIcon size={48} color="#fff" />
          </View>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.inputDisabled]}
              value={contactEmail}
              editable={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSaveProfile}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <View style={styles.securitySection}>
            <Text style={styles.sectionTitle}>Secure Messaging</Text>
            <Text style={styles.sectionDescription}>
              {deviceStatus === 'ready'
                ? 'Signal-compatible keys are published for this device.'
                : deviceStatus === 'loading'
                  ? 'Publishing device key bundle...'
                  : 'Device keys are unavailable.'}
            </Text>
            {deviceError ? (
              <Text style={styles.sectionError}>{deviceError}</Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.keyButton,
                (refreshingKeys || deviceStatus === 'loading') && styles.buttonDisabled,
              ]}
              onPress={handleRegenerateDeviceKeys}
              disabled={refreshingKeys || deviceStatus === 'loading'}
            >
              {refreshingKeys ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.keyButtonText}>Regenerate Device Keys</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0e1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#141824',
    borderBottomWidth: 2,
    borderBottomColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#4CAF50',
    letterSpacing: 2,
  },
  teamBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7cb342',
    letterSpacing: 3,
    marginTop: 2,
  },
  signOutButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff5252',
  },
  content: {
    flex: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7cb342',
  },
  formContainer: {
    paddingHorizontal: 20,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7cb342',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#141824',
    color: '#e0e0e0',
  },
  inputDisabled: {
    backgroundColor: '#1a2332',
    color: '#7cb342',
  },
  saveButton: {
    height: 48,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
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
  saveButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  securitySection: {
    marginTop: 32,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 4,
    backgroundColor: '#141824',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
    letterSpacing: 1,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#e0e0e0',
    lineHeight: 20,
  },
  sectionError: {
    fontSize: 13,
    color: '#ff5252',
  },
  keyButton: {
    height: 44,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#7cb342',
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
