/**
 * GET /api/v2/admin/export?type=audit_logs|bookings&date=YYYY-MM-DD&format=csv|xlsx
 * CSV / Excel export (ADMIN only, service role read).
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const JWT_SECRET = process.env.JWT_SECRET || 'gostaylo-secret-key-change-in-production';

function verifyAdmin() {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get('gostaylo_session');
  if (!sessionCookie?.value) {
    return { error: 'Unauthorized', status: 401 };
  }
  try {
    const decoded = jwt.verify(sessionCookie.value, JWT_SECRET);
    if (decoded.role !== 'ADMIN') {
      return { error: 'Admin access required', status: 403 };
    }
    return { ok: true };
  } catch {
    return { error: 'Invalid session', status: 401 };
  }
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}

/** Приводим ячейки к строкам/числам для Excel */
function normalizeCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function toXlsxBuffer(sheetName, headers, rows) {
  const safeName = sheetName.slice(0, 31).replace(/[/\\?*[\]]/g, '_');
  const aoa = [headers.map(normalizeCell), ...rows.map((r) => r.map(normalizeCell))];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, safeName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function dayBoundsUtc(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate?.trim() || '');
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const start = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, d + 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function GET(request) {
  const auth = verifyAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const date = searchParams.get('date');
  const format = searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

  const bounds = dayBoundsUtc(date);
  if (!bounds) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing date=YYYY-MM-DD' },
      { status: 400 }
    );
  }

  const { start, end } = bounds;

  try {
    if (type === 'audit_logs') {
      const { data, error } = await supabaseAdmin
        .from('audit_logs')
        .select('id,user_id,action,entity_type,entity_id,payload,created_at')
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: true });

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      }

      const headers = ['id', 'user_id', 'action', 'entity_type', 'entity_id', 'payload', 'created_at'];
      const rows = (data || []).map((r) => [
        r.id,
        r.user_id,
        r.action,
        r.entity_type,
        r.entity_id,
        r.payload,
        r.created_at,
      ]);

      const base = `audit_logs_${date}`;
      if (format === 'xlsx') {
        const buf = toXlsxBuffer('audit_logs', headers, rows);
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${base}.xlsx"`,
          },
        });
      }

      const csv = '\uFEFF' + toCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${base}.csv"`,
        },
      });
    }

    if (type === 'bookings') {
      const [byCreated, byUpdated] = await Promise.all([
        supabaseAdmin.from('bookings').select('*').gte('created_at', start).lt('created_at', end),
        supabaseAdmin.from('bookings').select('*').gte('updated_at', start).lt('updated_at', end),
      ]);

      if (byCreated.error) {
        return NextResponse.json({ success: false, error: byCreated.error.message }, { status: 500 });
      }
      if (byUpdated.error) {
        return NextResponse.json({ success: false, error: byUpdated.error.message }, { status: 500 });
      }

      const byId = new Map();
      for (const row of [...(byCreated.data || []), ...(byUpdated.data || [])]) {
        byId.set(row.id, row);
      }
      const list = [...byId.values()].sort(
        (a, b) => new Date(a.updated_at || a.created_at) - new Date(b.updated_at || b.created_at)
      );

      const base = `bookings_${date}`;

      if (list.length === 0) {
        const headers = ['message'];
        const rows = [['За выбранную дату нет записей (создание или изменение в этот день по UTC).']];
        if (format === 'xlsx') {
          const buf = toXlsxBuffer('bookings', headers, rows);
          return new NextResponse(buf, {
            status: 200,
            headers: {
              'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'Content-Disposition': `attachment; filename="${base}.xlsx"`,
            },
          });
        }
        const csv = '\uFEFF' + toCsv(headers, rows);
        return new NextResponse(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${base}.csv"`,
          },
        });
      }

      const headers = Object.keys(list[0]);
      const rows = list.map((row) => headers.map((h) => row[h]));

      if (format === 'xlsx') {
        const buf = toXlsxBuffer('bookings', headers, rows);
        return new NextResponse(buf, {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="${base}.xlsx"`,
          },
        });
      }

      const csv = '\uFEFF' + toCsv(headers, rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${base}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'type must be audit_logs or bookings' },
      { status: 400 }
    );
  } catch (e) {
    console.error('[ADMIN EXPORT]', e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
