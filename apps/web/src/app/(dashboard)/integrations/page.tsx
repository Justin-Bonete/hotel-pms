'use client';

import { API_KEY_SCOPES, API_KEY_SCOPE_LABELS, WEBHOOK_ALL_EVENTS, WEBHOOK_EVENTS, type ApiKeyCreated, type ApiKeyScope, type ApiKeyView, type WebhookEndpointCreated, type WebhookEndpointView } from '@pms/types';
import { useState } from 'react';
import { Modal } from '@/components/ui/modal';
import { Alert, Badge, Button, Card, EmptyState, Field, SelectField, Spinner } from '@/components/ui/ui';
import { useAccess } from '@/features/access/access-context';
import { useApiKeys, useDeliveries, useRefreshIntegrations, useWebhooks } from '@/features/integrations/queries';
import { labelOf } from '@/features/operations/shared';
import { useProperties } from '@/features/properties/property-context';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type Tab = 'keys' | 'webhooks' | 'help';

export default function IntegrationsPage() {
  const { can } = useAccess();
  const read = can('integration.read');
  const [tab, setTab] = useState<Tab>('keys');
  if (!read) return <Alert tone="info">Only owners and managers can see integrations.</Alert>;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Integrations</h1>
        <p className="mt-1 text-sm text-slate-500">Let your website take bookings, and let other systems hear about what happens here.</p>
      </div>
      <div role="tablist" className="flex gap-1 border-b border-slate-200">
        {([['keys', 'API keys'], ['webhooks', 'Webhooks'], ['help', 'How to connect']] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('border-b-2 px-4 py-2 text-sm font-medium', tab === id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700')}>{label}</button>
        ))}
      </div>
      {tab === 'keys' && <KeysTab canManage={can('integration.manage')} />}
      {tab === 'webhooks' && <WebhooksTab canManage={can('integration.manage')} />}
      {tab === 'help' && <HelpTab />}
    </div>
  );
}

/** A secret that is shown once. The person must confirm they copied it before it disappears. */
function SecretModal({ title, secret, note, onClose }: { title: string; secret: string; note: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal open title={title} onClose={() => undefined}>
      <div className="space-y-4">
        <Alert tone="warning">{note}</Alert>
        <code className="block break-all rounded-lg bg-slate-900 p-3 text-sm text-emerald-300">{secret}</code>
        <div className="flex justify-between gap-2">
          <Button variant="secondary" onClick={async () => { await navigator.clipboard.writeText(secret); setCopied(true); }}>{copied ? 'Copied ✓' : 'Copy'}</Button>
          <Button onClick={onClose}>I have saved it</Button>
        </div>
      </div>
    </Modal>
  );
}

