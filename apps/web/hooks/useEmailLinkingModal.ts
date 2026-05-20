import { useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';

/**
 * Hook to manage the email linking modal state.
 * Determines whether to show the email linking modal based on:
 * - User's linked emails
 * - Whether they already have a personal email linked
 * - Whether they've dismissed the modal in this session
 */
export function useEmailLinkingModal() {
  const supabaseClient = getSupabaseBrowserClient();
  const { user } = useAuth();
  const [shouldShowModal, setShouldShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmails, setUserEmails] = useState<any[]>([]);
  const [primaryEmail, setPrimaryEmail] = useState<string>('');

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const checkEmailStatus = async () => {
      try {
        // Fetch user emails from backend
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/auth/emails/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const result = await response.json();
          setUserEmails(result.emails || []);
          setPrimaryEmail(result.primaryEmail || '');

          // Determine if we should show the modal
          const hasPersonalEmail = result.emails.some(
            (e: any) => !e.email.endsWith('@student.funaab.edu.ng')
          );
          const hasBeenDismissed = localStorage.getItem('email-linking-dismissed') === 'true';

          // Only show if user has institutional email but no personal email, and hasn't dismissed
          if (
            !hasPersonalEmail &&
            !hasBeenDismissed &&
            result.emails.some((e: any) => e.email.endsWith('@student.funaab.edu.ng'))
          ) {
            setShouldShowModal(true);
          }
        }
      } catch (error) {
        console.error('Error checking email status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkEmailStatus();
  }, [user?.id, supabaseClient]);

  const dismissModal = () => {
    setShouldShowModal(false);
    // Store dismissal preference for the session
    localStorage.setItem('email-linking-dismissed', 'true');
  };

  const onSuccess = () => {
    // Clear dismissal on successful link
    localStorage.removeItem('email-linking-dismissed');
    setShouldShowModal(false);
    // Refresh email list
    window.location.reload();
  };

  return {
    shouldShowModal,
    isLoading,
    userEmails,
    primaryEmail,
    dismissModal,
    onSuccess,
  };
}
