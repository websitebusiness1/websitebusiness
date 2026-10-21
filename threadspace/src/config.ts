// Everything the platform brand needs is here or in env vars, so renaming is a one-line change.
const env = import.meta.env;

export const config = {
  platformName: (env.VITE_PLATFORM_NAME as string | undefined) || 'ThreadSpace',
  contactEmail: (env.VITE_CONTACT_EMAIL as string | undefined) || '',
  contactPhone: (env.VITE_CONTACT_PHONE as string | undefined) || '',
  facebookUrl: (env.VITE_FACEBOOK_URL as string | undefined) || '',
  instagramUrl: (env.VITE_INSTAGRAM_URL as string | undefined) || '',
};
