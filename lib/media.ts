// Only passive HTTPS image URLs; no credentials, script or inline SVG URLs.
export function safeImageUrl(value?: string): string | undefined {
 if (!value) return undefined;
 try { const url=new URL(value); return url.protocol==='https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export function safeSourceUrl(value: string): string {
 try {const url=new URL(value);return ['https:','http:'].includes(url.protocol) ? url.href : '#';}catch{return '#';}
}