// ================================================================== API keys
function KeysTab({ canManage }: { canManage: boolean }) {
  const keys = useApiKeys();
  const { properties } = useProperties();
  const refresh = useRefreshIntegrations();
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ApiKeyCreated | null>(null);
  const [revoking, setRevoking] = useState<ApiKeyView | null>(null);
  const name = (id: string) => properties.find((p) => p.id === id)?.name ?? 'a property';
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">An API key lets your <strong>website’s server</strong> check availability and create bookings. A key can only reach the properties you choose. Never put a key in web page JavaScript: anyone could copy it.</p>
        {canManage && <Button onClick={() => setCreating(true)}>Create key</Button>}
      </div>
      {keys.isLoading && <Spinner />}
      {keys.error && <Alert tone="error">{keys.error.message}</Alert>}
      {keys.data?.length === 0 && <EmptyState title="No API keys yet" description="Create one to connect your website’s booking form." />}
      <div className="space-y-3">
        {keys.data?.map((k) => (
          <Card key={k.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><span className="font-semibold text-slate-900">{k.name}</span> <code className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{k.prefix}…</code></div>
              {k.revokedAt ? <Badge tone="neutral">Revoked</Badge> : k.expiresAt && new Date(k.expiresAt) < new Date() ? <Badge tone="warning">Expired</Badge> : <Badge tone="success">Active</Badge>}
            </div>
            <p className="text-sm text-slate-600">Properties: {k.propertyIds.map(name).join(', ')}</p>
            <p className="text-sm text-slate-600">Can: {k.scopes.map((s) => API_KEY_SCOPE_LABELS[s]).join(' · ')}{k.autoConfirm ? ' · bookings are confirmed automatically' : ' · bookings wait for you to confirm'}</p>
            <p className="text-xs text-slate-400">Created {new Date(k.createdAt).toLocaleDateString()} · {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleString()}` : 'never used'}{k.expiresAt ? ` · expires ${new Date(k.expiresAt).toLocaleDateString()}` : ''}</p>
            {canManage && !k.revokedAt && <Button variant="ghost" onClick={() => setRevoking(k)}>Revoke</Button>}
          </Card>
        ))}
      </div>
      {creating && <CreateKeyModal onClose={() => setCreating(false)} onCreated={(k) => { setCreating(false); setCreated(k); void refresh(); }} />}
      {created && <SecretModal title={`Key “${created.name}”`} secret={created.key} note="Copy this key now. For your safety we only keep a one-way fingerprint, so we can never show it again. If it is lost, revoke it and create a new one." onClose={() => setCreated(null)} />}
      {revoking && <RevokeModal apiKey={revoking} onClose={() => setRevoking(null)} />}
    </div>
  );
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (k: ApiKeyCreated) => void }) {
  const { properties } = useProperties();
  const { can } = useAccess();
  const allowed = properties.filter((p) => can('integration.manage', p.id));
  const [name, setName] = useState('');
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['availability:read', 'bookings:create']);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function save() {
    setError(null);
    if (name.trim().length < 2) return setError('Give the key a name, like “Website booking form”.');
    if (propertyIds.length === 0) return setError('Choose at least one property.');
    if (scopes.length === 0) return setError('Choose what the key may do.');
    setBusy(true);
    try {
      onCreated(await api.post<ApiKeyCreated>('/integrations/api-keys', { name, propertyIds, scopes, autoConfirm, ...(expiry ? { expiresInDays: Number(expiry) } : {}) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the key.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title="Create API key" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Website booking form" />
        <fieldset className="space-y-1"><legend className="text-sm font-medium text-slate-700">Properties it can reach</legend>
          {allowed.map((p) => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={propertyIds.includes(p.id)} onChange={() => setPropertyIds((l) => toggle(l, p.id))} /> {p.name}</label>)}
          {allowed.length === 0 && <p className="text-sm text-slate-500">You don’t manage any property.</p>}
        </fieldset>
        <fieldset className="space-y-1"><legend className="text-sm font-medium text-slate-700">What it may do</legend>
          {API_KEY_SCOPES.map((s) => <label key={s} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={scopes.includes(s)} onChange={() => setScopes((l) => toggle(l, s))} /> {API_KEY_SCOPE_LABELS[s]}</label>)}
        </fieldset>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300" checked={autoConfirm} onChange={(e) => setAutoConfirm(e.target.checked)} /><span>Confirm online bookings automatically<span className="block text-xs text-slate-500">Off (recommended): each online booking waits as “Pending” until you confirm it. On: it is confirmed straight away, with no payment taken.</span></span></label>
        <SelectField label="Expires" value={expiry} onChange={(e) => setExpiry(e.target.value)}><option value="">Never</option><option value="30">In 30 days</option><option value="90">In 90 days</option><option value="365">In 1 year</option></SelectField>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Create key</Button></div>
      </div>
    </Modal>
  );
}

function RevokeModal({ apiKey, onClose }: { apiKey: ApiKeyView; onClose: () => void }) {
  const refresh = useRefreshIntegrations();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { await api.post(`/integrations/api-keys/${apiKey.id}/revoke`); await refresh(); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not revoke the key.'); } finally { setBusy(false); }
  }
  return (
    <Modal open title={`Revoke “${apiKey.name}”?`} onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Alert tone="warning">Anything using this key stops working immediately. This can’t be undone; create a new key if you need one again.</Alert>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Keep it</Button><Button variant="danger" loading={busy} onClick={go}>Revoke key</Button></div>
      </div>
    </Modal>
  );
}

// ================================================================== webhooks
function WebhooksTab({ canManage }: { canManage: boolean }) {
  const hooks = useWebhooks();
  const refresh = useRefreshIntegrations();
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<WebhookEndpointCreated | null>(null);
  const [logFor, setLogFor] = useState<WebhookEndpointView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, done?: string) => { setError(null); setNote(null); try { await fn(); await refresh(); if (done) setNote(done); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong.'); } };
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-slate-600">A webhook tells another system the moment something happens here, for example a new booking or a payment. Each message is signed so the receiver can prove it really came from you. Failed messages are retried for about a day.</p>
        {canManage && <Button onClick={() => setCreating(true)}>Add webhook</Button>}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {note && <Alert tone="success">{note}</Alert>}
      {hooks.isLoading && <Spinner />}
      {hooks.data?.length === 0 && <EmptyState title="No webhooks yet" description="Add the web address of the system that should be told about bookings and payments." />}
      <div className="space-y-3">
        {hooks.data?.map((h) => (
          <Card key={h.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all font-medium text-slate-900">{h.url}</span>{h.isActive ? <Badge tone="success">On</Badge> : <Badge tone="warning">Off</Badge>}</div>
            {h.description && <p className="text-sm text-slate-600">{h.description}</p>}
            <p className="text-sm text-slate-600">Events: {h.events.includes(WEBHOOK_ALL_EVENTS) ? 'everything' : h.events.map(labelOf).join(', ')}</p>
            {h.disabledReason && <Alert tone="warning">{h.disabledReason}</Alert>}
            {h.consecutiveFailures > 0 && h.isActive && <p className="text-xs text-amber-700">{h.consecutiveFailures} delivery(ies) in a row failed.</p>}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" onClick={() => setLogFor(h)}>Deliveries</Button>
              {canManage && h.isActive && <Button variant="secondary" onClick={() => run(() => api.post(`/integrations/webhooks/${h.id}/test`), 'A test message was queued. Open Deliveries to watch it arrive.')}>Send test</Button>}
              {canManage && <Button variant="ghost" onClick={() => run(() => api.patch(`/integrations/webhooks/${h.id}`, { isActive: !h.isActive }))}>{h.isActive ? 'Turn off' : 'Turn on'}</Button>}
              {canManage && <Button variant="ghost" onClick={async () => { await run(async () => setSecret(await api.post<WebhookEndpointCreated>(`/integrations/webhooks/${h.id}/rotate-secret`))); }}>New secret</Button>}
              {canManage && <Button variant="ghost" onClick={() => run(() => api.delete(`/integrations/webhooks/${h.id}`))}>Delete</Button>}
            </div>
          </Card>
        ))}
      </div>
      {creating && <CreateWebhookModal onClose={() => setCreating(false)} onCreated={(w) => { setCreating(false); setSecret(w); void refresh(); }} />}
      {secret && <SecretModal title="Signing secret" secret={secret.secret} note="Copy this secret now and store it in the receiving system. We can’t show it again. It is used to check the signature on every message." onClose={() => setSecret(null)} />}
      {logFor && <DeliveriesModal endpoint={logFor} canManage={canManage} onClose={() => setLogFor(null)} />}
    </div>
  );
}

function CreateWebhookModal({ onClose, onCreated }: { onClose: () => void; onCreated: (w: WebhookEndpointCreated) => void }) {
  const { properties } = useProperties();
  const [url, setUrl] = useState('https://');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState<string[]>([...WEBHOOK_EVENTS]);
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setError(null);
    if (!/^https?:\/\/\S+\.\S+/.test(url) && !url.startsWith('http://localhost')) return setError('Enter the full address, starting with https://');
    if (events.length === 0) return setError('Choose at least one event.');
    setBusy(true);
    try { onCreated(await api.post<WebhookEndpointCreated>('/integrations/webhooks', { url, description, events, ...(propertyId ? { propertyId } : {}) })); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not add the webhook.'); } finally { setBusy(false); }
  }
  return (
    <Modal open title="Add webhook" onClose={onClose}>
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Address that receives the messages" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Field label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <fieldset className="space-y-1"><legend className="text-sm font-medium text-slate-700">Events</legend>
          {WEBHOOK_EVENTS.map((ev) => <label key={ev} className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={events.includes(ev)} onChange={() => setEvents((l) => (l.includes(ev) ? l.filter((x) => x !== ev) : [...l, ev]))} /> {labelOf(ev.replace('.', ' '))}</label>)}
        </fieldset>
        <SelectField label="From which property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">All properties</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name} only</option>)}</SelectField>
        <p className="text-xs text-slate-500">For safety, addresses on private networks (like 192.168.x.x or localhost) are refused in production.</p>
        <div className="flex justify-end gap-2 pt-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={save}>Add webhook</Button></div>
      </div>
    </Modal>
  );
}

function DeliveriesModal({ endpoint, canManage, onClose }: { endpoint: WebhookEndpointView; canManage: boolean; onClose: () => void }) {
  const deliveries = useDeliveries(endpoint.id);
  const refresh = useRefreshIntegrations();
  const [error, setError] = useState<string | null>(null);
  const tone = { SUCCESS: 'success', PENDING: 'info', DEAD: 'warning' } as const;
  return (
    <Modal open title="Recent deliveries" onClose={onClose}>
      <div className="space-y-3 text-sm">
        <p className="break-all text-slate-500">{endpoint.url}</p>
        {error && <Alert tone="error">{error}</Alert>}
        {deliveries.isLoading && <Spinner />}
        {deliveries.data?.length === 0 && <p className="text-slate-500">Nothing sent yet. Use “Send test”.</p>}
        <ul className="divide-y divide-slate-100">
          {deliveries.data?.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-3 py-2">
              <span><span className="font-medium text-slate-800">{d.eventType}</span><span className="block text-xs text-slate-500">{new Date(d.createdAt).toLocaleString()} · {d.attempts} attempt{d.attempts === 1 ? '' : 's'}{d.lastStatusCode ? ` · HTTP ${d.lastStatusCode}` : ''}</span>{d.lastError && <span className="block text-xs text-red-600">{d.lastError}</span>}{d.nextAttemptAt && <span className="block text-xs text-slate-500">next try {new Date(d.nextAttemptAt).toLocaleTimeString()}</span>}</span>
              <span className="flex flex-col items-end gap-1"><Badge tone={tone[d.status]}>{d.status === 'DEAD' ? 'Failed' : d.status === 'SUCCESS' ? 'Delivered' : 'Waiting'}</Badge>{canManage && d.status === 'DEAD' && <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={async () => { setError(null); try { await api.post(`/integrations/webhook-deliveries/${d.id}/redeliver`); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not resend.'); } }}>Send again</button>}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}

// ================================================================== help
function HelpTab() {
  return (
    <div className="space-y-6 text-sm text-slate-700">
      <Card className="space-y-2">
        <h2 className="font-semibold text-slate-900">Booking API (for your website’s server)</h2>
        <p>Send the key as <code className="rounded bg-slate-100 px-1">X-API-Key</code>. Base address: <code className="rounded bg-slate-100 px-1">&lt;your-api&gt;/api/v1/public</code></p>
        <ul className="list-disc space-y-1 pl-5">
          <li><code>GET /properties</code>: the properties this key can reach</li>
          <li><code>GET /properties/:id/availability?arrival=2026-12-01&amp;departure=2026-12-03&amp;adults=2</code>: rooms free for the whole stay, with prices</li>
          <li><code>POST /properties/:id/bookings</code>: create a booking. <strong>Requires an <code>Idempotency-Key</code> header</strong> (any unique text per booking attempt) so a retry never makes a second booking</li>
          <li><code>GET /properties/:id/bookings/:code?email=guest@example.com</code>: look a booking up (needs the code <em>and</em> the guest’s email)</li>
        </ul>
        <p className="text-xs text-slate-500">Limits: 120 requests a minute per key, 20 bookings a minute. Prices are in centavos (whole numbers).</p>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold text-slate-900">Checking a webhook is genuine</h2>
        <p>Every message carries <code>X-PMS-Timestamp</code> and <code>X-PMS-Signature</code>. Compute <code>HMAC-SHA256</code> of <code>timestamp + "." + raw body</code> with your signing secret, write it as <code>sha256=&lt;hex&gt;</code>, and compare it to the header. Ignore messages whose timestamp is more than 5 minutes old.</p>
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">{`// Node.js
const crypto = require('crypto');
function isGenuine(secret, headers, rawBody) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret)
    .update(headers['x-pms-timestamp'] + '.' + rawBody).digest('hex');
  const ok = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headers['x-pms-signature'] || ''));
  const fresh = Math.abs(Date.now() / 1000 - Number(headers['x-pms-timestamp'])) < 300;
  return ok && fresh;
}`}</pre>
        <p>Messages can arrive more than once (retries), so use the event <code>id</code> to ignore repeats. Answer with any 2xx status within 10 seconds.</p>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold text-slate-900">Real emails</h2>
        <p>By default emails are printed in the API console. To send real ones, create a free account at resend.com, verify your domain, then set <code>MAIL_PROVIDER=resend</code>, <code>RESEND_API_KEY</code> and <code>MAIL_FROM</code> in the API’s <code>.env</code> and restart it.</p>
      </Card>
    </div>
  );
}
