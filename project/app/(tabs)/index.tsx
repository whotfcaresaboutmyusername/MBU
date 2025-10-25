// import React, { useEffect, useState } from 'react';
// import {
//   View,
//   Text,
//   FlatList,
//   TouchableOpacity,
//   StyleSheet,
//   ActivityIndicator,
//   TextInput,
//   Alert,
// } from 'react-native';
// import { useRouter } from 'expo-router';
// import { Plus, Search } from 'lucide-react-native';
// import { supabase } from '@/lib/supabase';
// import { useAuth } from '@/contexts/AuthContext';

// interface Conversation {
//   id: string;
//   updated_at: string;
//   other_user: {
//     id: string;
//     display_name: string;
//     phone_number: string;
//   };
//   last_message?: {
//     content: string;
//     created_at: string;
//   };
// }

// export default function ChatsScreen() {
//   const [conversations, setConversations] = useState<Conversation[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [showNewChat, setShowNewChat] = useState(false);
//   const [newChatPhone, setNewChatPhone] = useState('');
//   const { session } = useAuth();
//   const router = useRouter();

//   useEffect(() => {
//     if (session?.user) {
//       loadConversations();

//       const channel = supabase
//         .channel('conversations')
//         .on(
//           'postgres_changes',
//           {
//             event: '*',
//             schema: 'public',
//             table: 'messages',
//           },
//           () => {
//             loadConversations();
//           }
//         )
//         .subscribe();

//       return () => {
//         supabase.removeChannel(channel);
//       };
//     }
//   }, [session]);

//   const loadConversations = async () => {
//     if (!session?.user) return;

//     const { data: participantData } = await supabase
//       .from('conversation_participants')
//       .select('conversation_id')
//       .eq('user_id', session.user.id);

//     if (!participantData || participantData.length === 0) {
//       setConversations([]);
//       setLoading(false);
//       return;
//     }

//     const conversationIds = participantData.map((p) => p.conversation_id);

//     const { data: conversationsData } = await supabase
//       .from('conversations')
//       .select('*')
//       .in('id', conversationIds)
//       .order('updated_at', { ascending: false });

//     if (!conversationsData) {
//       setLoading(false);
//       return;
//     }

//     const conversationsWithDetails = await Promise.all(
//       conversationsData.map(async (conv) => {
//         const { data: participants } = await supabase
//           .from('conversation_participants')
//           .select('user_id')
//           .eq('conversation_id', conv.id)
//           .neq('user_id', session.user.id)
//           .limit(1)
//           .maybeSingle();

//         if (!participants) return null;

//         const { data: otherUser } = await supabase
//           .from('profiles')
//           .select('id, display_name, phone_number')
//           .eq('id', participants.user_id)
//           .single();

//         const { data: lastMessage } = await supabase
//           .from('messages')
//           .select('content, created_at')
//           .eq('conversation_id', conv.id)
//           .order('created_at', { ascending: false })
//           .limit(1)
//           .maybeSingle();

//         return {
//           id: conv.id,
//           updated_at: conv.updated_at,
//           other_user: otherUser,
//           last_message: lastMessage || undefined,
//         };
//       })
//     );

//     setConversations(
//       conversationsWithDetails.filter((c) => c !== null) as Conversation[]
//     );
//     setLoading(false);
//   };

//   const createNewChat = async () => {
//     if (!newChatPhone) {
//       Alert.alert('Error', 'Please enter a phone number');
//       return;
//     }

//     const { data: otherUser } = await supabase
//       .from('profiles')
//       .select('id')
//       .eq('phone_number', newChatPhone)
//       .maybeSingle();

//     if (!otherUser) {
//       Alert.alert('Error', 'User not found');
//       return;
//     }

//     const { data: existingConv } = await supabase
//       .from('conversation_participants')
//       .select('conversation_id')
//       .eq('user_id', session?.user.id);

