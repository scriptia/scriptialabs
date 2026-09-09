import { z } from 'zod';

export const appStoreConnectConfigSchema = z.object({
  appId: z.string().uuid('Choose an app.'),
  issuerId: z.string().trim().min(1, 'Enter the Issuer ID.').max(200),
  keyId: z.string().trim().min(1, 'Enter the Key ID.').max(200),
  privateKeyPem: z
    .string()
    .trim()
    .min(1, 'Paste the .p8 private key content.')
    .refine((value) => value.includes('BEGIN PRIVATE KEY'), 'That doesn’t look like a .p8 private key (expected a PEM block).'),
  vendorNumber: z.string().trim().min(1, 'Enter the vendor number.').max(50),
  ascAppId: z
    .string()
    .trim()
    .min(1, 'Enter the app’s Apple ID.')
    .regex(/^\d+$/, 'The Apple App ID is numeric.')
});

export type AppStoreConnectConfigInput = z.infer<typeof appStoreConnectConfigSchema>;
