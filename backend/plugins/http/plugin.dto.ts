import { z } from 'zod';
export const draftInput = z.object({
  name: z.string(), description: z.string(), logo: z.string().max(2800000).default(''),
  markdown: z.string(), endpoint: z.string(), auth: z.enum(['none', 'bearer']),
});
export const tokenInput = z.object({ token: z.string().max(4096).default('') });
export function validateLogo(logo: string) {
  if (!logo) return;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(logo);
  if (!match) throw new Error('Invalid logo');
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 2097152) throw new Error('Invalid logo');
  const signatures = {
    png: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
    jpeg: bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])),
    webp: bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP',
  };
  if (!signatures[match[1] as keyof typeof signatures]) throw new Error('Invalid logo');
}
