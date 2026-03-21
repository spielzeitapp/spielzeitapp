import { handlePushSubscribe } from '../../../../lib/pushSubscribeHandler';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return handlePushSubscribe(request);
}
