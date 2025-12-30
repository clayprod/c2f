import { createClient } from './supabase/client';

/**
 * Upload file to Supabase Storage
 * @param file File to upload
 * @param path Path within the user's folder (e.g., 'avatars/profile.jpg')
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Path format: {user_id}/{path}
  const fullPath = `${user.id}/${path}`;

  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fullPath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw error;
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(fullPath);

  return publicUrl;
}

/**
 * Upload file to public folder (for avatars, etc)
 * @param file File to upload
 * @param path Path within public folder (e.g., 'avatars/profile.jpg')
 * @returns Public URL of the uploaded file
 */
export async function uploadPublicFile(file: File, path: string): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  // Path format: public/{path}
  const fullPath = `public/${path}`;

  const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fullPath, file, {
      cacheControl: '3600',
      upsert: true, // Allow overwriting for avatars
    });

  if (error) {
    throw error;
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(fullPath);

  return publicUrl;
}

/**
 * Delete file from Supabase Storage
 * @param path Path to file (relative to user folder or public folder)
 * @param isPublic Whether file is in public folder
 */
export async function deleteFile(path: string, isPublic: boolean = false): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not authenticated');
  }

  const fullPath = isPublic ? `public/${path}` : `${user.id}/${path}`;

  const { error } = await supabase.storage.from('uploads').remove([fullPath]);

  if (error) {
    throw error;
  }
}

/**
 * Get public URL for a file
 * @param path Path to file
 * @param isPublic Whether file is in public folder
 * @returns Public URL
 */
export function getFileUrl(path: string, isPublic: boolean = false): string {
  const supabase = createClient();
  const fullPath = isPublic ? `public/${path}` : path;

  const {
    data: { publicUrl },
  } = supabase.storage.from('uploads').getPublicUrl(fullPath);

  return publicUrl;
}