//     if (existingConv) {
//       for (const conv of existingConv) {
//         const { data: otherParticipant } = await supabase
//           .from('conversation_participants')
//           .select('user_id')
//           .eq('conversation_id', conv.conversation_id)
//           .eq('user_id', otherUser.id)
//           .maybeSingle();

//         if (otherParticipant) {
//           setShowNewChat(false);
//           setNewChatPhone('');
//           router.push({
//             pathname: '/chat/[id]',
//             params: { id: conv.conversation_id },
//           });
//           return;
//         }
//       }
//     }

//     const { data: newConv } = await supabase
//       .from('conversations')
//       .insert({})
//       .select()
//       .single();

//     if (newConv) {
//       await supabase.from('conversation_participants').insert([
//         { conversation_id: newConv.id, user_id: session?.user.id },
//         { conversation_id: newConv.id, user_id: otherUser.id },
//       ]);

//       setShowNewChat(false);
//       setNewChatPhone('');
//       router.push({
//         pathname: '/chat/[id]',
//         params: { id: newConv.id },
//       });
//     }
//   };

//   const renderConversation = ({ item }: { item: Conversation }) => (
//     <TouchableOpacity
//       style={styles.conversationItem}
//       onPress={() =>
//         router.push({
//           pathname: '/chat/[id]',
//           params: { id: item.id },
//         })
//       }
//     >
//       <View style={styles.avatar}>
//         <Text style={styles.avatarText}>
//           {item.other_user.display_name.charAt(0).toUpperCase()}
//         </Text>
//       </View>
//       <View style={styles.conversationContent}>
//         <View style={styles.conversationHeader}>
//           <Text style={styles.conversationName}>
//             {item.other_user.display_name}
//           </Text>
//           {item.last_message && (
//             <Text style={styles.conversationTime}>
//               {new Date(item.last_message.created_at).toLocaleTimeString([], {
//                 hour: '2-digit',
//                 minute: '2-digit',
//               })}
//             </Text>
//           )}
//         </View>
//         {item.last_message && (
//           <Text style={styles.conversationMessage} numberOfLines={1}>
//             {item.last_message.content}
//           </Text>
//         )}
//       </View>
//     </TouchableOpacity>
//   );

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
//         <Text style={styles.headerTitle}>Chats</Text>
//         <TouchableOpacity
//           style={styles.newChatButton}
//           onPress={() => setShowNewChat(true)}
//         >
//           <Plus size={24} color="#007AFF" />
//         </TouchableOpacity>
//       </View>

//       {showNewChat && (
//         <View style={styles.newChatContainer}>
//           <TextInput
//             style={styles.newChatInput}
//             placeholder="Enter phone number"
//             value={newChatPhone}
//             onChangeText={setNewChatPhone}
//             keyboardType="phone-pad"
//           />
//           <TouchableOpacity style={styles.createButton} onPress={createNewChat}>
//             <Text style={styles.createButtonText}>Start Chat</Text>
//           </TouchableOpacity>
//           <TouchableOpacity
//             style={styles.cancelButton}
//             onPress={() => {
//               setShowNewChat(false);
//               setNewChatPhone('');
//             }}
//           >
//             <Text style={styles.cancelButtonText}>Cancel</Text>
//           </TouchableOpacity>
//         </View>
//       )}

//       <View style={styles.searchContainer}>
//         <Search size={20} color="#999" style={styles.searchIcon} />
//         <TextInput
//           style={styles.searchInput}
//           placeholder="Search chats"
//           value={searchQuery}
//           onChangeText={setSearchQuery}
//         />
//       </View>

