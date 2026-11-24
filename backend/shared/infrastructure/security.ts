import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
export function encrypt(value: string) {
 const key = Buffer.from(process.env.CREDENTIAL_KEY ?? '', 'hex');
 if (key.length !== 32) throw new Error('Configure CREDENTIAL_KEY with 32 random bytes in hex');
 const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
 return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]).toString('base64');
}
export function decrypt(value: string) {
 const bytes = Buffer.from(value, 'base64');
 const cipher = createDecipheriv('aes-256-gcm', Buffer.from(process.env.CREDENTIAL_KEY ?? '', 'hex'), bytes.subarray(0,12));
 cipher.setAuthTag(bytes.subarray(-16));
 return Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]).toString();
}
export function publicAddress(address: string) {
 try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}
export function localException(url: URL) {
 return process.env.ALLOW_LOCAL_MCP === 'true' && url.href === process.env.REFERENCE_MCP_URL;
}
export async function validateEndpoint(value: string) {
 const url = new URL(value);
 if (url.username || url.password || url.hash) throw new Error('Endpoint cannot contain credentials or fragments');
 if (localException(url)) return url;
 if (url.protocol !== 'https:') throw new Error('MCP requires HTTPS');
 const addresses = await lookup(url.hostname, {all:true});
 if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('Endpoint must resolve to public addresses');
 return url;
}
export function redact(text: string, secrets: string[]) {
 let result = text;
 for (const secret of secrets.filter(Boolean)) result = result.split(secret).join('[redacted]');
 return result.slice(0,64000);
}
