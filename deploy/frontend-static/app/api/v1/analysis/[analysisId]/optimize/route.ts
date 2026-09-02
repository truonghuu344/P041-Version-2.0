import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 180;

const apiProxyTarget = (
  process.env.API_PROXY_TARGET ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:8000'
).replace(/\/$/, '');

type RouteContext = {
  params: Promise<{ analysisId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const { analysisId } = await context.params;
  const upstreamHeaders = new Headers();

  for (const name of ['authorization', 'content-type', 'cookie', 'accept']) {
    const value = request.headers.get(name);
    if (value) upstreamHeaders.set(name, value);
  }

  try {
    const upstream = await fetch(
      `${apiProxyTarget}/api/v1/analysis/${encodeURIComponent(analysisId)}/optimize`,
      {
        method: 'POST',
        headers: upstreamHeaders,
        body: await request.arrayBuffer(),
        cache: 'no-store',
      },
    );

    if (!upstream.ok) {
      // Never forward backend error bodies to the browser.
      return Response.json(
        { detail: 'Không thể hoàn tất tối ưu CV lúc này. Vui lòng thử lại sau.' },
        { status: upstream.status },
      );
    }

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get('content-type');
    if (contentType) responseHeaders.set('content-type', contentType);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Không xác định';
    return Response.json(
      { detail: `Không thể kết nối dịch vụ tối ưu CV: ${message}` },
      { status: 502 },
    );
  }
}
