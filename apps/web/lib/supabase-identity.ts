import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase identity linking utilities for the dual-email architecture.
 * Handles manual identity linking when email addresses don't match exactly.
 */

export interface IdentityLinkOptions {
  provider: 'google' | 'github' | 'email';
  email?: string;
}

/**
 * Links an identity (OAuth provider) to the current user's account.
 * Since institutional emails and personal emails differ, we use manual linking.
 *
 * Reference: https://supabase.com/docs/guides/auth/managing-user-sessions#linking-identities
 */
export async function linkIdentityManually(
  supabase: SupabaseClient,
  options: IdentityLinkOptions
): Promise<{ success: boolean; message: string }> {
  try {
    const { provider, email } = options;

    // Get current session to ensure user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session. User must be authenticated to link identities.');
    }

    // For OAuth providers (Google, GitHub), initiate the linking flow
    if (provider !== 'email') {
      const { error } = await supabase.auth.linkIdentity({
        provider: provider as any,
      });

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: `${provider} account linked successfully. You can now log in with ${provider}.`,
      };
    }

    // For email-based linking, update user metadata to track linked emails
    const { data: { user }, error: updateError } = await supabase.auth.updateUser({
      data: {
        linked_emails: [
          ...(session.user.user_metadata?.linked_emails || []),
          email,
        ],
      },
    });

    if (updateError) {
      throw updateError;
    }

    return {
      success: true,
      message: `Email ${email} linked successfully.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to link identity';
    console.error('Identity linking error:', errorMessage);
    throw error;
  }
}

/**
 * Retrieves all identities linked to the current user.
 * Useful for displaying email management UI.
 */
export async function getLinkedIdentities(
  supabase: SupabaseClient
): Promise<{ email: string; provider?: string; isPrimary?: boolean }[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not found');
    }

    // Collect identities from Supabase metadata and identities array
    const linkedIdentities: { email: string; provider?: string; isPrimary?: boolean }[] = [];

    // Primary email
    if (user.email) {
      linkedIdentities.push({
        email: user.email,
        isPrimary: true,
      });
    }

    // OAuth-linked identities
    if (user.identities) {
      user.identities.forEach((identity) => {
        if (identity.identity_data?.email) {
          linkedIdentities.push({
            email: identity.identity_data.email,
            provider: identity.provider,
          });
        }
      });
    }

    // Additional linked emails stored in metadata
    const linkedEmails = user.user_metadata?.linked_emails || [];
    linkedEmails.forEach((email: string) => {
      if (!linkedIdentities.some((id) => id.email === email)) {
        linkedIdentities.push({
          email,
          provider: 'email',
        });
      }
    });

    return linkedIdentities;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get identities';
    console.error('Error retrieving identities:', errorMessage);
    throw error;
  }
}

/**
 * Unlinking an identity from the user account.
 * Note: User must have at least one way to log in remaining.
 */
export async function unlinkIdentity(
  supabase: SupabaseClient,
  providerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const identity = user?.identities?.find((item) => item.id === providerId);

    if (!identity) {
      throw new Error('Identity not found for the current user.');
    }

    const { error } = await supabase.auth.unlinkIdentity(identity);

    if (error) {
      throw error;
    }

    return {
      success: true,
      message: 'Identity unlinked successfully.',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unlink identity';
    console.error('Error unlinking identity:', errorMessage);
    throw error;
  }
}

/**
 * Validates that a user still has at least one way to log in.
 * Used to prevent accidental lockout.
 */
export async function canUnlinkIdentity(
  supabase: SupabaseClient,
  providerId: string
): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.identities) {
      return false;
    }

    // If user has password, they can unlink anything
    if (user.user_metadata?.provider === 'password') {
      return true;
    }

    // If user has multiple identities, they can unlink one
    return user.identities.length > 1;
  } catch (error) {
    console.error('Error checking if identity can be unlinked:', error);
    return false;
  }
}