//       {conversations.length === 0 ? (
//         <View style={styles.emptyContainer}>
//           <Text style={styles.emptyText}>No conversations yet</Text>
//           <Text style={styles.emptySubtext}>
//             Tap the + button to start a new chat
//           </Text>
//         </View>
//       ) : (
//         <FlatList
//           data={conversations.filter((conv) =>
//             conv.other_user.display_name
//               .toLowerCase()
//               .includes(searchQuery.toLowerCase())
//           )}
//           renderItem={renderConversation}
//           keyExtractor={(item) => item.id}
//           contentContainerStyle={styles.listContent}
//         />
//       )}
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
//   newChatButton: {
//     width: 40,
//     height: 40,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   newChatContainer: {
//     padding: 16,
//     backgroundColor: '#f9f9f9',
//     borderBottomWidth: 1,
//     borderBottomColor: '#e0e0e0',
//   },
//   newChatInput: {
//     height: 48,
//     borderWidth: 1,
//     borderColor: '#e0e0e0',
//     borderRadius: 8,
//     paddingHorizontal: 12,
//     fontSize: 16,
//     backgroundColor: '#fff',
//     marginBottom: 8,
//   },
//   createButton: {
//     height: 48,
//     backgroundColor: '#007AFF',
//     borderRadius: 8,
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginBottom: 8,
//   },
//   createButtonText: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   cancelButton: {
//     height: 48,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   cancelButtonText: {
//     color: '#007AFF',
//     fontSize: 16,
//   },
//   searchContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//     paddingVertical: 12,
//     backgroundColor: '#f9f9f9',
//   },
//   searchIcon: {
//     marginRight: 8,
//   },
//   searchInput: {
//     flex: 1,
//     height: 40,
//     fontSize: 16,
//   },
//   listContent: {
//     paddingVertical: 8,
//   },
//   conversationItem: {
//     flexDirection: 'row',
//     paddingHorizontal: 20,
//     paddingVertical: 12,
//     borderBottomWidth: 1,
//     borderBottomColor: '#f0f0f0',
//   },
//   avatar: {
//     width: 50,
//     height: 50,
//     borderRadius: 25,
//     backgroundColor: '#007AFF',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 12,
//   },
//   avatarText: {
//     color: '#fff',
//     fontSize: 20,
//     fontWeight: '600',
//   },
//   conversationContent: {
//     flex: 1,
//     justifyContent: 'center',
//   },
//   conversationHeader: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center',
//     marginBottom: 4,
//   },
//   conversationName: {
//     fontSize: 16,
//     fontWeight: '600',
//     color: '#1a1a1a',
//   },
//   conversationTime: {
//     fontSize: 12,
//     color: '#999',
//   },
//   conversationMessage: {
//     fontSize: 14,
//     color: '#666',
//   },
//   emptyContainer: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 40,
//   },
//   emptyText: {
//     fontSize: 20,
//     fontWeight: '600',
//     color: '#999',
//     marginBottom: 8,
//   },
//   emptySubtext: {
//     fontSize: 14,
//     color: '#999',
//     textAlign: 'center',
//   },
// });


import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Search } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Conversation {
  id: string;
  updated_at: string;
  other_user: {
    id: string;
    display_name: string;
    phone_number: string;
  };
  last_message?: {
    content: string;
    created_at: string;
  };
}

