import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { useRuntimeConfig } from '#imports';

// Initialize Firebase Admin if it hasn't been initialized yet
export const initFirebase = () => {
  const apps = getApps();
  if (!apps.length) {
    const fb_key = useRuntimeConfig();
    const config = {
      credential: cert({
        projectId: fb_key.projectId,
        clientEmail: fb_key.clientEmail,
        privateKey: fb_key.fb_pvt_key?.replace(/\\n/g, '\n')
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL
    };
    return initializeApp(config);
  }
  
  return apps[0];
};