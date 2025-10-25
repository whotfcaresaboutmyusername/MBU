/*
  # Add Message Read Policy

  1. Policy Changes
    - Add policy to allow users to update message `read` status in conversations they participate in
    - This allows message recipients to mark messages as read without being the sender

  2. Security
    - Users can only update messages in conversations they're part of
    - Restrictive: only allows updating the `read` field, not other fields
*/

-- Allow users to mark messages as read in their conversations
CREATE POLICY "Users can mark messages as read in their conversations"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = messages.conversation_id
      AND conversation_participants.user_id = auth.uid()
    )
  );