export default function ChatsScreen() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatIdentifier, setNewChatIdentifier] = useState('');
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session?.user) {
      loadConversations();

      const channel = supabase
        .channel('conversations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
          },
          () => {
            loadConversations();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [session]);

  const loadConversations = async () => {
    if (!session?.user) return;

    const { data: participantData } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', session.user.id);

    if (!participantData || participantData.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = participantData.map((p) => p.conversation_id);

    const { data: conversationsData } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    if (!conversationsData) {
      setLoading(false);
      return;
    }

    const conversationsWithDetails = await Promise.all(
      conversationsData.map(async (conv) => {
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conv.id)
          .neq('user_id', session.user.id)
          .limit(1)
          .maybeSingle();

        if (!participants) return null;

        const { data: otherUser, error: otherUserError } = await supabase
          .from('profiles')
          .select('id, display_name, phone_number')
          .eq('id', participants.user_id)
          .maybeSingle();

        if (otherUserError) {
          console.warn('[conversations] Failed to fetch profile', otherUserError);
        }

        const normalizedName =
          otherUser?.display_name?.trim() ||
          otherUser?.phone_number?.trim() ||
          'Unknown';

        const normalizedOtherUser: Conversation['other_user'] = {
          id: otherUser?.id ?? participants.user_id,
          display_name: normalizedName,
          phone_number: otherUser?.phone_number ?? '',
        };

        const { data: lastMessage } = await supabase
          .from('messages')
          .select('content, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: conv.id,
          updated_at: conv.updated_at,
          other_user: normalizedOtherUser,
          last_message: lastMessage || undefined,
        };
      })
    );

    setConversations(
      conversationsWithDetails.filter((c) => c !== null) as Conversation[]
    );
    setLoading(false);
  };

  const escapeForILike = (value: string) =>
    value.replace(/[%_\\]/g, (char) => `\\${char}`);

  const createNewChat = async () => {
    const searchValue = newChatIdentifier.trim();

    if (!searchValue) {
      Alert.alert('Error', 'Please enter an email or username');
      return;
    }

    if (!session?.user) {
      Alert.alert('Error', 'You need to be signed in to start a chat');
      return;
    }

    if (
      session.user.email &&
      session.user.email.toLowerCase() === searchValue.toLowerCase()
    ) {
      Alert.alert('Error', 'You cannot start a chat with yourself');
      return;
    }

    type ProfileSearchCandidate = {
      column: 'phone_number' | 'display_name';
      value: string;
      operator: 'eq' | 'ilike';
    };

    const searchCandidates: ProfileSearchCandidate[] = [];
    const sanitizedValue = escapeForILike(searchValue);

    if (searchValue.includes('@')) {
      const normalizedEmail = searchValue.toLowerCase();
      searchCandidates.push({
        column: 'phone_number',
        value: normalizedEmail,
        operator: 'eq',
      });

      if (normalizedEmail !== searchValue) {
        searchCandidates.push({
          column: 'phone_number',
          value: searchValue,
          operator: 'eq',
        });
      }

      searchCandidates.push({
        column: 'phone_number',
        value: sanitizedValue,
        operator: 'ilike',
      });
    }

    searchCandidates.push(
      {
        column: 'display_name',
        value: searchValue,
        operator: 'eq',
      },
      {
        column: 'display_name',
        value: sanitizedValue,
        operator: 'ilike',
      },
      {
        column: 'display_name',
        value: `%${sanitizedValue}%`,
        operator: 'ilike',
      }
    );

    let matchedUser: { id: string } | null = null;
    let searchErrorMessage: string | null = null;

    for (const candidate of searchCandidates) {
      const baseQuery = supabase
        .from('profiles')
        .select('id')
        .neq('id', session.user.id);

      const query =
        candidate.operator === 'eq'
          ? baseQuery.eq(candidate.column, candidate.value)
          : baseQuery.ilike(candidate.column, candidate.value);

      const { data, error } = await query.maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          searchErrorMessage =
            'Multiple users match that search. Please enter the exact email or username.';
        } else {
          searchErrorMessage = error.message;
        }
        break;
      }

      if (data) {
        matchedUser = data;
        break;
      }
    }

    if (searchErrorMessage) {
      Alert.alert('Error', searchErrorMessage);
      return;
    }

    if (!matchedUser) {
      Alert.alert('Error', 'User not found');
      return;
    }

    const {
      data: existingConv,
      error: existingConvError,
    } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', session.user.id);

    if (existingConvError) {
      Alert.alert('Error', existingConvError.message);
      return;
    }

    if (existingConv) {
      for (const conv of existingConv) {
        const {
          data: otherParticipant,
          error: otherParticipantError,
        } = await supabase
          .from('conversation_participants')
          .select('user_id')
          .eq('conversation_id', conv.conversation_id)
          .eq('user_id', matchedUser.id)
          .maybeSingle();

        if (otherParticipantError) {
          Alert.alert('Error', otherParticipantError.message);
          return;
        }

        if (otherParticipant) {
          setShowNewChat(false);
          setNewChatIdentifier('');
          router.push({
            pathname: '/chat/[id]',
            params: { id: conv.conversation_id },
          });
          return;
        }
      }
    }

    const { data: newConv, error: newConvError } = await supabase
      .from('conversations')
      .insert({})
      .select()
      .single();

    if (newConvError || !newConv) {
      Alert.alert(
        'Error',
        newConvError?.message || 'Could not create a new conversation.'
      );
      return;
    }

    const { error: participantsError } = await supabase
      .from('conversation_participants')
      .insert([
        { conversation_id: newConv.id, user_id: session.user.id },
        { conversation_id: newConv.id, user_id: matchedUser.id },
      ]);

    if (participantsError) {
      Alert.alert('Error', participantsError.message);
      return;
    }

    setShowNewChat(false);
    setNewChatIdentifier('');
    router.push({
      pathname: '/chat/[id]',
      params: { id: newConv.id },
    });
  };

  const renderConversation = ({ item }: { item: Conversation }) => {
    const name =
      item.other_user.display_name?.trim() ||
      item.other_user.phone_number?.trim() ||
      'Unknown';
    const avatarLetter = name.charAt(0).toUpperCase();

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() =>
          router.push({
            pathname: '/chat/[id]',
            params: { id: item.id },
          })
        }
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{avatarLetter}</Text>
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationName}>{name}</Text>
            {item.last_message && (
              <Text style={styles.conversationTime}>
                {new Date(item.last_message.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
          {item.last_message && (
            <Text style={styles.conversationMessage} numberOfLines={1}>
              {item.last_message.content}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredConversations = normalizedQuery
    ? conversations.filter((conv) => {
        const name = conv.other_user.display_name?.toLowerCase() ?? '';
        const contact =
          conv.other_user.phone_number?.toLowerCase() ??
          conv.other_user.id.toLowerCase();
        return (
          name.includes(normalizedQuery) || contact.includes(normalizedQuery)
        );
      })
    : conversations;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>DEFCOM</Text>
          <Text style={styles.teamBadge}>TEAM IIPE</Text>
        </View>
        <TouchableOpacity
          style={styles.newChatButton}
          onPress={() => setShowNewChat(true)}
        >
          <Plus size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {showNewChat && (
        <View style={styles.newChatContainer}>
          <TextInput
            style={styles.newChatInput}
            placeholder="Enter email or username"
            value={newChatIdentifier}
            onChangeText={setNewChatIdentifier}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.createButton} onPress={createNewChat}>
            <Text style={styles.createButtonText}>Start Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setShowNewChat(false);
              setNewChatIdentifier('');
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.searchContainer}>
        <Search size={20} color="#4CAF50" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the + button to start a new chat
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          renderItem={renderConversation}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
        />
      )}
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
    textShadowColor: 'rgba(76, 175, 80, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  teamBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7cb342',
    letterSpacing: 3,
    marginTop: 2,
  },
  newChatButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  newChatContainer: {
    padding: 16,
    backgroundColor: '#1a2332',
    borderBottomWidth: 1,
    borderBottomColor: '#4CAF50',
  },
  newChatInput: {
    height: 48,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 4,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#141824',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  createButton: {
    height: 48,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#7cb342',
  },
  createButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cancelButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 4,
  },
  cancelButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#1a2332',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    color: '#e0e0e0',
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2332',
    backgroundColor: '#141824',
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#4CAF50',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#7cb342',
  },
  avatarText: {
    color: '#000',
    fontSize: 20,
    fontWeight: '700',
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4CAF50',
  },
  conversationTime: {
    fontSize: 12,
    color: '#7cb342',
  },
  conversationMessage: {
    fontSize: 14,
    color: '#a0a0a0',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: 8,
    letterSpacing: 1,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#7cb342',
    textAlign: 'center',
  },
});
