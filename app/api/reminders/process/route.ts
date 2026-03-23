import { handleNotificationDispatch } from '../../../../lib/notificationDispatchHandler';

export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return handleNotificationDispatch(request);
}
